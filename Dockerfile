# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# Build the API bundle and the static web app.
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --offline
RUN pnpm build

# The runtime image needs no node_modules: the API is bundled into one file.
# The layout mirrors the repository so the server finds its migrations and the web app.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
# The team list and font Teamsheet export fills in (ADR 18, ADR 25).
COPY --from=build /app/apps/api/assets ./apps/api/assets
COPY --from=build /app/apps/web/.output/public ./apps/web/.output/public
# Uploaded files (ADR 27). A volume, so they outlive the container; compose.yaml names it.
ENV UPLOADS_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "--enable-source-maps", "apps/api/dist/server.js"]
