# 11. A standalone Hono API serves the Nuxt front end

Date: 2026-11-03
Status: Accepted

## Context
Nuxt's own server (Nitro) could host the API, but that ties the API to the front end.

## Decision
- The front end is Nuxt running as a single-page app (`ssr: false`), built with `nuxi generate` into static files.
- `apps/api` is a standalone Hono app. In production, one Node process serves `/api` and the generated static files, with a fallback to `index.html` for client-side routes.
- In development, Nuxt's dev server proxies `/api` to Hono, and a single `pnpm dev` starts both.
- Nuxt's `server/` folder is not used. All API code lives in Hono.

## Consequences
- Future clients (mobile apps, screenshot-reading tools, scripts) use the same API.
- The API can be tested with `app.request()`, without Nuxt.
- Nuxt modules that require server rendering can't be used.
