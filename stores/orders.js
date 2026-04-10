import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { buildOrderStatusTemplate, buildShippingUpdateTemplate, parseOrderMessage } from '~/composables/useMarketProtocol'
import { useNostrPool } from '~/composables/useNostrPool'

const STATUS_KEYS = ['pending', 'confirmed', 'processing', 'completed', 'cancelled']

const typeLabel = {
  '1': 'order_created',
  '2': 'payment_request',
  '3': 'status_update',
  '4': 'shipping_update'
}

export const useOrdersStore = defineStore('orders', () => {
  const { queryEvents, publishEvent } = useNostrPool()

  const loading = ref(false)
  const sending = ref(false)
  const error = ref('')
  const events = ref([])

  const byOrder = computed(() => {
    const grouped = new Map()

    for (const event of events.value) {
      if (!event.order) continue
      if (!grouped.has(event.order)) grouped.set(event.order, [])
      grouped.get(event.order).push(event)
    }

    for (const entry of grouped.values()) {
      entry.sort((a, b) => a.createdAt - b.createdAt)
    }

    return grouped
  })

  const summary = computed(() => {
    const countByStatus = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      completed: 0,
      cancelled: 0
    }

    for (const [orderId, timeline] of byOrder.value.entries()) {
      const statusEvent = [...timeline].reverse().find((event) => event.status && STATUS_KEYS.includes(event.status))
      if (statusEvent) {
        countByStatus[statusEvent.status] += 1
      } else {
        countByStatus.pending += 1
      }
      if (!orderId) {
        countByStatus.pending += 1
      }
    }

    return {
      total: byOrder.value.size,
      ...countByStatus
    }
  })

  const formattedOrders = computed(() => {
    return Array.from(byOrder.value.entries())
      .map(([orderId, timeline]) => {
        const last = timeline[timeline.length - 1]
        const currentStatus = [...timeline].reverse().find((item) => item.status)?.status || 'pending'
        const buyer = timeline.find((item) => item.type === '1')?.pubkey || timeline.find((item) => item.recipient)?.recipient || ''
        const items = timeline.find((item) => item.type === '1')?.items || []

        return {
          orderId,
          currentStatus,
          updatedAt: last?.createdAt || 0,
          buyer,
          timeline: timeline.map((item) => ({
            ...item,
            typeLabel: typeLabel[item.type] || `kind_${item.kind}`
          })),
          items
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })

  const loadOrders = async ({ merchantPubkey, inboxRelays, outboxRelays }) => {
    if (!merchantPubkey) return

    loading.value = true
    error.value = ''

    try {
      const [incoming, outgoing] = await Promise.all([
        queryEvents(inboxRelays, {
          kinds: [16, 17, 14],
          '#p': [merchantPubkey],
          limit: 500
        }),
        queryEvents(outboxRelays, {
          kinds: [16, 17, 14],
          authors: [merchantPubkey],
          limit: 500
        })
      ])

      const dedup = new Map()
      for (const event of [...incoming, ...outgoing]) {
        dedup.set(event.id, event)
      }

      events.value = Array.from(dedup.values())
        .map(parseOrderMessage)
        .filter((item) => item.order)
    } catch (err) {
      error.value = err.message || 'Failed to load orders'
    } finally {
      loading.value = false
    }
  }

  const sendStatusUpdate = async ({ signer, outboxRelays, signAuthChallenge, merchantPubkey, buyerPubkey, orderId, status, content }) => {
    sending.value = true
    error.value = ''

    try {
      const template = buildOrderStatusTemplate({
        merchantPubkey,
        buyerPubkey,
        orderId,
        status,
        content
      })

      const signed = await signer.signEvent(template)
      await publishEvent(outboxRelays, signed, signAuthChallenge)
    } catch (err) {
      error.value = err.message || 'Failed to send status update'
      throw err
    } finally {
      sending.value = false
    }
  }

  const sendShippingUpdate = async ({ signer, outboxRelays, signAuthChallenge, merchantPubkey, buyerPubkey, orderId, status, tracking, carrier, eta, content }) => {
    sending.value = true
    error.value = ''

    try {
      const template = buildShippingUpdateTemplate({
        merchantPubkey,
        buyerPubkey,
        orderId,
        status,
        tracking,
        carrier,
        eta,
        content
      })
      const signed = await signer.signEvent(template)
      await publishEvent(outboxRelays, signed, signAuthChallenge)
    } catch (err) {
      error.value = err.message || 'Failed to send shipping update'
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
    byOrder,
    summary,
    formattedOrders,
    loadOrders,
    sendStatusUpdate,
    sendShippingUpdate
  }
})
