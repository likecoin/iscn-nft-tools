// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/eslint-module'
  ],
  plugins: ['~/plugins/buffer.ts']
})
