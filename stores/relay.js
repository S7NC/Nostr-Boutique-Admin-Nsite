import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useNostrPool } from '~/composables/useNostrPool'

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://purplepag.es'
]

const DEFAULT_BLOSSOM_SERVERS = [
  'https://blossom.ditto.pub'
]

const normalizeUrlList = (rawText) => {
  return rawText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

const dedupe = (list) => Array.from(new Set(list.filter(Boolean)))

const parseRelayListEvent = (event) => {
  const tags = event?.tags || []
  const inbox = []
  const outbox = []

  for (const tag of tags) {
    if (tag[0] !== 'r' || !tag[1]) continue
    const marker = (tag[2] || '').toLowerCase()

    if (!marker || marker === 'read') inbox.push(tag[1])
    if (!marker || marker === 'write') outbox.push(tag[1])
  }

  return {
    inbox: dedupe(inbox),
    outbox: dedupe(outbox)
  }
}

const parseBlossomServerListEvent = (event) => {
  const tags = event?.tags || []
  return dedupe(tags.filter((tag) => tag[0] === 'server' && tag[1]).map((tag) => tag[1]))
}

export const useRelayStore = defineStore('relay', () => {
  const { queryEvents } = useNostrPool()

  const bootstrapRelays = ref([...DEFAULT_RELAYS])
  const fallbackBlossomServers = ref([...DEFAULT_BLOSSOM_SERVERS])
  const resolvedInboxRelays = ref([])
  const resolvedOutboxRelays = ref([])
  const resolvedBlossomServers = ref([])

  const relaySource = ref('fallback_default')
  const blossomSource = ref('fallback_default')
  const routingLoading = ref(false)
  const routingError = ref('')

  const requireBlossomAuth = ref(false)

  const effectiveInboxRelays = computed(() => {
    return resolvedInboxRelays.value.length ? resolvedInboxRelays.value : bootstrapRelays.value
  })

  const effectiveOutboxRelays = computed(() => {
    return resolvedOutboxRelays.value.length ? resolvedOutboxRelays.value : bootstrapRelays.value
  })

  const effectiveBlossomServers = computed(() => {
    return resolvedBlossomServers.value.length ? resolvedBlossomServers.value : fallbackBlossomServers.value
  })

  const bootstrapRelayText = computed({
    get: () => bootstrapRelays.value.join('\n'),
    set: (value) => {
      bootstrapRelays.value = normalizeUrlList(value)
    }
  })

  const refreshRouting = async (pubkey) => {
    if (!pubkey) return

    routingLoading.value = true
    routingError.value = ''

    try {
      const [relayListEvents, blossomEvents] = await Promise.all([
        queryEvents(bootstrapRelays.value, {
          kinds: [10002],
          authors: [pubkey],
          limit: 1
        }),
        queryEvents(bootstrapRelays.value, {
          kinds: [10063],
          authors: [pubkey],
          limit: 1
        })
      ])

      const relayListEvent = relayListEvents[0]
      const blossomListEvent = blossomEvents[0]

      if (relayListEvent) {
        const parsed = parseRelayListEvent(relayListEvent)
        resolvedInboxRelays.value = parsed.inbox
        resolvedOutboxRelays.value = parsed.outbox
        relaySource.value = parsed.inbox.length || parsed.outbox.length ? 'nip65_event' : 'fallback_default'
      } else {
        resolvedInboxRelays.value = []
        resolvedOutboxRelays.value = []
        relaySource.value = 'fallback_default'
      }

      if (blossomListEvent) {
        const parsed = parseBlossomServerListEvent(blossomListEvent)
        resolvedBlossomServers.value = parsed
        blossomSource.value = parsed.length ? 'kind10063_event' : 'fallback_default'
      } else {
        resolvedBlossomServers.value = []
        blossomSource.value = 'fallback_default'
      }
    } catch (error) {
      routingError.value = error.message || 'Failed to refresh relay routing'
      resolvedInboxRelays.value = []
      resolvedOutboxRelays.value = []
      resolvedBlossomServers.value = []
      relaySource.value = 'fallback_default'
      blossomSource.value = 'fallback_default'
    } finally {
      routingLoading.value = false
    }
  }

  const addBootstrapRelay = (url) => {
    const normalized = url.trim()
    if (!normalized) return
    if (bootstrapRelays.value.includes(normalized)) return
    bootstrapRelays.value.push(normalized)
  }

  const removeBootstrapRelay = (url) => {
    bootstrapRelays.value = bootstrapRelays.value.filter((item) => item !== url)
  }

  const addFallbackBlossomServer = (url) => {
    const normalized = url.trim()
    if (!normalized) return
    if (fallbackBlossomServers.value.includes(normalized)) return
    fallbackBlossomServers.value.push(normalized)
  }

  const removeFallbackBlossomServer = (url) => {
    fallbackBlossomServers.value = fallbackBlossomServers.value.filter((item) => item !== url)
  }

  return {
    bootstrapRelays,
    fallbackBlossomServers,
    resolvedInboxRelays,
    resolvedOutboxRelays,
    resolvedBlossomServers,
    relaySource,
    blossomSource,
    routingLoading,
    routingError,
    requireBlossomAuth,
    effectiveInboxRelays,
    effectiveOutboxRelays,
    effectiveBlossomServers,
    bootstrapRelayText,
    addBootstrapRelay,
    removeBootstrapRelay,
    addFallbackBlossomServer,
    removeFallbackBlossomServer,
    refreshRouting
  }
})
