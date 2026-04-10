import { ref, readonly } from 'vue'
import { SimplePool } from 'nostr-tools/pool'

// Default relays to use for fetching articles
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
]

export const useNostrArticles = () => {
  const pool = new SimplePool()

  // Reactive state
  const articlesData = ref({
    articles: [],
    loading: false,
    error: null,
    totalCount: 0
  })

  /**
   * Fetch long-form articles (kind 30023) with specific tag filter(s)
   * @param {string|string[]} tagFilter - The t tag value(s) to filter by (e.g., "kidstr" or ["kidstr", "travel"])
   * @param {string[]} relays - Optional array of relay URLs
   * @param {number} limit - Maximum number of articles to fetch
   * @returns {Promise<void>}
   */
  const fetchArticles = async (tagFilter = '', relays = DEFAULT_RELAYS, limit = 50) => {
    try {
      articlesData.value.loading = true
      articlesData.value.error = null

      // Normalize tagFilter to array format
      let tagFilterArray = []
      if (typeof tagFilter === 'string') {
        tagFilterArray = [tagFilter]
      } else {
        tagFilterArray = tagFilter
      }

      // Create filter for long-form content with specific tags
      const filter = {
        kinds: [30023], // Long-form content
        '#t': tagFilterArray, // Filter by t tags
        limit: limit
      }

      // Fetch articles from relays
      const events = await pool.querySync(relays, filter)

      // Process and sort articles
      articlesData.value.articles = events
        .map(event => parseArticleEvent(event))
        .filter(article => article !== null) // Filter out failed parsing
        .sort((a, b) => b.published_at - a.published_at) // Sort by publication date (newest first)

      articlesData.value.totalCount = articlesData.value.articles.length

    } catch (error) {
      console.error('Failed to fetch articles:', error)
      articlesData.value.error = error.message
    } finally {
      articlesData.value.loading = false
    }
  }

  /**
   * Parse a long-form article event into a structured object
   * @param {Object} event - The Nostr event
   * @returns {Object|null} Parsed article data or null if parsing failed
   */
  const parseArticleEvent = (event) => {
    try {
      // Extract tags
      const tags = event.tags || []

      // Get basic article data
      const title = getTagValue(tags, 'title') || 'Untitled Article'
      const summary = getTagValue(tags, 'summary') || ''
      const image = getTagValue(tags, 'image') || ''
      const publishedAtTag = getTagValue(tags, 'published_at')
      const identifier = getTagValue(tags, 'd') || event.id

      // Parse publication date
      const published_at = publishedAtTag ? parseInt(publishedAtTag) : event.created_at

      // Extract content (truncate for preview)
      const fullContent = event.content || ''
      const contentPreview = truncateContent(fullContent, 200)

      // Extract all t tags for categories/topics
      const topics = tags
        .filter(tag => tag[0] === 't' && tag[1])
        .map(tag => tag[1])

      // Extract author information
      const authorPubkey = event.pubkey

      return {
        id: event.id,
        identifier,
        title,
        summary,
        content: fullContent,
        contentPreview,
        image,
        published_at,
        created_at: event.created_at,
        authorPubkey,
        topics,
        event // Keep original event for reference
      }
    } catch (error) {
      console.error('Failed to parse article event:', error)
      return null
    }
  }

  /**
   * Get value from tags by tag name
   * @param {Array} tags - Array of tag arrays
   * @param {string} tagName - Name of the tag to find
   * @returns {string|null} Tag value or null if not found
   */
  const getTagValue = (tags, tagName) => {
    const tag = tags.find(tag => tag[0] === tagName)
    return tag ? tag[1] || null : null
  }

  /**
   * Truncate content for preview
   * @param {string} content - Full content
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated content
   */
  const truncateContent = (content, maxLength = 200) => {
    if (!content || content.length <= maxLength) return content

    // Try to break at word boundaries
    const truncated = content.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')

    if (lastSpace > maxLength * 0.8) { // If we can break at a word boundary reasonably close
      return truncated.substring(0, lastSpace) + '...'
    }

    return truncated + '...'
  }

  /**
   * Get articles by topic
   * @param {string} topic - Topic to filter by
   * @returns {Array} Filtered articles
   */
  const getArticlesByTopic = (topic) => {
    return articlesData.value.articles.filter(article =>
      article.topics.includes(topic)
    )
  }

  /**
   * Get unique topics from all articles
   * @returns {Array} Array of unique topics
   */
  const getAllTopics = () => {
    const topicsSet = new Set()
    articlesData.value.articles.forEach(article => {
      article.topics.forEach(topic => topicsSet.add(topic))
    })
    return Array.from(topicsSet).sort()
  }

  /**
   * Refresh articles
   * @param {string|string[]} tagFilter - The t tag value(s) to filter by (e.g., "kidstr" or ["kidstr", "bitcoin"])
   * @param {string[]} relays - Optional array of relay URLs
   * @param {number} limit - Maximum number of articles to fetch
   * @returns {Promise<void>}
   */
  const refresh = async (tagFilter = 'kidstr', relays = DEFAULT_RELAYS, limit = 50) => {
    await fetchArticles(tagFilter, relays, limit)
  }

  /**
   * Clear articles data
   */
  const clearArticles = () => {
    articlesData.value.articles = []
    articlesData.value.totalCount = 0
    articlesData.value.error = null
  }

  /**
   * Fetch a single article by identifier (d tag)
   * @param {string} identifier - The d tag value to search for
   * @param {string[]} relays - Optional array of relay URLs
   * @returns {Promise<Object|null>} Parsed article data or null if not found
   */
  const fetchArticleByIdentifier = async (identifier, relays = DEFAULT_RELAYS) => {
    try {
      // Create filter for specific article by d tag
      const filter = {
        kinds: [30023], // Long-form content
        '#d': [identifier], // Filter by d tag (identifier)
        limit: 1
      }

      // Fetch article from relays
      const events = await pool.querySync(relays, filter)

      if (events.length === 0) {
        console.log('No article found with identifier:', identifier)
        return null
      }

      // Parse the first (and should be only) event found
      const articleEvent = events[0]
      const parsedArticle = parseArticleEvent(articleEvent)
      return parsedArticle

    } catch (error) {
      console.error('Failed to fetch article by identifier:', error)
      throw error
    }
  }

  /**
   * Close all relay connections
   */
  const close = () => {
    pool.close(DEFAULT_RELAYS)
  }

  return {
    // State
    articlesData: readonly(articlesData),

    // Methods
    fetchArticles,
    fetchArticleByIdentifier,
    refresh,
    getArticlesByTopic,
    getAllTopics,
    clearArticles,
    close
  }
}
