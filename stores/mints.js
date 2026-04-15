import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useNostrPool } from '~/composables/useNostrPool'

const now = () => Math.floor(Date.now() / 1000)

const dedupe = (items) => Array.from(new Set(items.filter(Boolean)))

const parseMintListEvent = (event) => {
  return dedupe(
    (event?.tags || [])
      .filter((tag) => tag[0] === 'mint' && tag[1])
      .map((tag) => tag[1].trim())
  )
}

export const useMintsStore = defineStore('mints', () => {
  const { queryEvents, publishEvent } = useNostrPool()

  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const eventId = ref('')
  const mintUrls = ref([])

  const setMintUrls = (urls) => {
    mintUrls.value = dedupe(urls.map((item) => String(item || '').trim()))
  }

  const addMint = (url) => {
    const normalized = String(url || '').trim()
    if (!normalized) return
    setMintUrls([...mintUrls.value, normalized])
  }

  const removeMint = (url) => {
    mintUrls.value = mintUrls.value.filter((item) => item !== url)
  }

  const loadMints = async ({ pubkey, relays }) => {
    if (!pubkey) return

    loading.value = true
    error.value = ''

    try {
      const events = await queryEvents(relays, {
        kinds: [10019],
        authors: [pubkey],
        limit: 1
      })

      const latest = events[0]
      eventId.value = latest?.id || ''
      setMintUrls(parseMintListEvent(latest))
    } catch (err) {
      error.value = err.message || 'Failed to load mint list'
    } finally {
      loading.value = false
    }
  }

  const publishMints = async ({ signer, pubkey, relays, signAuthChallenge }) => {
    saving.value = true
    error.value = ''

    try {
      const template = {
        kind: 10019,
        created_at: now(),
        pubkey,
        tags: mintUrls.value.map((url) => ['mint', url]),
        content: ''
      }

      const signed = await signer.signEvent(template)
      await publishEvent(relays, signed, signAuthChallenge)
      eventId.value = signed.id
      return signed
    } catch (err) {
      error.value = err.message || 'Failed to publish mint list'
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    loading,
    saving,
    error,
    eventId,
    mintUrls,
    setMintUrls,
    addMint,
    removeMint,
    loadMints,
    publishMints
  }
})
