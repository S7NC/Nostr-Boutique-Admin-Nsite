import { ref } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import * as nip19 from 'nostr-tools/nip19'

// Default relays to use for fetching profile data
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
]

export const useNostrProfile = () => {
  const pool = new SimplePool()

  /**
   * Fetch profile metadata for a given npub
   * @param {string} npub - The npub key to fetch profile for
   * @param {string[]} relays - Optional array of relay URLs
   * @returns {Promise<Object|null>} Profile data or null if not found
   */
  const fetchProfile = async (npub, relays = DEFAULT_RELAYS) => {
    try {
      // Decode npub to get hex pubkey
      const decoded = nip19.decode(npub)
      if (decoded.type !== 'npub') {
        throw new Error('Invalid npub format')
      }
      
      const pubkey = decoded.data

      // Create filter for kind 0 (metadata) events
      const filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      }

      // Get the most recent metadata event using the correct API
      const events = await pool.querySync(relays, filter)
      
      if (events.length === 0) {
        return null
      }

      // Parse the content (should be JSON)
      const event = events[0]
      try {
        const metadata = JSON.parse(event.content)
        return {
          ...metadata,
          pubkey,
          npub,
          created_at: event.created_at
        }
      } catch (parseError) {
        console.error('Failed to parse profile metadata JSON:', parseError)
        return null
      }

    } catch (error) {
      console.error('Failed to fetch profile:', error)
      return null
    }
  }

  /**
   * Fetch multiple profiles at once
   * @param {string[]} npubs - Array of npub keys
   * @param {string[]} relays - Optional array of relay URLs
   * @returns {Promise<Object>} Object with npub as key and profile data as value
   */
  const fetchProfiles = async (npubs, relays = DEFAULT_RELAYS) => {
    try {
      // Decode all npubs to hex pubkeys
      const pubkeys = []
      const npubToHex = {}
      
      for (const npub of npubs) {
        try {
          const decoded = nip19.decode(npub)
          if (decoded.type === 'npub') {
            const pubkey = decoded.data
            pubkeys.push(pubkey)
            npubToHex[pubkey] = npub
          }
        } catch (error) {
          console.error(`Invalid npub format: ${npub}`, error)
        }
      }

      if (pubkeys.length === 0) {
        return {}
      }

      // Create filter for kind 0 (metadata) events
      const filter = {
        kinds: [0],
        authors: pubkeys
      }

      // Get metadata events
      const events = await pool.querySync(relays, filter)
      
      // Group events by author and get the most recent for each
      const profilesByPubkey = {}
      
      events.forEach(event => {
        const existingEvent = profilesByPubkey[event.pubkey]
        if (!existingEvent || event.created_at > existingEvent.created_at) {
          profilesByPubkey[event.pubkey] = event
        }
      })

      // Parse profiles and return with npub as key
      const profiles = {}
      
      Object.values(profilesByPubkey).forEach(event => {
        try {
          const metadata = JSON.parse(event.content)
          const npub = npubToHex[event.pubkey]
          profiles[npub] = {
            ...metadata,
            pubkey: event.pubkey,
            npub,
            created_at: event.created_at
          }
        } catch (parseError) {
          console.error('Failed to parse profile metadata JSON for pubkey:', event.pubkey, parseError)
        }
      })

      return profiles

    } catch (error) {
      console.error('Failed to fetch profiles:', error)
      return {}
    }
  }

  /**
   * Fetch profile metadata for a given hex pubkey
   * @param {string} pubkey - The hex pubkey to fetch profile for
   * @param {string[]} relays - Optional array of relay URLs
   * @returns {Promise<Object|null>} Profile data or null if not found
   */
  const fetchProfileByPubkey = async (pubkey, relays = DEFAULT_RELAYS) => {
    try {
      // Create filter for kind 0 (metadata) events
      const filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      }

      // Get the most recent metadata event
      const events = await pool.querySync(relays, filter)
      
      if (events.length === 0) {
        return null
      }

      // Parse the content (should be JSON)
      const event = events[0]
      try {
        const metadata = JSON.parse(event.content)
        
        // Convert pubkey to npub for completeness
        const npub = nip19.npubEncode(pubkey)
        
        return {
          ...metadata,
          pubkey,
          npub,
          created_at: event.created_at
        }
      } catch (parseError) {
        console.error('Failed to parse profile metadata JSON:', parseError)
        return null
      }

    } catch (error) {
      console.error('Failed to fetch profile by pubkey:', error)
      return null
    }
  }

  /**
   * Close all relay connections
   */
  const close = () => {
    pool.close(DEFAULT_RELAYS)
  }

  return {
    fetchProfile,
    fetchProfiles,
    fetchProfileByPubkey,
    close
  }
}
