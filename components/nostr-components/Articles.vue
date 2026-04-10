<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useNostrArticles } from '~/composables/useNostrArticles'

const props = defineProps({
  tagFilter: {
    type: [String, Array],
    default: 'freedom'
  },
  relays: {
    type: Array,
    default: () => [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
    ]
  },
  limit: {
    type: Number,
    default: 50
  },
  showAuthor: {
    type: Boolean,
    default: false
  },
  showTopics: {
    type: Boolean,
    default: true
  },
  autoRefresh: {
    type: Boolean,
    default: false
  },
  refreshInterval: {
    type: Number,
    default: 300000 // 5 minutes
  },
  gridCols: {
    type: String,
    default: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }
})

const emit = defineEmits(['articleClick', 'articlesLoad', 'error'])

// Composable for Nostr articles functionality
const { articlesData, fetchArticles, refresh, getAllTopics, clearArticles, close } = useNostrArticles()

// Local state
const refreshTimer = ref(null)
const selectedTopic = ref('')

// Computed properties
const filteredArticles = computed(() => {
  if (!selectedTopic.value) {
    return articlesData.value.articles
  }
  return articlesData.value.articles.filter(article =>
    article.topics.includes(selectedTopic.value)
  )
})

const availableTopics = computed(() => getAllTopics())

const isLoading = computed(() => articlesData.value.loading)
const hasError = computed(() => !!articlesData.value.error)
const hasArticles = computed(() => filteredArticles.value.length > 0)

// Computed property to display tag filter in user-friendly format
const tagFilterDisplay = computed(() => {
  if (Array.isArray(props.tagFilter)) {
    return props.tagFilter.join(', ')
  }
  return props.tagFilter
})

// Methods
const loadArticles = async () => {
  try {
    await fetchArticles(props.tagFilter, props.relays, props.limit)
    
    if (articlesData.value.error) {
      emit('error', articlesData.value.error)
      return
    }
    
    emit('articlesLoad', {
      totalCount: articlesData.value.totalCount,
      articles: articlesData.value.articles,
      topics: availableTopics.value
    })
  } catch (error) {
    emit('error', error.message)
  }
}

const handleRefresh = async () => {
  await refresh(props.tagFilter, props.relays, props.limit)
}

const handleTopicFilter = (topic) => {
  selectedTopic.value = topic === selectedTopic.value ? '' : topic
}

const setupAutoRefresh = () => {
  if (props.autoRefresh && props.refreshInterval > 0) {
    refreshTimer.value = setInterval(() => {
      handleRefresh()
    }, props.refreshInterval)
  }
}

const clearAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

// Lifecycle hooks
onMounted(async () => {
  await loadArticles()
  setupAutoRefresh()
})

onUnmounted(() => {
  clearAutoRefresh()
  close()
})

// Watch for prop changes
watch(() => props.tagFilter, async (newTagFilter) => {
  if (newTagFilter) {
    clearArticles()
    await loadArticles()
  }
})

watch(() => props.autoRefresh, () => {
  clearAutoRefresh()
  setupAutoRefresh()
})
</script>

<template>
  <section class="max-w-7xl mx-auto pb-32">
    <div class="text-center my-8">
      <h2 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
        Articles
      </h2>
      <p class="text-xl text-gray-600">
        These long-form articles are fetched from different relays.
      </p>
    </div>
    <div class="w-full mx-auto">

      <!-- Error Message -->
      <div v-if="hasError" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex">
          <div>
            <h3 class="text-sm font-medium text-red-800">Error Loading Articles</h3>
            <p class="text-sm text-red-700 mt-1">{{ articlesData.error }}</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && !hasArticles" class="flex justify-center items-center h-64">
        <div class="text-center">
          <p class="text-gray-500">Loading articles...</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!isLoading && !hasArticles" class="text-center py-12">
        <h3 class="text-lg font-medium text-gray-900 mb-2">No Articles Found</h3>
        <p class="text-gray-500">
          <span v-if="selectedTopic">
            No articles found for topic "{{ selectedTopic }}".
          </span>
          <span v-else>
            No articles found with tags: {{ tagFilterDisplay }}.
          </span>
        </p>
        <button
          @click="handleRefresh"
          class="mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          Try Again
        </button>
      </div>

      <!-- Articles Grid -->
      <div v-else class="grid gap-6" :class="gridCols">
        <NostrComponentsArticleCard
          v-for="article in filteredArticles"
          :key="article.id"
          :article="article"
          :show-author="showAuthor"
          :show-topics="showTopics"
        />
      </div>

    </div>
  </section>
</template>

<style scoped>

</style>
