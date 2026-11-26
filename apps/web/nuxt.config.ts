import tailwindcss from '@tailwindcss/vite'

const THEME_SCRIPT = `(function(){var d=document.documentElement,p='neutral',m='system';try{var a=localStorage.getItem('myvgc-palette'),b=localStorage.getItem('myvgc-mode');if(a==='pikachu'||a==='lapras')p=a;if(b==='light'||b==='dark')m=b}catch(e){}if(m==='system')m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.palette=p;d.dataset.mode=m})()`

// The web app is a single-page app: `nuxt generate` writes static files that the
// Hono API serves in production. All API code lives in apps/api, never in server/.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['shadcn-nuxt', '@vite-pwa/nuxt'],
  // The installable app shell (ADR 17): a service worker keeps the generated app on the device so
  // its pages open with no signal. It never answers /api/*; API data lives in the Query cache.
  pwa: {
    // A new version waits until the User chooses to reload (UpdateBanner).
    registerType: 'prompt',
    manifest: {
      name: 'MyVGC',
      short_name: 'MyVGC',
      description: 'Track your Pokémon VGC Tournaments, Teams and Opponents.',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#18181b',
      background_color: '#18181b',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    generateSW: {
      // The manifest and its icons are added by the module itself. Every Sprite, Item icon and Type
      // icon is kept too, so one shows with no signal even on a page never visited before (ADR 29,
      // ADR 32).
      globPatterns: [
        '**/*.{js,css,html,svg,ico,png,woff2}',
        'sprites/*.webp',
        'item-icons/*.webp',
        'type-icons/*.webp',
      ],
      // Every page is the same index.html. It must answer 200, never a redirect: iOS rejects a
      // redirected navigation from a service worker. A missing Sprite or icon stays a 404, as on
      // the server.
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api(\/|$)/, /^\/(sprites|item-icons|type-icons)\//],
      cleanupOutdatedCaches: true,
      // On a first visit, the service worker takes over the open page as soon as it activates, so
      // pages not opened yet open with no signal without a reload (DEV-245). A new version still
      // waits for the User's Reload: with no `skipWaiting` it only activates once they tap it.
      clientsClaim: true,
    },
    // app/plugins/update-checks.client.ts checks for new versions instead.
    client: { installPrompt: false, periodicSyncForUpdates: 0 },
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'MyVGC',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        // Native controls follow the system until the theme sets `color-scheme` (see main.css).
        { name: 'color-scheme', content: 'light dark' },
      ],
      // In the static HTML, so Safari finds them before the app starts.
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      script: [
        {
          // Sets the stored theme on <html> before first paint, so there is no flash. It repeats
          // the logic in app/lib/theme.ts: keep the keys, values and fallbacks in step.
          innerHTML: THEME_SCRIPT,
          tagPriority: 'critical',
        },
      ],
    },
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle what Vite would otherwise discover on the first page visit in `pnpm dev`,
    // which reloads the page and can swallow the first click.
    optimizeDeps: {
      include: [
        '@tanstack/vue-query',
        'better-auth/client/plugins',
        'better-auth/vue',
        'class-variance-authority',
        '@vueuse/core',
        'cn',
        'reka-ui',
        '@lucide/vue',
      ],
    },
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
    // Typecheck the unit tests (`vitest run`) with the app's types, such as the global `$fetch`.
    tsConfig: { include: ['../test/**/*'] },
  },
})
