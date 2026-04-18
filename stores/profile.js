import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useNostrPool } from '~/composables/useNostrPool'

const now = () => Math.floor(Date.now() / 1000)
const CLIENT_TAG = ['client', 'Nostr Boutique']

const parseProfileEvent = (event) => {
  const profile = {
    name: '',
    about: '',
    picture: '',
    lud16: '',
    website: '',
    paypal: ''
  }

  try {
    const parsed = JSON.parse(event.content || '{}')
    Object.assign(profile, parsed)
  } catch {
    // ignore malformed content
  }

  return {
    profile
  }
}

export const useProfileStore = defineStore('profile', () => {
  const { queryEvents, publishEvent } = useNostrPool()

  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  const name = ref('')
  const about = ref('')
  const picture = ref('')
  const lud16 = ref('')
  const website = ref('')
  const paypal = ref('')

  const hydrate = ({ profile }) => {
    name.value = profile.name || ''
    about.value = profile.about || ''
    picture.value = profile.picture || ''
    lud16.value = profile.lud16 || ''
    website.value = profile.website || ''
    paypal.value = profile.paypal || ''
  }

  const loadProfile = async ({ pubkey, relays }) => {
    if (!pubkey) return

    loading.value = true
    error.value = ''

    try {
      const event = await queryEvents(relays, {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      })

      if (event[0]) {
        hydrate(parseProfileEvent(event[0]))
      }
    } catch (err) {
      error.value = err.message || 'Failed to load profile'
    } finally {
      loading.value = false
    }
  }

  const publishProfile = async ({ signer, pubkey, relays, signAuthChallenge }) => {
    saving.value = true
    error.value = ''

    try {
      const template = {
        kind: 0,
        created_at: now(),
        pubkey,
        tags: [[...CLIENT_TAG]],
        content: JSON.stringify({
          name: name.value,
          about: about.value,
          picture: picture.value,
          lud16: lud16.value,
          website: website.value,
          paypal: paypal.value
        })
      }

      const signed = await signer.signEvent(template)
      await publishEvent(relays, signed, signAuthChallenge)
      return signed
    } catch (err) {
      error.value = err.message || 'Failed to publish profile'
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    loading,
    saving,
    error,
    name,
    about,
    picture,
    lud16,
    website,
    paypal,
    loadProfile,
    publishProfile
  }
})
