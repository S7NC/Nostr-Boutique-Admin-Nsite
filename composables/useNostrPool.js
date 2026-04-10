import { SimplePool } from 'nostr-tools/pool'

const DEFAULT_TIMEOUT = 8000

let poolSingleton = null

const getPool = () => {
  if (!poolSingleton) {
    poolSingleton = new SimplePool({ maxWaitForConnection: DEFAULT_TIMEOUT })
  }

  return poolSingleton
}

export const useNostrPool = () => {
  const queryEvents = async (relays, filter, maxWait = DEFAULT_TIMEOUT) => {
    const pool = getPool()
    return await pool.querySync(relays, filter, { maxWait })
  }

  const publishEvent = async (relays, event, signAuthEvent = null) => {
    const pool = getPool()
    const results = pool.publish(relays, event, {
      maxWait: DEFAULT_TIMEOUT,
      onauth: signAuthEvent || undefined
    })

    return await Promise.allSettled(results)
  }

  const closeRelays = (relays) => {
    const pool = getPool()
    pool.close(relays)
  }

  return {
    getPool,
    queryEvents,
    publishEvent,
    closeRelays
  }
}
