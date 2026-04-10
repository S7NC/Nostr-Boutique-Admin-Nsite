import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { decode } from 'nostr-tools/nip19'
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'

const now = () => Math.floor(Date.now() / 1000)

const normalizeTemplate = (event) => ({
  kind: event.kind,
  created_at: event.created_at || now(),
  tags: Array.isArray(event.tags) ? event.tags : [],
  content: typeof event.content === 'string' ? event.content : ''
})

export const createExtensionSigner = (nostrProvider) => {
  if (!nostrProvider) {
    throw new Error('NIP-07 provider unavailable')
  }

  return {
    type: 'extension',
    async getPublicKey() {
      return await nostrProvider.getPublicKey()
    },
    async signEvent(event) {
      return await nostrProvider.signEvent(normalizeTemplate(event))
    },
    async nip44Encrypt(pubkey, plaintext) {
      if (!nostrProvider.nip44?.encrypt) {
        throw new Error('NIP-44 encrypt not available on extension signer')
      }

      return await nostrProvider.nip44.encrypt(pubkey, plaintext)
    },
    async nip44Decrypt(pubkey, ciphertext) {
      if (!nostrProvider.nip44?.decrypt) {
        throw new Error('NIP-44 decrypt not available on extension signer')
      }

      return await nostrProvider.nip44.decrypt(pubkey, ciphertext)
    }
  }
}

export const createNsecSigner = (nsec) => {
  const decoded = decode(nsec.trim())
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec value')
  }

  const secretKey = decoded.data
  const pubkey = getPublicKey(secretKey)

  return {
    type: 'nsec',
    async getPublicKey() {
      return pubkey
    },
    async signEvent(event) {
      return finalizeEvent(normalizeTemplate(event), secretKey)
    }
  }
}

export const createBunkerConnection = async (input, onauth) => {
  const clientSecretKey = generateSecretKey()
  const normalized = input.trim()

  if (normalized.startsWith('nostrconnect://')) {
    const signer = await BunkerSigner.fromURI(clientSecretKey, normalized, {
      onauth
    }, 20000)
    await signer.connect()

    return {
      type: 'bunker',
      signer,
      pubkey: await signer.getPublicKey()
    }
  }

  const pointer = await parseBunkerInput(normalized)
  if (!pointer) {
    throw new Error('Could not parse bunker input')
  }

  const signer = BunkerSigner.fromBunker(clientSecretKey, pointer, { onauth })
  await signer.connect()

  return {
    type: 'bunker',
    signer,
    pubkey: await signer.getPublicKey()
  }
}

export const createBunkerSignerAdapter = async (input, onauth = null) => {
  const connection = await createBunkerConnection(input, onauth)

  return {
    type: connection.type,
    async getPublicKey() {
      return await connection.signer.getPublicKey()
    },
    async signEvent(event) {
      return await connection.signer.signEvent(normalizeTemplate(event))
    },
    async nip44Encrypt(pubkey, plaintext) {
      return await connection.signer.nip44Encrypt(pubkey, plaintext)
    },
    async nip44Decrypt(pubkey, ciphertext) {
      return await connection.signer.nip44Decrypt(pubkey, ciphertext)
    },
    async close() {
      await connection.signer.close()
    }
  }
}
