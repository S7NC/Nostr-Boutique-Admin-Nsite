import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { buildPaymentRequestTemplate, parseOrderMessage } from '~/composables/useMarketProtocol'
import { useNostrPool } from '~/composables/useNostrPool'

export const usePaymentsStore = defineStore('payments', () => {
  const { queryEvents, publishEvent } = useNostrPool()

  const loading = ref(false)
  const sending = ref(false)
  const error = ref('')
  const events = ref([])

  const paymentRequests = computed(() => {
    return events.value.filter((item) => item.kind === 16 && item.type === '2')
  })

  const paymentReceipts = computed(() => {
    return events.value.filter((item) => item.kind === 17)
  })

  const totals = computed(() => {
    const totalRequests = paymentRequests.value.length
    const totalReceipts = paymentReceipts.value.length

    return {
      totalRequests,
      totalReceipts,
      pendingRequests: Math.max(totalRequests - totalReceipts, 0)
    }
  })

  const loadPayments = async ({ merchantPubkey, inboxRelays, outboxRelays }) => {
    if (!merchantPubkey) return

    loading.value = true
    error.value = ''

    try {
      const [incoming, outgoing] = await Promise.all([
        queryEvents(inboxRelays, {
          kinds: [16, 17],
          '#p': [merchantPubkey],
          limit: 400
        }),
        queryEvents(outboxRelays, {
          kinds: [16, 17],
          authors: [merchantPubkey],
          limit: 400
        })
      ])

      const dedup = new Map()
      for (const event of [...incoming, ...outgoing]) {
        dedup.set(event.id, event)
      }

      events.value = Array.from(dedup.values())
        .map(parseOrderMessage)
        .filter((item) => (item.kind === 16 && item.type === '2') || item.kind === 17)
        .sort((a, b) => b.createdAt - a.createdAt)
    } catch (err) {
      error.value = err.message || 'Failed to load payments'
    } finally {
      loading.value = false
    }
  }

  const sendPaymentRequest = async ({ signer, signAuthChallenge, outboxRelays, merchantPubkey, buyerPubkey, orderId, amount, paymentRows, expiration, content }) => {
    sending.value = true
    error.value = ''

    try {
      const template = buildPaymentRequestTemplate({
        merchantPubkey,
        buyerPubkey,
        orderId,
        amount,
        paymentRows,
        expiration,
        content
      })

      const signed = await signer.signEvent(template)
      await publishEvent(outboxRelays, signed, signAuthChallenge)
      return signed
    } catch (err) {
      error.value = err.message || 'Failed to send payment request'
      throw err
    } finally {
      sending.value = false
    }
  }

  return {
    loading,
    sending,
    error,
    events,
    paymentRequests,
    paymentReceipts,
    totals,
    loadPayments,
    sendPaymentRequest
  }
})
