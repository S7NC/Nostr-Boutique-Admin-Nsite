<script setup>

</script>

<template>
  <div>
    <main class="text-center p-4 bg-purple-200">
      <NuxtLink to="/">< back to home</NuxtLink>
      <NostrComponentsArticles
          :tag-filter="['freedom', 'nostr']"
          :show-author="true"
          :show-topics="false"
          :limit="10"
          grid-cols="md:grid-cols-2 xl:grid-cols-3"
      />
    </main>
    <Footer />
  </div>
</template>