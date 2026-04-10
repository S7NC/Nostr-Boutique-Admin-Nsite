import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { parseProductEvent, buildProductTemplate } from '~/composables/useMarketProtocol'
import { useNostrPool } from '~/composables/useNostrPool'

const emptyDraft = () => ({
  d: '',
  title: '',
  summary: '',
  content: '',
  type: 'simple',
  format: 'physical',
  visibility: 'on-sale',
  stock: '0',
  priceAmount: '',
  priceCurrency: 'USD',
  priceFrequency: '',
  categoriesText: '',
  specsText: '',
  collectionsText: '',
  shippingText: '',
  images: []
})

const parseLinePairs = (text, delimiter = ':') => {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split(delimiter)
      return {
        key: left?.trim() || '',
        value: rest.join(delimiter).trim()
      }
    })
}

export const useListingsStore = defineStore('listings', () => {
  const { queryEvents, publishEvent } = useNostrPool()

  const loading = ref(false)
  const publishing = ref(false)
  const error = ref('')
  const uploadLog = ref([])
  const products = ref([])
  const draft = ref(emptyDraft())
  const editingListingId = ref('')

  const activeCount = computed(() => {
    return products.value.filter((item) => item.visibility !== 'hidden').length
  })

  const parseDraftToPayload = () => {
    return {
      ...draft.value,
      categories: draft.value.categoriesText.split(',').map((item) => item.trim()).filter(Boolean),
      specs: parseLinePairs(draft.value.specsText, ':'),
      collections: draft.value.collectionsText.split('\n').map((item) => item.trim()).filter(Boolean),
      shippingOptions: draft.value.shippingText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [ref, extraCost = ''] = line.split('|')
          return { ref: ref?.trim() || '', extraCost: extraCost.trim() }
        })
    }
  }

  const resetDraft = () => {
    draft.value = emptyDraft()
    editingListingId.value = ''
  }

  const hydrateDraftFromProduct = (product) => {
    draft.value = {
      d: product.d || '',
      title: product.title || '',
      summary: product.summary || '',
      content: product.content || '',
      type: product.type?.product || 'simple',
      format: product.type?.format || 'physical',
      visibility: product.visibility || 'on-sale',
      stock: String(product.stock ?? 0),
      priceAmount: product.price?.amount || '',
      priceCurrency: product.price?.currency || 'USD',
      priceFrequency: product.price?.frequency || '',
      categoriesText: (product.categories || []).join(', '),
      specsText: (product.specs || []).map((spec) => `${spec.key}:${spec.value}`).join('\n'),
      collectionsText: (product.collections || []).join('\n'),
      shippingText: (product.shippingOptions || []).map((row) => `${row.ref}|${row.extraCost || ''}`).join('\n'),
      images: (product.images || []).map((image, index) => ({
        url: image.url,
        dimensions: image.dimensions || '',
        order: image.order || String(index + 1)
      }))
    }

    editingListingId.value = product.id
  }

  const addImageToDraft = ({ url, dimensions = '', order = '' }) => {
    draft.value.images.push({
      url,
      dimensions,
      order: order || String(draft.value.images.length + 1)
    })
  }

  const removeDraftImage = (index) => {
    draft.value.images.splice(index, 1)
  }

  const loadProducts = async ({ pubkey, relays }) => {
    if (!pubkey) return

    loading.value = true
    error.value = ''

    try {
      const events = await queryEvents(relays, {
        kinds: [30402],
        authors: [pubkey],
        limit: 300
      })

      products.value = events
        .map(parseProductEvent)
        .filter((item) => item.d)
        .sort((a, b) => b.createdAt - a.createdAt)
    } catch (err) {
      error.value = err.message || 'Failed to load listings'
    } finally {
      loading.value = false
    }
  }

  const publishDraft = async ({ signer, pubkey, relays, signAuthChallenge }) => {
    publishing.value = true
    error.value = ''

    try {
      const payload = parseDraftToPayload()
      const template = buildProductTemplate(pubkey, payload)
      const signed = await signer.signEvent(template)
      await publishEvent(relays, signed, signAuthChallenge)
      await loadProducts({ pubkey, relays })
      return signed
    } catch (err) {
      error.value = err.message || 'Failed to publish listing'
      throw err
    } finally {
      publishing.value = false
    }
  }

  return {
    loading,
    publishing,
    error,
    uploadLog,
    products,
    draft,
    editingListingId,
    activeCount,
    parseDraftToPayload,
    resetDraft,
    hydrateDraftFromProduct,
    addImageToDraft,
    removeDraftImage,
    loadProducts,
    publishDraft
  }
})
