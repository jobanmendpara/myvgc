# MyVGC

A hub for tracking your Pokémon VGC experience in **Pokémon Champions**: the tournaments you played, the teams you brought, who you faced and what they brought, with notes on all of it. Teams can be exported to the official VGC teamsheet format.

MyVGC will be available as a paid hosted service and as a free, self-hostable Docker app, licensed under AGPL-3.0.

Status: planning. See `CONTEXT.md` for domain terms, `docs/adr/` for decisions, `docs/roadmap.md` for the order of work, and `docs/risks.md` for open risks.

MyVGC is not affiliated with Nintendo, Creatures, Game Freak or The Pokémon Company.

## Running it

Copy `.env.example` to `.env`, change the values marked "change me", then:

```bash
docker compose up --build
```

The app is served at `http://localhost:3000`, and database migrations run when it starts.

## Development

Requires Node 24 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm db:up   # Postgres in Docker, exposed on localhost:5432
pnpm dev     # API on :3001, web app on :3000 proxying /api
```
