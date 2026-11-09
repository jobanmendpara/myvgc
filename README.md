# MyVGC

A hub for tracking your Pokémon VGC experience in **Pokémon Champions**: the tournaments you played, the teams you brought, who you faced and what they brought, with notes on all of it. Teams can be exported to the official VGC teamsheet format.

MyVGC will be available as a paid hosted service and as a free, self-hostable Docker app, licensed under AGPL-3.0.

Status: early development. Accounts and Teams work: import a Champions Showdown paste, then list, view, copy and delete your Teams. See `CONTEXT.md` for domain terms, `docs/adr/` for decisions, `docs/roadmap.md` for the order of work, and `docs/risks.md` for open risks.

MyVGC is not affiliated with Nintendo, Creatures, Game Freak or The Pokémon Company.

## Self-hosting

You need Docker with Compose v2 (`docker compose version`). MyVGC runs as two containers: the app, from `ghcr.io/jobanmendpara/myvgc`, and Postgres, with its data in a Docker volume.

1. Make a folder and download the Compose file and the example settings:

   ```bash
   mkdir myvgc && cd myvgc
   ```

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/jobanmendpara/myvgc/main/compose.yaml
   ```

   ```bash
   curl -fsSL -o .env https://raw.githubusercontent.com/jobanmendpara/myvgc/main/.env.example
   ```

2. Edit `.env` and change the values marked "change me":
   - `POSTGRES_PASSWORD`: use letters and digits only, because it goes into a connection URL. `openssl rand -hex 24` makes a good one.
   - `BETTER_AUTH_SECRET`: the app won't start with the example value. Generate one with `openssl rand -base64 32`.
   - `APP_URL`: the address you'll type in the browser, such as `http://192.168.1.20:3000` or `https://vgc.example.com`.

3. Start it:

   ```bash
   docker compose up -d
   ```

4. Open your `APP_URL` and create an account. The first account becomes the admin. To stop anyone else signing up, set `ALLOW_SIGNUPS=false` in `.env` and run `docker compose up -d` again.

Database migrations run every time the app starts. `docker compose logs app` shows what it's doing, and `docker compose ps` shows whether it's healthy.

### Settings

All settings come from `.env`.

| Variable             | Default                 | What it does                                                                                                                       |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`      | `myvgc`                 | Postgres user for the database container.                                                                                          |
| `POSTGRES_PASSWORD`  | none                    | Postgres password. Letters and digits only.                                                                                        |
| `POSTGRES_DB`        | `myvgc`                 | Postgres database name.                                                                                                            |
| `BETTER_AUTH_SECRET` | none                    | Signs log-in sessions. At least 32 characters. Changing it logs everyone out.                                                      |
| `APP_URL`            | `http://localhost:3000` | The address people use to reach MyVGC, exactly as typed in the browser. Log-ins only work from it; `https://` gets secure cookies. |
| `ALLOW_SIGNUPS`      | `true`                  | Set to `false` to refuse new accounts. The first account can always be created.                                                    |
| `PORT`               | `3000`                  | Port the app listens on, and the port Compose publishes.                                                                           |
| `MYVGC_VERSION`      | `latest`                | Which published image to run, such as `0.1.0`.                                                                                     |
| `DATABASE_URL`       | none                    | Only used outside Compose (development, or running the image on its own). Compose builds it from the `POSTGRES_*` values.          |
| `UPLOADS_DIR`        | `/data/uploads`         | Where uploaded Teamsheet PDFs are kept. Compose puts `/data` on the `uploads` volume; `pnpm dev` uses `.data/uploads`.             |

To serve MyVGC over HTTPS, put a reverse proxy such as Caddy or nginx in front of port 3000 and set `APP_URL` to the `https://` address. The copy-paste button needs HTTPS or `localhost`; elsewhere it shows the paste for you to copy by hand.

### Upgrading

```bash
docker compose pull
```

```bash
docker compose up -d
```

Before pulling, compare your `compose.yaml` with the one in the release you're moving to and copy over any changes. The release that adds Teamsheet uploads adds the `uploads` volume; without it, uploaded PDFs sit in an unnamed volume that `docker compose down -v` deletes.

New migrations run when the app restarts. To stay on one release, set `MYVGC_VERSION` (for example `0.1.0`) instead of `latest`. Take a backup first.

### Backing up and restoring

Back up the database to a file in the current folder (these commands use the default `POSTGRES_USER` and `POSTGRES_DB`; change `-U` and `-d` if you changed them):

```bash
docker compose exec -T db pg_dump -U myvgc -d myvgc --format=custom > "myvgc-$(date +%F).dump"
```

To restore a backup, stop the app so nothing writes while the data is replaced, restore, then start it again:

```bash
docker compose stop app
```

```bash
docker compose exec -T db pg_restore -U myvgc -d myvgc --clean --if-exists --no-owner < myvgc-2026-11-03.dump
```

```bash
docker compose start app
```

Uploaded Teamsheet PDFs live in the `uploads` volume, not the database, so back them up too:

```bash
docker compose exec -T app tar -C /data -cf - uploads > "myvgc-uploads-$(date +%F).tar"
```

To restore them, with the app running (after restoring the database):

```bash
docker compose exec -T app tar -C /data -xf - < myvgc-uploads-2026-11-03.tar
```

Keep copies of `.env` as well: without `BETTER_AUTH_SECRET` a restored install logs everyone out, and without `POSTGRES_PASSWORD` you can't reach the database.

## Development

Requires Node 24 and pnpm (`corepack enable`).

```bash
pnpm install
```

```bash
pnpm db:up   # Postgres in Docker, exposed on localhost:5432 (needs a .env copied from .env.example)
```

```bash
pnpm dev     # API on :3001, web app on :3000 proxying /api
```

`pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` are what CI runs on every push.

To run unreleased code in Docker, build the image from this checkout and run the smoke test against it:

```bash
pnpm up:local   # docker compose with compose.build.yaml: builds and starts the app and Postgres
```

```bash
pnpm smoke      # Playwright: sign up, import a Team, check its six Pokémon
```

Pushing a version tag such as `v0.1.0` runs the smoke test, then publishes the image to GHCR as `ghcr.io/jobanmendpara/myvgc:0.1.0` and `:latest`.
