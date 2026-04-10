import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  title: "Nostr Boutique Admin",

  compatibilityDate: "2025-12-01",

  vite: {
    plugins: [
      tailwindcss()
    ]
  },

  app: {
    head: {
      title: "Nostr Boutique Admin",
      meta: [
        {
          name: "description",
          content: "Merchant admin client for listings, orders, payments, and profile management on Nostr."
        }
      ]
    }
  },

  devtools: { enabled: true },

  css: ['~/assets/tailwind.css'],

  modules: [
    "@pinia/nuxt"
  ]
})
