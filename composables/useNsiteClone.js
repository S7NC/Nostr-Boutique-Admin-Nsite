import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'

const FIXED_MUSE_NPUB = 'npub1000000k94d2xgnfdyqkvvgmc4x2d798y67k2llk4szq7jarqhz2s540a03'

const toRelay = (value) => {
  if (typeof value !== 'string') return ''
  const relay = value.trim()
  return relay.startsWith('wss://') ? relay : ''
}

const uniq = (values) => {
  return Array.from(new Set(values.map(toRelay).filter(Boolean)))
}

const NAMED_SITE_LABEL_RE = /^([0-9a-z]{50})([a-z0-9-]{1,13})$/

const decodeBase36Pubkey = (value) => {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  let decoded = 0n

  for (const char of String(value || '').toLowerCase()) {
    const digit = alphabet.indexOf(char)
    if (digit === -1) {
      throw new Error('Invalid base36 pubkey.')
    }

    decoded = (decoded * 36n) + BigInt(digit)
  }

  const hex = decoded.toString(16).padStart(64, '0')
  if (hex.length !== 64) {
    throw new Error('Invalid decoded pubkey length.')
  }

  return hex
}

export const parseCanonicalNamedSiteFromHostname = (hostname) => {
  const host = String(hostname || '').toLowerCase()
  const label = host.split('.')[0] || ''

  if (!label || label.endsWith('-')) return null

  const match = label.match(NAMED_SITE_LABEL_RE)
  if (!match) return null

  const [, pubkeyB36, dTag] = match

  try {
    const pubkey = decodeBase36Pubkey(pubkeyB36)

    return {
      label,
      pubkey,
      npub: nip19.npubEncode(pubkey),
      identifier: dTag
    }
  } catch {
    return null
  }
}

export const parseSourceNpubFromHostname = (hostname) => {
  const host = String(hostname || '').toLowerCase()
  const subdomain = host.split('.')[0] || ''

  if (subdomain.startsWith('npub1')) return subdomain
  if (subdomain.startsWith('npubs1')) return `npub1${subdomain.slice(6)}`
  return parseCanonicalNamedSiteFromHostname(host)?.npub || ''
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

const stripMuseTags = (tags) => {
  return tags.filter((tag) => tag[0] !== 'muse')
}

const FIXED_MUSE_PUBKEY = decodeNpub(FIXED_MUSE_NPUB)

export const buildRootCloneManifestTemplate = ({ sourceManifest, sourcePubkey, relays }) => {
  const baseTags = stripMuseTags(stripNamedSiteTags((sourceManifest?.tags || []).map((tag) => [...tag])))
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
      ['muse', FIXED_MUSE_PUBKEY, ...uniq(relays || []).slice(0, 3)]
    ],
    content: sourceManifest?.content || ''
  }
}

export const buildNamedCloneManifestTemplate = ({ sourceManifest, sourcePubkey, relays, identifier }) => {
  const baseTags = stripMuseTags(stripNamedSiteTags((sourceManifest?.tags || []).map((tag) => [...tag])))
  const relayTags = uniq([
    ...parseRelaysFromManifest(sourceManifest),
    ...(relays || [])
  ]).map((relay) => ['relay', relay])

  const nonRelayTags = baseTags.filter((tag) => tag[0] !== 'relay' && tag[0] !== 'r')

  return {
    kind: 35128,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', identifier],
      ...nonRelayTags,
      ...relayTags,
      ['muse', FIXED_MUSE_PUBKEY, ...uniq(relays || []).slice(0, 3)]
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

  const fetchSourceManifest = async ({ sourceNpub, relays, identifier = '' }) => {
    const sourcePubkey = decodeNpub(sourceNpub)
    const normalizedIdentifier = String(identifier || '').trim()

    const events = await pool.querySync(relays, normalizedIdentifier
      ? {
          kinds: [35128],
          authors: [sourcePubkey],
          '#d': [normalizedIdentifier],
          limit: 10
        }
      : {
          kinds: [15128],
          authors: [sourcePubkey],
          limit: 10
        })

    const latest = [...events].sort((a, b) => b.created_at - a.created_at)[0]
    if (!latest) {
      throw new Error(normalizedIdentifier
        ? `No source nsite manifest found for named site "${normalizedIdentifier}".`
        : 'No source nsite root manifest found on selected relays.')
    }

    const manifestRelays = parseRelaysFromManifest(latest)

    return {
      sourcePubkey,
      identifier: normalizedIdentifier,
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

  const publishClonedManifest = async ({ identity, signer, pubkey, sourceManifest, sourcePubkey, relays, identifier = '' }) => {
    const template = identifier
      ? buildNamedCloneManifestTemplate({ sourceManifest, sourcePubkey, relays, identifier })
      : buildRootCloneManifestTemplate({ sourceManifest, sourcePubkey, relays })
    const event = identity?.secretKey
      ? finalizeEvent(template, identity.secretKey)
      : await signer.signEvent({ ...template, pubkey })

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
    publishClonedManifest,
    fixedMuseNpub: FIXED_MUSE_NPUB,
    fixedMusePubkey: FIXED_MUSE_PUBKEY
  }
}
