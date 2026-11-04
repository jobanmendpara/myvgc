import tailwindcss from '@tailwindcss/vite'

const THEME_SCRIPT = `(function(){var d=document.documentElement,p='neutral',m='system';try{var a=localStorage.getItem('myvgc-palette'),b=localStorage.getItem('myvgc-mode');if(a==='pikachu'||a==='lapras')p=a;if(b==='light'||b==='dark')m=b}catch(e){}if(m==='system')m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.palette=p;d.dataset.mode=m})()`

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
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        // Native controls follow the system until the theme sets `color-scheme` (see main.css).
        { name: 'color-scheme', content: 'light dark' },
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
  },
})
