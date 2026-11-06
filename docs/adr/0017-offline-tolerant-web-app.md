# 17. Offline-tolerant web app with a queued-write outbox

Date: 2026-11-04 (amended 2026-11-05 for each species' own abilities, DEV-51, and base stats, DEV-50, and Note entries, DEV-35)
Status: Accepted

## Context
Roadmap principle: phone first. A User logs a Round between Rounds at an event, in venues that tend to lack a signal (the project owner's experience). Today the web app cannot start without the server: the auth middleware aborts every navigation with a 503 when the session check can't be reached. A failed save also loses the Round.

We considered full local-first (a client database as the source of truth, plus a sync engine). The research in `docs/research/local-first.md` found it larger than the need. It adds a service to Compose, bends ADRs 4, 8, 11, 13 and 15, and leans on immature pieces (TanStack DB is a release candidate, PowerSync's Vue composables are Beta and its Nuxt module Alpha, Electric Cloud is winding down, PGlite's browser storage doesn't work in Safari). The data is private to one User, so conflicts only arise when the same User uses two devices. The offline need comes from the owner's experience, not measured data.

## Decision
Make the web app offline-tolerant, not local-first. The server and Postgres stay the only authority; the browser keeps a cache and a queue of pending writes.

- **Offline scope.** Open the app, read cached pages, search Opponents by name or Alias, create an Opponent, log, edit or delete a Round, with the Record updating, and add, edit or delete an Opponent's Note entries. Sign-up, account recovery, paste import, Team building and the dashboard stay online-only.
- **Hono stays the only write path.** Writes use the existing routes. Tournaments, Rounds, Opponents and Note entries accept client-generated UUIDs (as does the new Opponent a Round adds), and creates are idempotent: replaying an id returns the existing row with a 200, and an id held by another User answers 409. Deletes are idempotent too: deleting something already gone, or not the User's, answers as done and removes nothing of anyone else's. An edit of a record that no longer exists still answers 404, since the server can't tell deleted from never existed; the outbox treats that as settled.
- **Server settles conflicts per record.** The server's version wins. If a replayed Round collides on its Swiss round number and the User didn't type that number (the client leaves `roundNumber` out), the server assigns the next free one; otherwise it answers 409 and the User resolves it. A Top cut stage already logged also answers 409. These 409s name the field, like a 400, so the Round form shows the message next to it.
- **Outbox.** TanStack Query persists the query cache and paused mutations to IndexedDB. Mutations on one Tournament run in series, as do mutations on one Opponent's Note entries. Replay runs when the app is foregrounded or the browser comes back online, not from the service worker (Background Sync is Chromium-only). A write rejected by validation stays visible so the User can fix or discard it; a write that gets a 401 stays queued until the User logs in again. Nothing is dropped silently.
- **App shell.** A service worker precaches the generated SPA (`@vite-pwa/nuxt`, which a spike confirmed builds and serves the shell offline on Nuxt 4.6.4). It never caches `/api/*`; API data lives only in the Query cache.
- **Auth.** When the session check can't reach the server, the app uses the last known User stored on the device instead of showing the 503 page. A reply of "logged out" still logs out.
- **Reference names.** One endpoint (or build-time JSON from `packages/core`) returns display names for species, moves, items and abilities, plus each species' own abilities and base stats (for stat values), about 23 KB gzipped, and is cached for pickers. `@myvgc/core` stays out of the web bundle, and ADR 14 still holds (IDs stored, names looked up). Paste import keeps validating on the server.
- **Local data is per User and disposable.** The cache is keyed by user id, cleared on logout, and has a "clear data on this device" action. The app asks the browser for persistent storage. The cache carries a version string that is bumped when API shapes change.

## Consequences
- No new containers, licences or client database. Compose, the image and the tests (ADR 13: Vitest plus `app.request()` against PGlite) stay as they are. The outbox logic is a small pure module with Vitest tests, which needs a `test` script in `apps/web`.
- Contradicts no ADR. It supplements ADR 5 and ADR 7, because accounts and sessions still exist everywhere.
- DEV-32 grows by client IDs, idempotent writes and the offline Round-logging flow. DEV-33 needs the names endpoint. DEV-39 (JSON export) matters more, since data now sits on phones.
- Account deletion removes server rows at once, but a device's local copy is only wiped when it next connects and sees the deletion. The privacy text must say so. On a shared device, anyone can read the cache until it is cleared.
- Browsers may evict storage, so a queued write can be lost on a device that is never reopened. The persistent-storage request reduces this risk but doesn't remove it.
- Two devices still only agree eventually, not live.
- Not yet tested: Safari/iOS, install-to-home-screen, the update flow, and serving the service worker through Hono (it must come from the site root and not be cached long-term).
- Move to full local-first (a new ADR that amends 4, 8, 11, 13 and 15) only if one of these happens: data lost at events despite the outbox, a need for live agreement between devices, a decision to offer local-only use (which would also contradict ADR 5), or the sync pieces maturing (TanStack DB GA, PowerSync's Nuxt module leaving Alpha, Safari-ready PGlite). The idempotent API built here is the same prerequisite a later sync engine needs.
