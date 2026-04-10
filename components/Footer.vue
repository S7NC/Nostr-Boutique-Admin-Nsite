<script setup>
  import { Shader, Blob, CursorRipples } from 'shaders/vue'
</script>
<template>
  <footer class="text-center m-20">
    <Shader class="rounded-4xl mb-24 overflow-hidden">
      <Blob colorA="#0099FF" colorB="#C44569" :size="0.25" />
      <CursorRipples />
    </Shader>
    <div>
      Powered by Nuxtstack
      <br />
      <a href="https://gitlab.com/sebastix-group/nostr/nuxtstack">repository</a>
    </div>
  </footer>
</template>
<style scoped>

</style>