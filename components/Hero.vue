<script setup>
import gsap from 'gsap';

const props = defineProps({
  heading: {
    type: String,
    default: 'Build high-class websites in minutes'
  },
});

// GSAP animation on mount (per Nuxtstack guidelines)
onMounted(() => {

  gsap.fromTo('.hero-content', 
    {
      opacity: 0,
      y: -500,
    },
    {
      opacity: 1,
      y: 0,
      duration: 1.5,
      ease: "bounce.out",
    }
  );
});
</script>

<template>
  <section class="flex flex-col items-center justify-center block-screen">
    <div class="hero-content">
      <img src="~/assets/nuxtstack-cover.png" class="rounded-4xl mx-auto mb-20 shadow-2xl" alt="Nuxstack "/>
      <h1 class="text-4xl font-bold mb-20">{{ heading }}</h1>
    </div>
  </section>
</template>

<style scoped>

</style>