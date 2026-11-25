# iOS Safari and an offline-tolerant web app: storage, service worker, updates

Researched 2026-11-20 for MyVGC (DEV-159, part of the map DEV-158). Context: ADR 17 (`docs/adr/0017-offline-tolerant-web-app.md`) and `docs/research/local-first.md`.

## How this was researched (read first)

- Nothing was run on an iPhone. Every claim about Safari's behaviour comes from a document, a bug report or source code, not from a test. The hands-on test is DEV-161; a draft checklist for it is at the end.
- Sources, all fetched on 2026-11-20: the WebKit blog and its Tracking Prevention page, WebKit Bugzilla, Apple's WWDC23 session 10120 transcript, MDN (pages and the `browser-compat-data` JSON on GitHub), web.dev, the W3C Service Workers editor's draft, the `@vite-pwa` docs, TanStack Query's docs and the source of `query-persist-client-core` (`main`), and Better Auth 1.7.15's docs and installed source in this repo's `node_modules`.
- Current versions: Safari 27.0 shipped 2026-09-17 (WebKit blog). Its release notes, and those for 26.0, 26.2, 26.4 and 26.6, were searched for changes to Home Screen web apps, storage, cookies and service workers. The only relevant items are listed below. No WebKit post since 2023 revises the storage policy, so the 2023 policy is taken as current. That is an inference from silence, and DEV-161 should confirm it.
- Bug reports are evidence of what someone saw on one version, not of current behaviour. Where a bug is the only source, this note says so.

## Summary

1. **The installed app and the Safari tab have separate storage.** Since iOS 17.2, "Add to Home Screen" copies the site's cookies into the new web app, so the User stays signed in. Nothing else is copied: no IndexedDB, no localStorage, no service worker cache. After that the two never share data again. A change queued in a Safari tab is not visible in the installed app.
2. **A Safari tab's data is deleted after 7 days without a tap.** With cross-site tracking prevention on (the default), WebKit deletes all of a site's script-written storage, including IndexedDB and service worker registrations, after 7 days of Safari use with no click, tap or key press on the site. The installed app's first-party data is exempt.
3. **`navigator.storage.persist()` mainly helps the installed app.** WebKit grants it "based on heuristics like whether the website is opened as a Home Screen Web App". A persistent origin is skipped by eviction for quota and storage pressure. Whether it also escapes the 7-day deletion in a Safari tab is not clearly stated: the sources are ambiguous.
4. **Quota is not the problem.** Since iOS 17 an origin may use up to about 60% of the disk, in Safari and in a Home Screen web app alike.
5. **The service worker serves the shell offline in both modes**, as long as the site is on HTTPS, the app opens standalone, and the fallback URL is not a redirect. Background Sync and periodic sync do not exist in Safari, so nothing replays the outbox while the app is closed.
6. **Updates arrive on a cold launch, not on a resume.** The browser checks for a new service worker on navigation. Bringing a suspended app back to the foreground is not a navigation, so the app must call `registration.update()` itself. `autoUpdate` reloads the page under the User, which can lose a half-filled Round form.
7. **The events exist but `navigator.onLine` cannot be trusted.** `visibilitychange` is fully supported (Safari 14.1+), and so are `online` and `offline`. But Wi-Fi with no internet counts as online, and `freeze` and `resume` are unsupported. No primary source covers how reliable these events are when a standalone app returns to the foreground.
8. **The session cookie survives.** Better Auth's `session_token` is an HttpOnly cookie set by the server, with a Max-Age of 7 days. Cookies set by the server are exempt from the 7-day deletion of script storage. The 7-day session expiry is a separate limit, and it is the one that applies.
9. **The biggest risks to queued changes are in our own code.** TanStack Query's persister by default deletes the whole saved client, paused mutations included, if it is older than 24 hours or its `buster` differs. ADR 17 plans to bump the buster when API shapes change. Both settings would silently drop the outbox (section 7).

## 1. Storage lifetime

### 1.1 The 7-day cap (tracking prevention)

- **What it deletes.** "deleting all of a website's script-writable storage after seven days of Safari use without user interaction on the site". The storage forms named are IndexedDB, LocalStorage, media keys, SessionStorage, and "Service Worker registrations and cache" (WebKit blog, "Full Third-Party Cookie Blocking and More", 2020-03-24, webkit.org/blog/10218).
- **What counts as interaction.** "User interaction is a user click, tap, or keyboard entry on a website." Scrolling does not count (WebKit, "Tracking Prevention in WebKit", webkit.org/tracking-prevention, undated, fetched 2026-11-20).
- **When it applies.** "Safari proactively evicts data when cross-site tracking prevention is turned on. If an origin has no user interaction, such as click or tap, in the last seven days of browser use, its data created from script will be deleted. Cookies set by server are exempt from this eviction." (MDN, "Storage quotas and eviction criteria", last modified 2026-01-05). Days count only when Safari is used: a phone left unused for a week doesn't trigger it.
- **Home Screen web apps.** "The first-party domain of home screen web applications is exempt from ITP's 7-day cap" (WebKit Tracking Prevention page). The 2020 post says the same in other words. Home Screen web apps "are not part of Safari and thus have their own counter of days of use", and that use resets the timer. It also says "If your web application does experience website data deletion, please let us know since we would consider it a serious bug." (2020-03-24).
- **A caveat: the app must really be standalone.** In WebKit bug 232302 (2021-10-26, iOS 15.0.2), a reporter's Home Screen app lost its service worker and IndexedDB after a week. Its manifest used `"display": "minimal-ui"`. John Wilander closed it WONTFIX, saying "There is no way to get an exception in Safari", and advised `standalone` or `fullscreen` so that it opens in Web.app. Since Safari 26.0 (2025-09-15, webkit.org/blog/17333), "By default, every website added to the Home Screen opens as a web app", with no manifest needed, and the User can switch off "Open as Web App" when adding it. The sources don't say what happens to a `minimal-ui` manifest under iOS 26 or later. **Use `display: 'standalone'`.**

### 1.2 Quota and eviction (iOS 17 and later)

From "Updates to Storage Policy" (WebKit blog, 2023-08-10, webkit.org/blog/14403), "Starting in Safari 17.0, and in WebKit apps for iOS 17, iPadOS 17 and macOS Sonoma":

- **Per origin.** "For a browser app, the origin quota is up to 60% of the total disk space." A Home Screen web app running standalone gets the same origin quota and overall quota as a browser app. MDN (2026-01-05) agrees: around 60% of disk for either. Safari 17 "no longer prompts users about a website wanting to use more space."
- **Overall.** Up to 80% of disk across all origins for a browser app.
- **What it covers.** "localStorage, Cache API, IndexedDB, Service Worker, and File System."
- **When eviction happens.** "when exceeding the overall quota, when the system is under storage pressure, or when the site has not been interacted with by the user for some time" (the last links to Intelligent Tracking Prevention). Deletion is whole-origin and LRU. "Origin might be excluded from eviction if it has active page at the time of eviction, or its storage is in persistent mode." "By default, all origins use a best-effort mode."
- **Superseded figures.** WebKit's 2018 service-worker post (webkit.org/blog/8090, 2018-02-07) gave a fixed 50 MiB Cache API limit and said unused registrations and caches are removed "after a few weeks". The 2023 policy replaces that quota. The sources don't say whether the "few weeks" rule for unused registrations still exists separately from the 7-day cap.

### 1.3 `navigator.storage.persist()`

- **Support.** `persist()` and `persisted()` since Safari 15.2, and `estimate()` since Safari 17, the same on iOS (MDN browser-compat-data, `api/StorageManager.json`, fetched 2026-11-20).
- **How it is granted.** "WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App." (2023-08-10). No prompt is shown (MDN). No other heuristic is documented.
- **Where the sources are silent or disagree.**
  - Does persistence exempt a Safari tab from the 7-day cap? The WebKit post lists the 7-day deletion among the eviction triggers and then says persistent origins "might be excluded". MDN instead says the exemption covers storage-pressure eviction and describes the proactive 7-day deletion with no exemption. Treat a Safari tab as unprotected.
  - WebKit bug 271401 (opened 2024-03-21, Safari 17, macOS, still NEW) reports that `persist()` always returns false, including in a Dock web app. No engineer has replied. Nothing says whether iOS Home Screen apps behave the same. **DEV-161 must record what `persist()` returns in the tab and in the installed app.**

### 1.4 What deletes the data anyway

The User deleting the Home Screen icon, or clearing website data in Settings, is not covered by any primary source found. Presumably it deletes the data, so DEV-161 should treat it as an open item to confirm, not as a fact.

## 2. Is storage shared between the Safari tab and the installed app?

- "Home Screen web apps have a standalone, app-like experience on iOS, with separate cookies and storage from the browser." (WWDC23 session 10120, "What's new in web apps", 2023-06).
- Since iOS 17.2 and iPadOS 17.2, tapping "Add to Home Screen" (from Safari, SFSafariViewController or another browser) copies the cookies, "including the information about login state". But "No other kind of local storage is copied over", and after that "no other website data is shared" (WebKit blog, "WebKit Features in Safari 17.2", 2023-12-11, webkit.org/blog/14787).
- WWDC23 adds that local storage is not copied, so a site keeping part of its authentication in local storage makes the User sign in again. It also says that signing in later in the browser does not sign the User into a web app already added, since "cookies and storage are separate after the web app is added". The session says this about Dock apps on macOS; the 17.2 post brings the same copying to iOS.

**Consequences for MyVGC:**
- The installed app opens signed in, because Better Auth's session lives in a cookie.
- The installed app starts with an empty query cache, an empty outbox and no "last known User" (DEV-45), because those live in script storage. Until the installed app has been online once, DEV-45's offline start has nothing to fall back on.
- Changes queued in a Safari tab stay in Safari. They sync only when the tab is reopened, and they are subject to the 7-day cap.
- Old iOS 12 note: WebKit bug 190269 reported that the service worker was shared between Safari and the Home Screen app but its cache was not. The 2023 statements above supersede it.

## 3. Service worker

- **Support.** Service workers have been in iOS since 11.3, "in Safari, in apps using SFSafariViewController, and in web apps saved to the home screen" (webkit.org/blog/8090, 2018-02-07; BCD: `ServiceWorkerRegistration` since Safari 11.1). "Home Screen web apps on iOS and iPadOS never required Service Workers" (Safari 26.0 post): installing doesn't depend on one, but working offline does.
- **Secure context.** "Only secure contexts are allowed to register service workers" (MDN, "Secure contexts", last modified 2026-09-14). `localhost` and `127.0.0.0/8` count as secure, but **a LAN address such as `http://192.168.1.10` does not**. `pnpm dev:lan` over plain HTTP therefore cannot test the service worker on an iPhone (see DEV-161). WebKit bug 228702, a duplicate of 225083, mentions an untrusted certificate breaking a PWA offline, so the certificate must be trusted on the phone.
- **Opening offline.** WebKit bug 225083: "REGRESSION (iOS 14.5): Home Screen Apps with Service Workers intermittently fail to open offline", fixed 2021-04-30 (r276845). It is the latest such bug found, which shows the mode has broken before. Test a cold launch offline.
- **`navigateFallback` must not be a redirect.** In WebKit bug 190041 (2018-09-27, Workbox on iOS 12), youenn fablet (WebKit) explained that the service worker fetched `index.html`, which redirected, and "the navigation does not expect a redirected response as per spec", so the page failed with "Response served by service worker has redirections". It was closed CONFIGURATION CHANGED on 2019-01-04. MyVGC's `navigateFallback: '/'` is served by `apps/api/src/static.ts` as `c.html(indexHtml)` with a 200, so it should be fine. Check that no proxy in front redirects `/` or adds a trailing slash.
- **No background replay.** BCD lists `SyncManager`, `ServiceWorkerRegistration.sync` and `periodicSync` as `version_added: false` in Safari and iOS (fetched 2026-11-20). ADR 17's choice of replaying in the foreground stands.
- **Recent fixes (no action, worth knowing).** Safari 26.6 (2026-07-27) and 27.0 (2026-09-17) fixed registrations with missing main or imported scripts not being unregistered, which had stopped re-registration. Safari 27.0 adds the Service Worker static routing API and fixes several IndexedDB bugs, among them transactions "blocked for an extended period before starting".

## 4. Updates

- **When the browser checks.** An update check runs on "A navigation to an in-scope page", and on functional events such as `push` and `sync` unless one ran in the previous 24 hours. The browser ignores HTTP caching headers for the service worker script by default, but honours them for `importScripts()` (web.dev, "The service worker lifecycle", Jake Archibald). The spec's `updateViaCache` "is initially set to "imports"" (W3C Service Workers editor's draft, 2026-11-17). Safari supports `updateViaCache` and `update()` since 11.1 (BCD).
- **Waiting.** "the updated worker will `wait` until the existing worker is controlling zero clients … refreshing the page isn't enough" unless `skipWaiting()` is used (web.dev).
- **iOS specifics.** WebKit bug 199110 (2019-06-21) reported that a Home Screen app kept old assets after a deploy. On 2022-05-02 youenn fablet found the cause: "when the network process stops between app runs, the waiting service worker never activates". It was fixed in r293676 and shipped in iOS 16.0 (Brent Fulgham, 2025-01-30). A commenter on the same bug (not a WebKit engineer) said iOS never unloads the PWA, so it never navigates again. No primary source says how long iOS keeps a suspended web app alive. In practice an app resumed from the background has done no navigation, so the browser hasn't checked for updates.
- **`@vite-pwa/nuxt` modes.**
  - `autoUpdate`: "the plugin will force `workbox.clientsClaim` and `workbox.skipWaiting` to `true`", and it reloads open pages. Its own docs warn that "the user can lose data in any browser windows/tabs in which the application is open and is filling in a form", and they recommend the default `prompt` for apps with forms (vite-pwa-org.netlify.app/guide/auto-update).
  - `prompt`: `onNeedRefresh` shows a dialog, and calling `updateSW()` reloads with the new version (guide/prompt-for-update).
  - Periodic checks: call `r.update()` on an interval from `onRegisteredSW`. The docs' robust version first fetches `swUrl` with `cache: 'no-store'` and skips the check when offline (guide/periodic-sw-updates). Neither page covers resuming from the background.
- **For MyVGC:** call `registration.update()` when `visibilitychange` turns `visible` (and on an interval), and use `prompt`, or `autoUpdate` only when no form has unsaved input and the outbox has been written to disk (section 7). DEV-158 still has to settle how the User is told an update is ready.

## 5. Events the outbox relies on

- **`visibilitychange`.** BCD gives full support from Safari 14.1, with iOS the same. Earlier versions didn't fire it when navigating away (use `pagehide`), and before 14 it didn't bubble to `window`. MDN (last modified 2026-10-26): moving to `hidden` "is the last event that's reliably observable by the page". `freeze` and `resume` (Page Lifecycle) are `version_added: false` in Safari.
- **`online` and `offline`.** Both fire on `window` when `navigator.onLine` changes. But MDN (2026-11-13) warns that "connection to LAN is considered online, even though the LAN may not have Internet access … this property is inherently unreliable, and you should not disable features based on the online status". Venue Wi-Fi with a captive portal or no uplink will look online.
- **Standalone apps returning to the foreground.** No primary source says whether these events fire reliably then. The only bug found is old: WebKit bug 202399 (2019-10-01, iOS 13), where `visibilitychange` fired in the wrong Home Screen apps. It was closed as a duplicate of a fixed bug on 2022-02-12. **DEV-161 must log these events.**
- **For MyVGC:** treat `online` and `visible` only as hints to try a replay. Decide offline from a failed or timed-out request, not from `navigator.onLine`. Also retry on a timer while there are pending changes and the page is visible.

## 6. Cookies and the session

- **What Better Auth sets.** Better Auth 1.7.15 (installed here, `dist/cookies/index.mjs`) sets the `session_token` cookie with `maxAge: options.session?.expiresIn || sec("7d")`. That makes it a persistent cookie, not a session cookie, unless the User chose not to be remembered. Cookies are "httpOnly and secure when the server is running in production mode" (better-auth.com/docs/concepts/cookies). "The session expires after 7 days by default", and the expiry is pushed forward when the session is used past `updateAge` (docs, session management). MyVGC's `apps/api/src/auth.ts` changes neither setting.
- **The 7-day cap doesn't touch it.** It is set by the server, so it is exempt from the script-storage deletion (MDN). The Tracking Prevention page's separate 7-day limit on HTTP cookies applies only to responses detected as CNAME or IP cloaking, which a first-party self-hosted install is not.
- **Shared with Safari?** It is copied into the Home Screen app at install (iOS 17.2+), then kept separately (section 2). Signing out in one doesn't sign out the other.
- **A known bug.** WebKit bug 272325, "REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app" (opened 2024-04-08, still NEW, rdar 126138221). Brady Eidson (WebKit) believed he reproduced it on iOS 17.5 but not on the iOS 18 beta. A government-site developer reported stale cookies for about 0.35% of iPhone users on iOS 18.1 (2024-11-13). Its status on iOS 26 or 27 is unknown. With DEV-45, a cookie lost this way turns into a 401, and queued writes wait for sign-in, so nothing is lost.
- **Expiry is the real limit.** A User who doesn't open the app for more than 7 days is signed out, whatever iOS does. The writes stay queued (ADR 17), but they can't be sent until the User signs in again.

## 7. Our own code: the TanStack persister

From `packages/query-persist-client-core/src/persist.ts` (TanStack Query `main`, fetched 2026-11-20) and the docs:

- **Both checks delete everything.** `persistQueryClientRestore` defaults to `maxAge = 24 * 60 * 60 * 1000` and `buster = ''`. If the saved client is expired or busted, it calls `persister.removeClient()`, which deletes **the whole persisted client, paused mutations included**. The docs add that it does this silently.
  - A User who queues Rounds at an event and doesn't open the app for 24 hours loses them on the next launch.
  - A release that bumps the buster, as ADR 17 plans ("a version string that is bumped when API shapes change"), deletes every queued change on every phone.
- **The persister writes at most once a second.** The timestamp is refreshed on every save. `createAsyncStoragePersister` throttles saves with `throttleTime = 1000` ms. A reload (for example `autoUpdate`) or a kill within that second can lose the last change.
- **Fix it in DEV-48.** Persist the outbox (paused mutations) separately from the query cache, or at least restore with `maxAge: Infinity` for mutations. Version outbox entries on their own, and migrate or flag them rather than drop them on a buster change. Write a queued change to IndexedDB before showing it as "saved on this phone".

## What decides whether queued changes survive on an iPhone

1. **Where they were queued.** In the installed app (standalone), the first-party data is exempt from the 7-day cap and probably gets persistent storage. In a Safari tab, the data is deleted after 7 days of Safari use without a tap on the site, and isn't visible to the installed app. **Install the app, and open it once online, before the event.**
2. **Whether the outbox is written to IndexedDB before the User is told it's saved**, and whether a reload, an update or iOS killing the app can happen inside the persister's throttle window.
3. **Whether our persister throws it away.** The 24-hour `maxAge` and buster bumps both delete paused mutations unless DEV-48 changes them.
4. **Whether the app is opened again.** There is no background replay on iOS. Replay happens only when the User opens or resumes the app with a working connection, and the code mustn't trust `navigator.onLine`.
5. **Whether the session is still valid.** After 7 days without use, Better Auth's session has expired, and queued writes wait for sign-in.
6. **Storage pressure, the User deleting the app, or clearing website data.** The first can be reduced with `persist()`; the other two can't be reduced at all, and need confirming on a device.

## Draft checklist for DEV-161 (hands-on iPhone test)

Record the iOS and Safari version first. Add a debug panel to the throwaway build showing: build id; `navigator.serviceWorker.controller` state; `await navigator.storage.persisted()` and the result of `persist()`; `estimate()`; `navigator.onLine`; `matchMedia('(display-mode: standalone)')`; a timestamped log of `visibilitychange`, `pageshow`, `pagehide`, `online` and `offline`; and the number of entries in the outbox and the cache.

**A. Setup**
- [ ] Serve over **HTTPS with a certificate the iPhone trusts**. `http://<LAN IP>` from `pnpm dev:lan` won't register a service worker. Use a tunnel with a real certificate, or a local CA installed and trusted on the phone.
- [ ] The manifest has `display: 'standalone'`, and `/` answers 200 with no redirect.

**B. Safari tab**
- [ ] Sign in, visit the current Tournament and the Opponents list, and reload once so the service worker controls the page.
- [ ] What do `persist()` and `persisted()` return in the tab?
- [ ] Turn on Airplane mode. Do visited pages open, and does a cold load of the site open?

**C. Install**
- [ ] Add to Home Screen. Is "Open as Web App" on? Does the app open standalone and signed in (cookie copied)?
- [ ] Is the cache empty in the app (expected), and does the tab's data stay in the tab?
- [ ] What do `persist()` and `persisted()` return in the app?

**D. Offline in the installed app**
- [ ] With the app open once online, kill it, turn on Airplane mode and cold-launch it. Does the shell open, with the last known User and the cached pages?
- [ ] Log a Round offline. Kill the app straight away (within 1 second), relaunch, and check whether the change is still pending.
- [ ] Restart the phone while offline, relaunch, and check whether the change is still pending.

**E. Events**
- [ ] In the foreground, toggle Airplane mode. Do `offline` and `online` fire?
- [ ] Background the app, toggle Airplane mode, and foreground it. Which events fire, in what order, and does replay start?
- [ ] Join Wi-Fi with no internet (a phone hotspot with no data). What is `navigator.onLine`, and does the outbox cope?

**F. Updates**
- [ ] Ship build 2. Resume the app from the background: is the new build picked up, with and without a `registration.update()` on `visible`?
- [ ] Kill the app and cold-launch it: is the new build picked up on the first launch, or the second?
- [ ] With a pending change and a half-filled Round form, does the update (prompt or auto) keep both?

**G. Storage over time**
- [ ] Leave the installed app unopened for 8 or more days while using Safari daily. Are its data and service worker intact?
- [ ] Leave a Safari tab's site untouched for 8 or more days of Safari use. Is its data gone, as expected? Does `persisted()` being true change that?
- [ ] Optional: after more than 7 days unused, check that the session has expired and that queued writes survive sign-in.

## Suggested changes to DEV-45, DEV-46 and DEV-48

**DEV-45 (start and stay signed in)**
- Store the last known User in script storage, together with the cache (both live and die together). Note that it **isn't copied when the app is installed**: the installed app needs one online launch before it can start offline. The app should say so, for example "open once with a connection before the event".
- The session cookie survives iOS's 7-day deletion and is copied at install (iOS 17.2+). The 7-day session expiry is the real limit. Consider whether 7 days fits Users who log only at events; any change is a decision for the maintainer.

**DEV-46 (installable app shell)**
- Set `display: 'standalone'` (bug 232302).
- Prefer `registerType: 'prompt'`, or gate the reload on no unsaved form input and a flushed outbox, which `@vite-pwa`'s own docs advise for apps with forms. This feeds DEV-158's open item on how the User is told an update is ready.
- Call `registration.update()` on `visibilitychange` to `visible`, and on an interval.
- Serve `sw.js` with `Cache-Control: no-cache`, and keep `navigateFallback` a 200 response, not a redirect.
- Add to "Not yet tested": the Chromium smoke test doesn't stand in for iOS. Point to DEV-161, which needs HTTPS.

**DEV-48 (queued writes and sync status)**
- Change the persister so paused mutations are **not** discarded by `maxAge` (default 24 hours) or by a buster bump. ADR 17's "version string bumped when API shapes change" must apply to the query cache only, and outbox entries need their own version and migration. This probably warrants a line in the ADR 17 amendment that DEV-158 already expects.
- Write a queued change to IndexedDB before marking it "saved on this phone". Flush before any update reload.
- Don't trust `navigator.onLine`: use `online` and `visible` as triggers, decide offline from a failed or timed-out request, and retry on a timer while pending and visible.
- Scope "survives a reload and a restart" to the installed app. In a Safari tab, iOS deletes the data after 7 days of Safari use without a visit. Tell iPhone Users to install, and request `persist()` from the installed app.
