import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'

const toRelay = (value) => {
  if (typeof value !== 'string') return ''
  const relay = value.trim()
  return relay.startsWith('wss://') ? relay : ''
}

const uniq = (values) => {
  return Array.from(new Set(values.map(toRelay).filter(Boolean)))
}

const parseSourceNpubFromHostname = (hostname) => {
  const host = String(hostname || '').toLowerCase()
  const subdomain = host.split('.')[0] || ''

  if (subdomain.startsWith('npub1')) return subdomain
  if (subdomain.startsWith('npubs1')) return `npub1${subdomain.slice(6)}`
  return ''
}

const decodeNpub = (npub) => {
  const decoded = nip19.decode(npub)
  if (decoded.type !== 'npub') {
    throw new Error('Invalid npub format.')
  }
  return decoded.data
}

const parseRelaysFromManifest = (event) => {
  const fromTags = []

  for (const tag of event?.tags || []) {
    if ((tag[0] === 'relay' || tag[0] === 'r') && tag[1]) {
      fromTags.push(tag[1])
    }
  }

  return uniq(fromTags)
}

const stripNamedSiteTags = (tags) => {
  return tags.filter((tag) => tag[0] !== 'd' && tag[0] !== 'name')
}

export const buildRootCloneManifestTemplate = ({ sourceManifest, sourcePubkey, relays }) => {
  const baseTags = stripNamedSiteTags((sourceManifest?.tags || []).map((tag) => [...tag]))
  const relayTags = uniq([
    ...parseRelaysFromManifest(sourceManifest),
    ...(relays || [])
  ]).map((relay) => ['relay', relay])

  const nonRelayTags = baseTags.filter((tag) => tag[0] !== 'relay' && tag[0] !== 'r')

  return {
    kind: 15128,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ...nonRelayTags,
      ...relayTags,
      ['muse', sourcePubkey, ...uniq(relays || []).slice(0, 3)]
    ],
    content: sourceManifest?.content || ''
  }
}

export const useNsiteClone = () => {
  const pool = new SimplePool()

  const generateIdentity = () => {
    const secretKey = generateSecretKey()
    const pubkey = getPublicKey(secretKey)

    return {
      secretKey,
      pubkey,
      npub: nip19.npubEncode(pubkey),
      nsec: nip19.nsecEncode(secretKey)
    }
  }

  const resolveSourceNpub = ({ hostname, fallbackNpub = '' }) => {
    return parseSourceNpubFromHostname(hostname) || String(fallbackNpub || '')
  }

  const fetchSourceManifest = async ({ sourceNpub, relays }) => {
    const sourcePubkey = decodeNpub(sourceNpub)

    const events = await pool.querySync(relays, {
      kinds: [15128, 35128],
      authors: [sourcePubkey],
      limit: 30
    })

    const latest = [...events].sort((a, b) => b.created_at - a.created_at)[0]
    if (!latest) {
      throw new Error('No source nsite manifest found on selected relays.')
    }

    const manifestRelays = parseRelaysFromManifest(latest)

    return {
      sourcePubkey,
      manifest: latest,
      manifestRelays
    }
  }

  const publishProfile = async ({ identity, name, relays }) => {
    const profile = {
      name,
      display_name: name,
      about: 'Owner of a sovereign Nsite webshop'
    }

    const event = finalizeEvent({
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profile)
    }, identity.secretKey)

    const pubs = pool.publish(relays, event)
    await Promise.any(pubs)
    return event
  }

  const publishClonedManifest = async ({ identity, sourceManifest, sourcePubkey, relays }) => {
    const template = buildRootCloneManifestTemplate({ sourceManifest, sourcePubkey, relays })
    const event = finalizeEvent(template, identity.secretKey)

    const pubs = pool.publish(relays, event)
    await Promise.any(pubs)
    return event
  }

  return {
    uniq,
    generateIdentity,
    resolveSourceNpub,
    fetchSourceManifest,
    publishProfile,
    publishClonedManifest
  }
}
