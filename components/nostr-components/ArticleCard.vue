<script setup>
import { computed } from 'vue';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

const props = defineProps({
  article: {
    type: Object,
    required: true
  },
  showAuthor: {
    type: Boolean,
    default: false
  },
  showTopics: {
    type: Boolean,
    default: true
  }
})

onMounted(() => {

  gsap.registerPlugin(ScrollTrigger);

  gsap.fromTo('article',
      {
        opacity: 0,
        y: 10,
        scrollTrigger: {
          trigger: '.item',
          scrub: 1,
          toggleActions: 'play pause resume reverse',
        }
      },
      {
        opacity: 1,
        y: 0,
        stagger: 0.2,
        duration: 2,
        ease: "circ.out",
        scrollTrigger: {
          trigger: '.item',
          scrub: 1,
          toggleActions: 'play pause resume reverse',
        }
      }
  );

});

// Format date for display
const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Format date for relative time
const formatRelativeDate = (timestamp) => {
  const now = Date.now()
  const articleDate = timestamp * 1000
  const diffMs = now - articleDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 30) {
    return `${diffDays} days ago`
  } else if (diffDays < 365) {
    const diffMonths = Math.floor(diffDays / 30)
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  } else {
    const diffYears = Math.floor(diffDays / 365)
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
  }
}

// Get reading time estimate
const readingTime = computed(() => {
  const wordsPerMinute = 180
  const wordCount = props.article.content.split(/\s+/).length
  const minutes = Math.ceil(wordCount / wordsPerMinute)
  return `${minutes} min read`
})

// Check if article has image
const hasImage = computed(() => {
  return props.article.image && props.article.image.trim() !== ''
})

const articleUrl = () => {
  return '/articles/'
      + props.article.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '/'
      + props.article.identifier;
}
</script>

<template>
  <article 
    class="item opacity-0 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-lg/25 transition-all duration-200 group"
  >
    <NuxtLink :to="`${articleUrl()}`" class="no-underline! hover:underline!">
      <!-- Article Image -->
      <div v-if="hasImage" class="aspect-w-16 aspect-h-9 overflow-hidden">
        <img
          :src="article.image"
          :alt="article.title"
          class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
          @error="$event.target.style.display = 'none'"
        />
      </div>

      <!-- Article Content -->
      <div class="p-6">

        <!-- Article Title -->
        <h2 class="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-kubo-orange transition-colors">
          {{ article.title }}
        </h2>

        <!-- Article Summary -->
        <p v-if="article.summary" class="text-gray-600 mb-3 line-clamp-2">
          {{ article.summary }}
        </p>

        <!-- Article Content Preview -->
        <p v-else-if="article.contentPreview" class="text-gray-600 mb-3 line-clamp-3">
          {{ article.contentPreview }}
        </p>

        <!-- Article Meta -->
        <div class="flex items-center justify-between text-sm text-gray-500">
          <div class="flex items-center space-x-4">
            <!-- Publication Date -->
            <span class="flex items-center">
              {{ formatRelativeDate(article.published_at) }}
            </span>
          </div>

          <!-- Author Info (if enabled) -->
          <div v-if="showAuthor" class="flex items-center">
            by
            <span>
              {{ article.authorPubkey.substring(0, 8) }}...
            </span>
          </div>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>

<style scoped>
/* Line clamp utilities */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Aspect ratio utilities for consistent image sizing */
.aspect-w-16 {
  position: relative;
  width: 100%;
}

.aspect-h-9 {
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
}

.aspect-w-16 > img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
