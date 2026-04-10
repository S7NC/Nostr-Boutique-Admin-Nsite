<script setup>
const route = useRoute()
const { fetchArticleByIdentifier } = useNostrArticles()
const { fetchProfileByPubkey } = useNostrProfile()
const { markdownToHtml } = useMarkdown()

// Reactive state
const article = ref(null)
const authorProfile = ref(null)
const loading = ref(true)
const error = ref(null)
const renderedContent = ref('')

// Get the identifier from the route
const identifier = computed(() => route.params.identifier)

// Fetch article data
const fetchArticle = async () => {
  try {
    loading.value = true
    error.value = null
    
    console.log('Fetching article with identifier:', identifier.value)
    
    const fetchedArticle = await fetchArticleByIdentifier(identifier.value)
    
    if (!fetchedArticle) {
      error.value = 'Article not found'
      return
    }
    
    article.value = fetchedArticle
    
    // Convert markdown content to HTML
    if (fetchedArticle.content) {
      renderedContent.value = markdownToHtml(fetchedArticle.content)
    }

    // Fetch author profile
    if (fetchedArticle.authorPubkey) {
      try {
        console.log('Fetching author profile for:', fetchedArticle.authorPubkey)
        const profile = await fetchProfileByPubkey(fetchedArticle.authorPubkey)
        authorProfile.value = profile
        console.log('Author profile fetched:', profile)
      } catch (profileError) {
        console.error('Error fetching author profile:', profileError)
        // Don't fail the whole page if profile fetch fails
      }
    }
    
  } catch (err) {
    console.error('Error fetching article:', err)
    error.value = 'Failed to load article'
  } finally {
    loading.value = false
  }
}

// Fetch article on mount
onMounted(() => {
  if (identifier.value) {
    fetchArticle()
  }
})

// Watch for identifier changes (in case of navigation)
watch(identifier, (newIdentifier) => {
  if (newIdentifier) {
    fetchArticle()
  }
})

// SEO and meta tags
watchEffect(() => {
  if (article.value) {
    useSeoMeta({
      title: article.value.title,
      description: article.value.summary || stripMarkdown(article.value.content).substring(0, 160),
      ogTitle: article.value.title,
      ogDescription: article.value.summary || stripMarkdown(article.value.content).substring(0, 160),
      ogImage: article.value.image,
      ogType: 'article',
      twitterCard: 'summary_large_image',
      twitterTitle: article.value.title,
      twitterDescription: article.value.summary || stripMarkdown(article.value.content).substring(0, 160),
      twitterImage: article.value.image,
    })
  }
})

// Helper function to strip markdown (simple version for meta)
const stripMarkdown = (text) => {
  if (!text) return ''
  return text.replace(/[*_`~#\[\]]/g, '').trim()
}

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Get author display name
const getAuthorDisplayName = () => {
  if (!article.value) return ''
  
  // If we have author profile, use name or display_name
  if (authorProfile.value) {
    return authorProfile.value.name || 
           authorProfile.value.display_name || 
           authorProfile.value.displayName ||
           `${article.value.authorPubkey.substring(0, 8)}...`
  }
  
  // Fallback to truncated pubkey
  return `${article.value.authorPubkey.substring(0, 8)}...`
}

// Get author avatar/picture
const getAuthorAvatar = () => {
  if (!authorProfile.value) return null
  return authorProfile.value.picture || 
         authorProfile.value.avatar || 
         authorProfile.value.image || 
         null
}
</script>

<template>
  <div class="max-w-4xl mx-auto my-5 px-5">
    <!-- Navigation -->
    <div class="mb-8">
      <NuxtLink
        to="/articles"
        class="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
        Back to articles
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="py-16">
      <div class="flex justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div class="text-red-600 text-lg font-semibold mb-2">
        {{ error }}
      </div>
      <p class="text-red-500">
        The article with identifier "{{ identifier }}" could not be found or loaded.
      </p>
      <button
        @click="fetchArticle"
        class="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>

    <!-- Article Content -->
    <article v-else-if="article" class="bg-white">
      <!-- Article Header -->
      <header class="mb-8">
        <!-- Featured Image -->
        <div v-if="article.image" class="mb-6">
          <img
            :src="article.image"
            :alt="article.title"
            class="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-lg shadow-lg"
            @error="$event.target.style.display='none'"
          />
        </div>

        <!-- Title -->
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          {{ article.title }}
        </h1>

        <!-- Summary -->
        <div v-if="article.summary" class="text-xl text-gray-600 mb-6 leading-relaxed">
          {{ article.summary }}
        </div>

        <!-- Author Information -->
        <div class="flex items-center mb-6">
          <!-- Author Avatar -->
          <div class="flex-none mr-4">
            <img
              v-if="getAuthorAvatar()"
              :src="getAuthorAvatar()"
              :alt="getAuthorDisplayName()"
              class="w-12 h-12 rounded-lg object-cover shadow-sm"
              @error="$event.target.style.display='none'"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg"
            >
              {{ getAuthorDisplayName().charAt(0).toUpperCase() }}
            </div>
          </div>

          <!-- Author Info -->
          <div class="flex-1 flex flex-col">
            <div class="text-gray-900 font-semibold text-lg">
              {{ getAuthorDisplayName() }}
            </div>
            <div class="text-gray-400 text-xs my-1 break-all" :title="article.authorPubkey">
              Public key: {{ `${authorProfile?.npub}` }}
            </div>
            <div class="text-gray-500 text-sm">
              {{ authorProfile?.about || 'Nostr Author' }}
            </div>
          </div>
        </div>

        <!-- Meta Information -->
        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 border-b border-gray-200 pb-6">
          <div v-if="article.published_at" class="flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {{ formatDate(article.published_at) }}
          </div>

          <div v-if="article.topics.length > 0" class="flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            <span class="flex flex-wrap gap-1">
              <span
                v-for="topic in article.topics"
                :key="topic"
                class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
              >
                {{ topic }}
              </span>
            </span>
          </div>
        </div>
      </header>

      <!-- Article Content -->
      <div class="prose prose-lg max-w-none">
        <div
          v-html="renderedContent"
          class="article-content leading-relaxed wrap-break-word text-pretty"
        ></div>
      </div>

      <!-- Footer -->
      <footer class="mt-12 pt-8 border-t border-gray-200">
        <div class="text-sm text-gray-500">
          <p>
            Published via Nostr •
            Event ID: <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">{{ article.id.substring(0, 16) }}...</code> •
            Identifier: <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">{{ article.identifier }}</code>
          </p>
        </div>
      </footer>
    </article>
  </div>
</template>

<style scoped>
@reference '~/assets/tailwind.css';
/* Custom styles for article content */
:deep(.article-content) {
  /* Typography */
  @apply text-gray-800 leading-relaxed;
}

:deep(.article-content h1),
:deep(.article-content h2),
:deep(.article-content h3),
:deep(.article-content h4),
:deep(.article-content h5),
:deep(.article-content h6) {
  @apply font-bold text-gray-900 mt-8 mb-4 leading-tight;
}

:deep(.article-content h1) { @apply text-3xl; }
:deep(.article-content h2) { @apply text-2xl; }
:deep(.article-content h3) { @apply text-xl; }
:deep(.article-content h4) { @apply text-lg; }

:deep(.article-content p) {
  @apply mb-4;
}

:deep(.article-content a) {
  @apply text-blue-600 hover:text-blue-800 underline;
}

:deep(.article-content ul),
:deep(.article-content ol) {
  @apply mb-4 ml-6;
}

:deep(.article-content ul) {
  @apply list-disc;
}

:deep(.article-content ol) {
  @apply list-decimal;
}

:deep(.article-content li) {
  @apply mb-2;
}

:deep(.article-content blockquote) {
  @apply border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4;
}

:deep(.article-content code) {
  @apply bg-gray-100 px-1 py-0.5 rounded text-sm font-mono;
}

:deep(.article-content pre) {
  @apply bg-gray-100 p-4 rounded-lg overflow-x-auto my-4;
}

:deep(.article-content pre code) {
  @apply bg-transparent p-0;
}

:deep(.article-content img) {
  @apply max-w-full h-auto rounded-lg shadow-md my-6;
}

:deep(.article-content table) {
  @apply w-full border-collapse border border-gray-300 my-4;
}

:deep(.article-content th),
:deep(.article-content td) {
  @apply border border-gray-300 px-4 py-2 text-left;
}

:deep(.article-content th) {
  @apply bg-gray-100 font-semibold;
}
</style>
