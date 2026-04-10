import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { createBunkerSignerAdapter, createExtensionSigner, createNsecSigner } from '~/composables/useSignerAdapters'

export const useAuthStore = defineStore('auth', () => {
  const status = ref('disconnected')
  const connectionMethod = ref('none')
  const pubkey = ref('')
  const error = ref('')
  const authUrl = ref('')
  const signer = shallowRef(null)

  const isConnected = computed(() => status.value === 'connected' && !!pubkey.value)
  const shortPubkey = computed(() => {
    if (!pubkey.value) return ''
    return `${pubkey.value.slice(0, 10)}...${pubkey.value.slice(-8)}`
  })

  const reset = async () => {
    if (signer.value?.close) {
      await signer.value.close()
    }

    status.value = 'disconnected'
    connectionMethod.value = 'none'
    pubkey.value = ''
    error.value = ''
    authUrl.value = ''
    signer.value = null
  }

  const signAuthChallenge = async (eventTemplate) => {
    if (!signer.value) {
      throw new Error('No signer connected')
    }

    return await signer.value.signEvent(eventTemplate)
  }

  const connectExtension = async () => {
    error.value = ''
    authUrl.value = ''
    status.value = 'connecting'

    try {
      const adapter = createExtensionSigner(window.nostr)
      const currentPubkey = await adapter.getPublicKey()

      signer.value = adapter
      pubkey.value = currentPubkey
      status.value = 'connected'
      connectionMethod.value = 'extension'
    } catch (err) {
      status.value = 'error'
      error.value = err.message || 'Failed to connect extension signer'
    }
  }

  const connectNsec = async (nsec) => {
    error.value = ''
    authUrl.value = ''
    status.value = 'connecting'

    try {
      const adapter = createNsecSigner(nsec)
      signer.value = adapter
      pubkey.value = await adapter.getPublicKey()
      status.value = 'connected'
      connectionMethod.value = 'nsec'
    } catch (err) {
      status.value = 'error'
      error.value = err.message || 'Failed to connect nsec signer'
    }
  }

  const connectBunker = async (input) => {
    error.value = ''
    authUrl.value = ''
    status.value = 'connecting'

    try {
      const adapter = await createBunkerSignerAdapter(input, (url) => {
        authUrl.value = url
      })

      signer.value = adapter
      pubkey.value = await adapter.getPublicKey()
      status.value = 'connected'
      connectionMethod.value = 'bunker'
    } catch (err) {
      status.value = 'error'
      error.value = err.message || 'Failed to connect bunker signer'
    }
  }

  const signEvent = async (template) => {
    if (!signer.value) {
      throw new Error('No signer connected')
    }

    return await signer.value.signEvent(template)
  }

  const canEncrypt = computed(() => {
    return Boolean(signer.value?.nip44Encrypt && signer.value?.nip44Decrypt)
  })

  const nip44Encrypt = async (recipient, plaintext) => {
    if (!signer.value?.nip44Encrypt) {
      throw new Error('Signer does not support NIP-44 encrypt')
    }

    return await signer.value.nip44Encrypt(recipient, plaintext)
  }

  const nip44Decrypt = async (author, ciphertext) => {
    if (!signer.value?.nip44Decrypt) {
      throw new Error('Signer does not support NIP-44 decrypt')
    }

    return await signer.value.nip44Decrypt(author, ciphertext)
  }

  return {
    status,
    connectionMethod,
    pubkey,
    error,
    authUrl,
    signer,
    isConnected,
    shortPubkey,
    canEncrypt,
    reset,
    connectExtension,
    connectNsec,
    connectBunker,
    signEvent,
    signAuthChallenge,
    nip44Encrypt,
    nip44Decrypt
  }
})
