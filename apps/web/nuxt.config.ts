import tailwindcss from '@tailwindcss/vite'

// The web app is a single-page app: `nuxt generate` writes static files that the
// Hono API serves in production. All API code lives in apps/api, never in server/.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['shadcn-nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'MyVGC',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    // In development the API runs separately (see apps/api `dev`); forward /api to it.
    devProxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? 3001}/api`,
        changeOrigin: true,
      },
    },
  },
  typescript: {
    strict: true,
  },
})
