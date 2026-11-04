# Local-first for MyVGC: fit, changes, issue impact, technology and hosting

Researched 2026-11-04 for MyVGC.

## How this was researched (read first)

Outbound network worked for docs sites, `raw.githubusercontent.com`, `git clone` and the npm registry. The GitHub REST API (`api.github.com`) returned 403, so repositories were cloned instead. Nothing was run against a real browser, so every claim about browser behaviour comes from documentation, not from a test.

**Primary sources read in full** (the pages or files cited, not whole repositories):

- This repo: `CLAUDE.md`, `CONTEXT.md`, `docs/roadmap.md`, `docs/risks.md`, ADRs 1, 2, 3, 4, 5, 7, 8, 9, 11, 13, 14 and 15, `apps/web/app/middleware/auth.global.ts`, `apps/web/app/plugins/vue-query.ts`, `apps/web/app/lib/auth-client.ts`, `apps/web/nuxt.config.ts`, `apps/api/src/static.ts`, `apps/api/src/routes/dashboard.ts`, `packages/core/src/champions.ts` and `schema.ts`, the three `package.json` files, `compose.yaml`, `Dockerfile`, and `.scratch/tournaments/issues/05-*.md`. ADRs 6, 10, 12 and 16 were read only as Linear document excerpts and the roadmap's references to them.
- **Linear** (team DEV, project MyVGC), through the Linear MCP: all 13 issues (DEV-30 to DEV-42) with descriptions, and the 16 ADR mirror documents (excerpts only). No issue was edited.
- **Shallow clones** at these commits: `TanStack/db` 8feab6e (2026-11-03), `TanStack/query` f69b28a (2026-11-04), `electric-sql/electric` 3f9809f (2026-10-06), `electric-sql/pglite` bac163e (2026-11-03), `powersync-ja/powersync-service` ddf748c (2026-11-03), `powersync-ja/powersync-js` 6b4c432, `powersync-ja/powersync-docs` 3981d0b (2026-11-03), `rocicorp/mono` fbdb27e (2026-10-31), `pubkey/rxdb` dd1a117, `garden-co/jazz` aea073c, `evoluhq/evolu` 41f4fba, `livestorejs/livestore` 85ddd7c, `aspen-cloud/triplit` d3029ee (2025-09-10), `vite-pwa/nuxt` 468ebee, `vite-pwa/docs` cb8886e, `better-auth/better-auth` d92e973, `drizzle-team/drizzle-orm-docs` 7f7f847. I read the licence files, READMEs and the specific docs pages cited below.
- **Web pages fetched as text**: zero.rocicorp.dev (Status, When to Use, Authentication, and the start of Writing Data), replicache.dev, electric-sql.com/cloud, powersync.com/pricing (a vendor marketing page that can change), the WebKit storage-policy post (2023-08-10), MDN's storage-quota page and Background Synchronization page, and MDN's browser-compat-data JSON for `SyncManager`.
- **npm registry metadata** (version, licence, peer dependencies) for the packages named below, and the `drizzle-orm@0.45.4` tarball (to read its PGlite migrator).
- **One measurement I ran**: names-only reference data from `@pkmn/dex@0.10.13` and `@pkmn/mods@0.10.13` (section 2.4).

**Not verified, and labelled where it matters:**

- How often players have no signal at an event. No source exists; section 1.2 reasons from the product and marks it **[unverified]**.
- Whether `@vite-pwa/nuxt` 1.1.1 works with Nuxt 4.6. Its docs and README say "Nuxt 3", and its declared compatibility is `>=3.6.5` **[unverified]**.
- The YJS, Automerge and Loro internals, and Evolu's, Jazz's and Triplit's server designs beyond their READMEs and licence files.
- Real-world size and speed of PGlite on iPhone, and any hosting cost figure that is not on a vendor page. Costs in section 5 are my estimates and are marked **[estimate]**.
- Not read: RxDB's premium licence text.

Labels: **[snippet]** means I only saw an excerpt; **[secondary]** means a non-primary source; **[unverified]** means unchecked; **[estimate]** means my arithmetic. Unlabelled claims were read in the cited primary source.

## Summary

- **Recommendation: do not go full local-first (tier C). Build tier B: an offline-tolerant PWA with a queued-write outbox, scoped to the one job that needs it, logging a Round at an event.** Keep Postgres, Hono and the server as the single authority.
- **Fit.** MyVGC's data is the textbook easy case for local-first: single-user, private, tiny, with no collaboration. But three things are against paying for a sync engine now: the offline need is unproven **[unverified]**; the sync-engine market is unsettled (section 3); and the server holds real rules (unique Round numbers, validation in `packages/core`, snapshots) that a sync layer would have to re-express.
- **Reference data is a smaller obstacle than the brief assumed.** Display names for every Champions species, move, item and ability are about 13 KB gzipped (measured, section 2.4). Only paste parsing needs the roughly 900 KB Showdown data (figure from `CLAUDE.md`), and that can stay online-only.
- **The real blocker is auth.** `auth.global.ts` aborts every navigation with a 503 "Can't reach the MyVGC server" when the session check fails. Today the app cannot start without the network.
- **Sync engines, ranked for this stack if tier C is ever needed:** PowerSync (Apache-2.0 service, Postgres source, writes go through your own API, Vue composables Beta, Nuxt module Alpha), then TanStack DB with Electric or the Query collection. Rule out Zero (its own docs say it is not local-first and has no offline writes; no Vue binding), Replicache (maintenance mode), Triplit (AGPL, last commit 2025-09-10), Jazz (2.0 alpha), LiveStore (0.5, event-sourced) and Evolu (own relay, not Postgres).
- **Vendor risk is live.** On 2026-08-11 Electric announced it joined Databricks and that **Electric Cloud is winding down**. The open-source code (Apache-2.0) stays, but "use Electric Cloud for the paid tier" is no longer an option.
- **ADRs.** Tier B needs one new ADR. Tier C would contradict ADRs 4, 8, 11, 13 and 15 in part, and ADR 5 if a "local-only, no server" mode is offered.
- **Triggers to move up to C:** evidence of lost data at events, a need for instant multi-device sync, a decision to offer local-only use, or TanStack DB reaching GA with a settled maintainer.

---

## 1. Is local-first a good fit?

### 1.1 What the application is, from the repo

| Property | Evidence | Pushes toward local-first? |
|---|---|---|
| Every record belongs to one User; "nothing is shared between Users" | `CONTEXT.md` (User), ADR 5 | Yes: no multi-user conflicts, no per-row sharing rules |
| Tiny data: tens of Tournaments, hundreds of Rounds, Teams of 6 builds | `CONTEXT.md`, spec user stories | Yes. A rough size is under 1 MB per User **[estimate]** |
| Phone first; logging a Round "in a few taps" between Rounds | `docs/roadmap.md`, DEV-32 | Yes, if the phone has poor signal |
| Self-hosting is first-class; one edition, no paid-only features | ADR 1, ADR 2, roadmap | Neutral: any engine must be self-hostable under AGPL-compatible terms |
| Postgres only; self-host is app plus Postgres | ADR 4, ADR 15, `compose.yaml` | Against: sync engines add a service or a second database |
| Accounts everywhere, Better Auth sessions | ADR 5, ADR 7 | Against: login and sessions assume a server |
| Server-side rules: unique `(tournament, round_number)` and `(tournament, stage)`; Opponents created in the same transaction as a Round; ownership checks | `apps/api/src/db/round-schema.ts`, `.scratch/tournaments/issues/05-*.md` | Against: these become sync conflicts |
| Domain logic is pure and I/O-free in `packages/core` (`summarize()` for the dashboard, Round rules, calendar) | ADR 8, `apps/api/src/routes/dashboard.ts` | Yes: it can run in the browser unchanged |
| Reference data for display names comes from the API | `CLAUDE.md`, `packages/core/src/schema.ts` | Needs a plan, see 2.4 |
| Immutable Team snapshots | ADR 9 | Yes: insert-only data cannot conflict |

### 1.2 How real is the offline need?

**[unverified]** I found no data on connectivity at Premier Challenges, Regionals or local game stores, and did not look for any. The product reasoning is: events are often in basements, convention halls or stores, and the User logs between Rounds with a phone. A slow or absent connection there is plausible, and the failure is severe, because the User forgets the Round or gives up. The needed offline surface is narrow:

1. open the app and the current Tournament,
2. search Opponents by name or Alias,
3. create an Opponent on the spot,
4. log, edit or delete a Round,
5. see the Record update.

Team building, paste import, the dashboard, signing up and account recovery all happen at home and can stay online-only. **Before building anything, the cheapest test is to ask the user (and a few players) how often they hit this**, or to log failed requests from the app.

### 1.3 Verdict

Local-first as a *philosophy* fits (private, small, personal, phone-based, ownership is a selling point). Local-first as a *full architecture* (a client database that is the source of truth, plus a sync engine) is more than the offline need requires, and it fights two ADRs and the solo-developer constraint (ADR 3: "solo and wants fast progress in familiar tools"). The offline need is solved by tier B at a fraction of the cost. Section 7 compares the tiers.

### 1.4 Conflict model for this domain

- Each User's data lives in one private space. The only conflicts are **the same User on two devices** (phone at the event, laptop later), or one device replaying a queue after a long gap.
- Most records are written once and edited rarely. Per-record last-write-wins using a server-assigned version or `updatedAt` is enough. CRDTs (Yjs, Automerge, Loro; all MIT per npm metadata) solve concurrent editing of shared text and lists, which this app does not have, so they add cost without benefit. The one exception is the Markdown Notes field, where two devices editing the same note would lose one edit under LWW. That is rare and acceptable, or can be handled by keeping the losing version as a conflict copy.
- Team snapshots (ADR 9) are frozen copies, so they are insert-only and cannot conflict.
- **The real hotspot is derived uniqueness:** two devices both adding "Swiss Round 3" to the same Tournament hit `round_tournament_number_key`. Today the API answers 409. Offline, the replay must either reassign the next free number (when the User did not type it) or ask the User. This is a server rule that every sync engine would also need to implement as a custom write handler (see PowerSync's "custom conflict resolution" page).

---

## 2. What changes would be needed?

Each subsection gives the work for tier B first, then the extra work for tier C.

### 2.1 Application shell and service worker

**Tier B.**
- Add `@vite-pwa/nuxt` (MIT, 1.1.1 per npm; wraps Workbox, generates the service worker and manifest, offers update prompts). Its docs are written for Nuxt 3, so a spike must confirm it works with the repo's Nuxt 4.6 **[unverified]**. Plain `vite-plugin-pwa` 2.0.0 (MIT, peers Vite up to 8) is the fallback.
- Precache the generated SPA. `apps/api/src/static.ts` already serves `index.html` for any non-`/api` GET, which suits a service worker's navigation fallback. The service worker file must be served at the site root and not cached long-term by the browser (a deployment detail to test).
- Do **not** let the service worker cache `/api/*` responses. API data belongs in the TanStack Query cache (2.2), so logout and account switching can clear it deterministically. The vite-pwa docs show how to exclude routes (`navigateFallbackDenylist`) and note that excluded routes then fail offline.

**Tier C:** the same, plus a client database and its WASM files in the precache (PGlite is about 3 MB gzipped per its README; Drizzle's PGlite page says 2.6 MB, so the figure has grown).

### 2.2 Offline reads and queued writes

**Tier B.**
- TanStack Query (v5.105.3 here, the same major as `apps/web`) documents three network modes. With the default `online`, queries and mutations pause without a connection. `offlineFirst` runs the function once and then pauses retries, intended for when a service worker or HTTP cache answers. Paused mutations can be persisted and resumed: `dehydrate`, then `resumePausedMutations()` after hydration.
- Persisted mutations can only resume after a reload if a default `mutationFn` is registered for each mutation key (TanStack Query "Persisting Offline mutations" docs). Mutation `scope` ids run mutations in series, which is what you want for ordered Round writes.
- There is **no `vue-query-persist-client` package** in the TanStack Query repo (React, Solid, Svelte, Preact and Angular have one), but `@tanstack/query-persist-client-core` (5.105.3, MIT) is framework-agnostic and works with an async persister over IndexedDB. The `experimental_createQueryPersister` variant is explicitly experimental; the `persistQueryClient` utilities are not marked so.
- **Replay must run when the app is foregrounded**, not from the service worker. The Background Synchronization API is Chromium-only: MDN's compat data lists `SyncManager` as supported from Chrome 49 and `version_added: false` for Firefox and Safari (including iOS). Use the `online` event and `visibilitychange`.
- Server changes: accept **client-generated UUIDs** for Tournaments, Rounds and Opponents (the columns are already `uuid`), and make creates **idempotent** (replaying the same id returns the existing row). Implement the Round-number rule from 1.4. This is Hono-only code and is testable with `app.request()` against PGlite, so ADR 13 holds unchanged.
- UI: show "saved on this phone, not yet synced", a pending count, and a way to see a rejected write (for example a 422 from validation) and fix or discard it.

**Tier C:** replace the mutation queue and the query cache with a local database and an engine (section 3). The REST routes become either the engine's upload endpoint or are called by it.

### 2.3 Authentication

This is the part that must change in both tiers.

- `apps/web/app/middleware/auth.global.ts` calls `authClient.getSession` with an 8-second timeout and, on failure, **aborts the navigation with a 503 error page**. Offline start-up is impossible until this changes.
- Better Auth sessions last 7 days by default and are renewed when used past `updateAge` (1 day) (Better Auth session-management docs). The cookie is the credential, and the client cannot read it offline.
- Proposed behaviour: when the session check **fails to reach the server** (not when it returns "logged out"), fall back to a last-known `{ id, name }` stored in `localStorage`, let the app run on cached data, and keep writes queued. A queued write that later gets **401** stays queued and the User is asked to log in again; it is never dropped.
- Better Auth's `session.cookieCache` is a signed short-lived cookie that lets the **server** skip a database lookup. It is not an offline-login mechanism, and its docs warn that revoked sessions stay valid until the cache expires.
- Per-User scoping of the local cache: key the persisted store by user id, and clear it on logout. Zero's docs make the same point (they segregate client storage by `userID`), and note that on a shared computer anyone can read the stored data. The same applies to a shared family phone; offer a "clear data on this device" action.
- Account deletion (GDPR-style erasure): the server deletes rows (`onDelete: cascade` from `user` is already in the schema). Local copies are only erased when the device next connects and sees a 401 or an "account deleted" response; the app should wipe local storage on that signal. State this limit in the privacy text.

### 2.4 Reference data (Showdown) and the "names come from the API" decision

`CLAUDE.md` says `@myvgc/core` loads Showdown data (about 900 KB gzipped), so the web app imports only `@myvgc/core/schema` and receives display names from the API (`nameBuild` in `routes/teams.ts` and `routes/tournaments.ts`). Consequences offline:

- **Reading** Teams and Tournament snapshots offline works in tier B for free: the names are inside the cached API responses.
- **Pickers for new data** (an Opponent Team entered by choosing species, the Team builder DEV-33) need the list of valid species, moves, items and abilities. Today there is no such endpoint.
- **I measured the names-only table**: for Champions (`@pkmn/dex` 0.10.13 with `@pkmn/mods` `champions`, entries that exist and are not marked non-standard) it holds 392 species and forms, 515 moves, 166 items and 317 abilities, **36 KB raw and 13 KB gzipped**. The 900 KB is dominated by learnsets, stats and legality data that pickers do not need.
- Recommendation: add one API endpoint (or a build-time static JSON from `packages/core`) that returns this names table, cache it in the service worker or the persisted query cache, and keep `@myvgc/core` out of the web bundle. That preserves the ADR 14 decision (IDs stored, names looked up) and the `@myvgc/core/schema` split.
- **Paste import** (parsing, error messages, Stat Point validation) needs the full data. Keep it online-only: ADR 14 requires line-by-line validation against the pinned Champions data. Shipping 900 KB to every phone for a task done at home is poor value. A later option is a lazy-loaded, separately cached chunk.

### 2.5 Schema evolution on the client

- **Tier B:** no client schema. The persisted query cache carries a `buster` string (TanStack docs: a cache without the matching `buster` is discarded), so each release that changes API shapes can bump it. The outbox entries are the only versioned client data; give them a version field and drop or migrate old ones.
- **Tier C:** a client database needs migrations on every device. Drizzle's PGlite migrator (`drizzle-orm/pglite/migrator`) calls `readMigrationFiles`, which imports `node:fs` (read in the 0.45.4 tarball), so it cannot run in a browser as is. The migration objects would need to be bundled and passed to the dialect directly **[unverified that this works]**. PowerSync instead derives a client schema from sync rules and keeps the server's Postgres migrations separate.

### 2.6 Search, PDF Teamsheet, export, backup

- **Opponent and Alias search** is a server-side `ilike` today (`routes/opponents.ts`). Offline, filter the cached Opponent list in the client. With hundreds of Opponents that is trivial. The roadmap's "Merge duplicate Opponents" (DEV-36) must be online-only or queued as one atomic command.
- **Teamsheet generation (DEV-31)** is blocked on verifying the official format (`docs/risks.md`). If the generator runs in `packages/core` with no I/O, it could run in the browser; if it needs a PDF library or a template fetch, cache that asset. Not an offline-at-the-venue need, so low priority.
- **Export and backup (DEV-39)** becomes more important, not less: with data on the phone, users want a file they hold. A JSON export is the natural local-first escape hatch and is already on the roadmap (and `pg_dump` remains the self-hoster's backup, ADR 15).

### 2.7 Testing (ADR 13)

- Tier B keeps ADR 13: API idempotency and the Round-number rule are tested through `app.request()` against PGlite.
- The outbox should be a small pure module (queue, retry, give-up rules) tested with Vitest. `apps/web` has no `test` script today, so adding one is part of the work.
- The existing Playwright smoke test can add one offline case with `context.setOffline(true)` **[unverified in this repo; standard Playwright feature]**.
- Tier C needs sync tests with two clients and a conflict, which the PGlite-based API tests do not cover; PowerSync and TanStack DB ship their own adapter conformance suites (`db-adapter-conformance` package in the TanStack DB repo).

---

## 3. Technology evaluation

All versions and dates are from the sources listed at the top; the table gives the licence, status, and fit against the constraints (AGPL-compatible, Postgres, docker-compose self-host, Hono, Vue/Nuxt).

| Candidate | Licence | Status (today) | Postgres | Self-host | Vue / Nuxt | Offline writes | Verdict |
|---|---|---|---|---|---|---|---|
| **TanStack Query persist + mutation queue** | MIT | 5.105.3, stable | n/a (any API) | nothing extra | Yes (already used) | Yes (paused mutations, persisted) | **Use (tier B)** |
| **@vite-pwa/nuxt / vite-plugin-pwa** | MIT | 1.1.1 / 2.0.0 | n/a | nothing extra | Yes, Nuxt 3 documented; Nuxt 4 **[unverified]** | n/a (shell only) | **Use (tier B)** |
| **TanStack DB** | MIT | **1.0.0-rc.1.3**; `@tanstack/vue-db` same version; `@tanstack/offline-transactions` 1.2.0 | Via collections (Query, Electric, PowerSync, RxDB, IndexedDB, SQLite persistence) | n/a | `vue-db` exists | Yes, outbox package | Best *client layer* if C; still RC |
| **Electric** (sync engine) | Apache-2.0 | client 1.5.28; Electric "joining Databricks" 2026-08-11; **Cloud winding down** | Postgres 14+, needs logical replication | One extra container, `wal_level=logical`, persistent storage dir | Framework-agnostic HTTP client | **No: read-path only**, writes via your API | Viable self-host, but strategic risk |
| **PGlite** (client Postgres) | Apache-2.0 | 0.5.15, README badge "alpha" | It *is* Postgres | n/a | Agnostic | n/a | Only for tier C; Safari caveat |
| **PowerSync** | Service Apache-2.0 (all `LICENSE` files read); SDKs Apache-2.0 | Service 1.x; Web SDK 2.6.0; Vue composables **Beta**; Nuxt module **Alpha** | Postgres, MongoDB, MySQL, SQL Server sources | `journeyapps/powersync-service` image plus a bucket-storage DB (MongoDB or Postgres, GA) | `@powersync/vue`, `@powersync/nuxt` | **Yes**; uploads via your own API | **Best fit if C** |
| **Zero** (Rocicorp) | Apache-2.0 | v1 GA March 2026 | Yes | Yes | **React, Solid, React Native only** | **No** (their words) | Rule out |
| **Replicache** | Repo Apache-2.0; npm field points to a custom "roci.dev/terms" page | 15.3.0, **maintenance mode** | Bring your own | n/a | Agnostic | Yes | Rule out |
| **RxDB** | Core Apache-2.0; best browser storages are **paid "premium" plugins** | 17.6.0 | Via custom HTTP replication or Supabase plugin | Your own endpoints in Hono | Lists `vue` as an optional peer dependency | Yes | Skip (paid storage plugin, adds a data model) |
| **Jazz** | MIT | **2.0.0-alpha.59**, "entirely new API" | Own storage and sync server per its README (Postgres not mentioned) | Own sync server | Vue binding listed | Yes | Rule out (alpha) |
| **Evolu** | MIT | `@evolu/common` 8.27.1 | No: relay stores to SQLite | Docker relay image | `@evolu/vue` package | Yes | Rule out (relay is SQLite, not Postgres) |
| **LiveStore** | Apache-2.0 | 0.5.0 | Providers: Cloudflare, ElectricSQL, S2, custom | Depends on provider | Vue getting-started page | Yes | Rule out (event sourcing replaces the CRUD API) |
| **Triplit** | **AGPL-3.0** | repo last commit **2025-09-10** | No | Own server | n/a | Yes | Rule out (stale) |
| **Yjs / Automerge / Loro** | MIT (npm metadata) | 13.6.x / 3.5.0 / 1.17.1 | n/a | n/a | Agnostic | Yes (CRDT merge) | Not needed (no concurrent editing) |
| **Dexie / IndexedDB** | Apache-2.0 (Dexie) | 4.4.7 | n/a | n/a | Agnostic | Storage only | Fine as a persister backend; sync is a separate paid Dexie Cloud (README) |
| **SQLite WASM (wa-sqlite)** | MIT (both upstream and PowerSync's fork) | n/a | n/a | n/a | Agnostic | Storage only | Comes inside PowerSync/TanStack DB persistence |

### Notes that drive the verdicts

1. **Electric is read-path only.** Its README says: "Electric is a read-path sync engine for Postgres." Its writes guide: "Electric does not do write-path sync" and offers four patterns (online writes, optimistic state, shared persistent optimistic state, through-the-database). For MyVGC, Electric would stream shapes to the client and the existing Hono routes would remain the write path, which suits `CLAUDE.md`'s "all API code lives in Hono". Shapes are single-table, with subqueries for filtering (shapes guide), so Tournaments and their Rounds are separate shapes. Auth is done by proxying shape requests through your API (auth guide). **Operational cost:** Postgres must run with logical replication and the Electric container needs a persistent storage directory (deployment guide), so the self-host compose goes from two services to three and the Postgres command changes.
2. **Electric's corporate change.** The blog post "Electric is joining Databricks" (2026-08-11) says: everything previously open sourced, including Postgres Sync, PGlite and TanStack DB, "stays open source"; "Electric Cloud is winding down. Cloud users will need to self-host or move to another provider"; and "Electric will be building with Neon inside Databricks". PGlite and TanStack DB depend on the same people and organisation, so their long-term stewardship is an open question **[unverified]**; the licences themselves are permissive.
3. **TanStack DB** is the neat client layer: live queries, optimistic mutations, a Vue adapter, a QueryCollection that wraps your existing REST endpoints, and an offline-transactions outbox. It is at 1.0 release candidate ("Migrating to the 1.0 RC" is the first link in its overview). Its `@tanstack/offline-transactions` package requires the server to accept the same idempotency key on repeated requests, which is the same server change as tier B (2.2). That makes tier B a sound stepping stone: the idempotent API is needed either way.
4. **PowerSync** matches the stack best: Postgres source with logical replication, client SQLite (WASM), writes uploaded by your `uploadData()` to *your* API, which "must be blocking/synchronous" and applied directly to Postgres (PowerSync writing-client-changes docs), so Hono routes stay the write path with their validation. The service's own state needs a bucket-storage database, MongoDB or Postgres (GA); a second Postgres database in the same instance would probably do **[unverified]**. Caveats: the Vue composables are Beta and the Nuxt module Alpha (feature-status and Nuxt pages); the PowerSync Dashboard is not available when self-hosting, and an "Enterprise Self-Hosted Edition" with advanced functionality exists for custom pricing (self-hosting page), which is in tension with ADR 1's "no paid-only features" only if MyVGC needed those features. The client database is SQLite, not Postgres, so Drizzle's Postgres schema is not shared with the client (ADR 4 is bent on the client side).
5. **Zero** says of itself: "Zero is not local-first... It's a client-server system with an authoritative server" and "Zero doesn't support offline writes" (When to Use). Its docs list React, SolidJS and React Native integrations only.
6. **PGlite** as the client database is attractive on paper (same Postgres dialect, a Drizzle driver, already in `apps/api` devDependencies for tests). Its docs recommend the IndexedDB filesystem in the browser because **the OPFS filesystem does not work in Safari** ("a limit of 252 open sync access handles... a standard Postgres install consists of over 300 files"). It is single-connection, so multiple tabs need its leader-election worker. Its sync plugin is alpha and "doesn't yet support local writes being synced out". Reasoning: iPhone users are likely a large share of the audience, so a Safari-first caveat is disqualifying for tier C today. Also, I did not measure startup time on a phone.
7. **TanStack DB + IndexedDB/SQLite persistence:** TanStack DB's IndexedDB collection "loads its entire object store into memory", fine at this data size, and its docs state "Caching the app for offline startup and synchronizing data across devices require separate setup", so it still needs the service worker from 2.1.

---

## 4. Which technologies work well with the current stack?

**Tier B (recommended now)**

| Need | Choice | Why it fits |
|---|---|---|
| Offline shell | `@vite-pwa/nuxt` (fallback `vite-plugin-pwa`) | Static SPA output (ADR 11) is exactly what a precache wants; no `server/` folder needed |
| Cache and queue | TanStack Query persistence core plus paused mutations | Already installed; Vue-compatible; no new data model |
| Local storage | IndexedDB through a small async persister (Dexie is Apache-2.0 per npm; a hand-written wrapper over IndexedDB also works) | Survives reloads; works in Safari; no WASM |
| Idempotent writes | Client UUIDs and `PUT`-style creates in Hono | Same API, tested with `app.request()` (ADR 13) |
| Reference names | One cached names endpoint (about 13 KB gzipped) | Keeps `@myvgc/core` out of the web bundle |
| Request persistence | `navigator.storage.persist()` | Browsers may evict best-effort storage (MDN); WebKit evicts by least-recently-used origin and its policy post says best-effort is the default, with persistent mode available on request |

**Tier C (only if triggers fire)**

- Preferred: **PowerSync** (service in compose, Postgres sync source, uploads through Hono) with `@powersync/vue`. Accept Beta/Alpha Vue status or write a thin wrapper.
- Alternative: **TanStack DB** on top of a QueryCollection (keeps REST, no new service) or an Electric collection (adds Electric and logical replication). Wait for GA.
- Do not adopt PGlite as the client store until Safari support is settled.

---

## 5. Hosted (paid) versus self-hosted

| Question | Tier B | Tier C |
|---|---|---|
| **Containers in compose** (ADR 4, 8, 15) | Unchanged: app plus Postgres | Plus one sync service (PowerSync or Electric); Postgres needs `wal_level=logical` and a replication role; PowerSync also needs a storage database |
| **ADR 1: one edition, no paid-only features** | Fully satisfied | Satisfied if the engine is Apache-2.0 and self-hostable; PowerSync's Enterprise Self-Hosted Edition adds paid functionality that MyVGC must not depend on |
| **AGPL interplay** | No new licences (MIT/Apache) | Apache-2.0 components (PowerSync, Electric, PGlite) are compatible with AGPL code; Triplit (AGPL) and RxDB's premium plugins would need a licence review |
| **Vendor dependence for the paid tier** | None | PowerSync Cloud: Free tier 2 GB synced and 500 MB hosted per month with up to 50 concurrent clients; Pro from $49/month (vendor pricing page, can change). Electric Cloud: no longer an option. The alternative is running the same service yourself, adding an operational duty to the paid tier |
| **Operating cost** | The same API and database cost as today; a service worker adds static file egress only | Extra service plus replication storage, plus per-User sync egress. At under 1 MB per User **[estimate]** the egress is negligible; the fixed cost of an extra always-on service is not |
| **Backup and portability** | `pg_dump` (ADR 15); JSON export (DEV-39) | Same, plus the question of what a "backup" is when the device and server can disagree |
| **Support burden** | Low: "pending sync" and "log in again" messages | Higher: stuck syncs, schema drift between app and device, per-device state, storage eviction on iOS |
| **Selling point** | "Works at the venue" | "Your data lives on your device" (data ownership, no lock-in) |
| **Local-only mode with no server** | Not possible | Technically possible, but it **contradicts ADR 5** (accounts everywhere, no "is there a user?" branches) and ADR 4 if the client store is SQLite or IndexedDB without Postgres. It also makes "every feature works self-hosted" ambiguous. Recommend against until there is demand |

Roadmap check: "Hosted-only concerns (billing, payment provider, plans, usage limits) wait until after the self-hosted release." Tier B adds no hosted-only concern. Tier C would pull infrastructure decisions (sync vendor, per-User limits) into the first hosted design interview (DEV-40).

---

## 6. Impact on existing Linear issues

Source: Linear team DEV, project MyVGC, 13 issues, read 2026-11-04. `roadmap.md` agrees with these issues item for item. Two observations:

- DEV-32 "Tournaments, Rounds and Opponents" is still in **Todo**, but the repo already contains the Tournaments and Rounds code, migrations 0003 to 0006 and `.scratch/tournaments/issues/05-*.md` marked `done`. Linear looks behind the repo.
- No issue mentions offline or sync today.

"B" means the recommended tier B; "C" means full local-first.

| Issue | Title | Tier B | Tier C | Reason |
|---|---|---|---|---|
| DEV-30 | Verify the official Champions Teamsheet format | Unaffected | Unaffected | Research chore about an external document |
| DEV-31 | Teamsheet export from a Team | Unaffected | Reshaped | B: server or client generation both work, online. C: generation must run on the client from local data |
| DEV-32 | Tournaments, Rounds and Opponents | **Reshaped** | Reshaped | B: add client IDs, idempotent creates, Round-number reassignment, and the offline Round-logging flow to the Rounds slice. Phone-first requirement is the reason. C: whole slice moves onto a client database |
| DEV-33 | Form-based Team builder | Reshaped (small) | Reshaped | Needs the names table for pickers (2.4); stays online-only in B |
| DEV-34 | Record individual Games in a Round | Unaffected | Reshaped | In B it is more fields on a Round that uses the same outbox. In C it is another synced table |
| DEV-35 | Dated note entries on Opponents | Unaffected | Reshaped | Append-only entries are naturally conflict-free, which makes them easy in both tiers |
| DEV-36 | Merge duplicate Opponents | Unaffected | **Blocked** until a merge rule exists | B: online-only. C: merging offline across two devices rewrites foreign keys that other devices still reference |
| DEV-37 | Store uploaded Teamsheet PDFs as attachments | Unaffected | Reshaped | Binary uploads stay server-side in B. In C, uploads need a separate queue because sync engines do not carry files |
| DEV-38 | Read uploaded PDFs and screenshots into Teams | Unaffected | Unaffected | Server-side OCR or vision, online by nature; output passes ADR 14 validation either way |
| DEV-39 | Export and import a User's data as JSON | Unaffected, **raised in value** | **Raised in value**, reshaped | B: a file the User holds is the escape hatch for data on a phone. C: it becomes the migration path between local and server |
| DEV-40 | Hosted service: billing and operations | Unaffected | **Reshaped** | C adds a sync vendor or service, per-User limits and egress to the design interview |
| DEV-41 | Revisit Nintendo and Pokémon Company IP | Unaffected | Reshaped | C copies Showdown-style data onto user devices; the fan-content review should cover that |
| DEV-42 | Decide whether to check Team legality against a Regulation | Unaffected | Reshaped | Legality needs the full Showdown data client-side if checked offline |

**Not obsoleted:** no issue becomes obsolete under either tier. Suggested new issues (not created): "Offline Round logging (PWA, outbox, idempotent writes)", "Offline-tolerant sign-in", "Names endpoint for pickers", and a Decision issue for the local-first tier ADR.

---

## 7. Three tiers compared

| | **A. Status quo online SPA** | **B. Offline-tolerant PWA with queued writes** | **C. Full local-first with a sync engine** |
|---|---|---|---|
| Works with no signal at the venue | No: the app shows "Can't reach the server" | Yes for the Round-logging path; reads of cached pages | Yes, everywhere |
| Cost to build | None | Small: shell, persisted cache, outbox, idempotent API, auth fallback | Large: engine, client schema and migrations, auth scoping, sync rules, new tests |
| New infrastructure | None | None | One or two services, logical replication |
| ADR changes | None | 1 new ADR | Several amendments, plus a decision on local-only mode |
| Fit with ADR 1, 2, 4, 5, 8, 11, 13, 15 | Full | Full | Bends 4, 8, 11, 13, 15 (and 5 for local-only) |
| Conflict handling | None needed | Per-record, server decides; Round-number rule | Engine's model plus custom rules |
| Maturity risk | None | Low: stable libraries | High: RC or Beta/Alpha pieces, Electric Cloud closing |
| iOS/Safari risk | None | Low: IndexedDB, shell cache | Higher: PGlite OPFS unsupported on Safari |
| Support burden | Lowest | Low | Highest |
| Selling point | None | "Works at events" | "Own your data" |

### Recommendation

**Move to tier B, and do it as part of finishing the Rounds experience (DEV-32), not as a separate project.** Concretely, in order:

1. Make the auth middleware tolerate an unreachable server (the first blocker).
2. Client-generated IDs and idempotent create/update/delete for Tournaments, Rounds and Opponents, with the Round-number reassignment rule, all tested through `app.request()`.
3. Service worker and manifest; persisted query cache; paused-mutation outbox with foreground replay.
4. A names endpoint of about 13 KB gzipped for pickers.
5. "Saved on this phone" UI, and `navigator.storage.persist()`.
6. JSON export (DEV-39) soon after, as the user-held backup.

Do not adopt a sync engine for sync's sake. The idempotent API from step 2 is the same prerequisite TanStack DB's offline outbox lists, so no work is wasted if you later move up.

### Triggers to move up to tier C

- Measured or reported data loss or friction at events that the outbox does not fix.
- Users switching between phone and laptop mid-event and wanting live agreement (not just eventual).
- A product decision to offer **local-only use** or a "your data stays on your device" tier.
- `@tanstack/db` reaching 1.0 GA with a stable maintainer, or PowerSync's Nuxt module leaving Alpha, or Safari-ready PGlite persistence.
- Hosted traffic where read egress or API load dominates cost.

### ADRs to write

1. **New ADR (tier B): "Offline-tolerant web app with a queued-write outbox".** It records: client-generated IDs and idempotent writes as API contract; Hono remains the only write path (consistent with ADR 11 and `CLAUDE.md`); local data is a cache and the server stays authoritative; the offline scope (Round logging, Opponent search, reading cached pages); online-only items (sign-up, paste import, Team building, dashboard); the auth fallback; and the data-clearing policy for logout and account deletion. It supplements ADR 5 and ADR 7 without contradicting them.
2. **If tier C is chosen later**, separate ADRs: (a) the sync engine and the client store, which amends **ADR 4** (Postgres only) if the client store is SQLite and **ADR 8 and 15** (compose and image) for the extra service; (b) sync authorisation and write validation in Hono, which amends **ADR 11**; (c) the client-side testing strategy, which amends **ADR 13**; and (d) only if offered, a "local-only mode", which contradicts **ADR 5** and needs its own decision.

ADRs 1, 2, 3, 9 and 14 hold under all three tiers.
