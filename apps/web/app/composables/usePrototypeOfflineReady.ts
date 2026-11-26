/**
 * PROTOTYPE (DEV-246), throwaway: never merge to main. Three ways to tell the User when MyVGC is
 * ready to use offline, switchable from the floating prototype bar (← and → also switch):
 * - A, "Toast": a card in the corner that comes and goes.
 * - B, "Header": a short line next to the header's Offline mark, then a lasting cloud mark.
 * - C, "Settings page": an Offline section on Settings, with a dot on the Account menu until seen.
 *
 * The bar also picks when it shows (first visit only, or after every update too), how much
 * progress it shows (none, busy, file count) and the wording. Its Replay buttons fake a slow
 * download (about 15 seconds) and touch nothing else: no cache, Query data or outbox is cleared.
 *
 * It only reads the service worker's events (DEV-245 owns the set-up): when a real install is
 * under way, the notice follows it and counts the precache's entries. `nuxt dev` registers no
 * service worker, so on the prototype's servers only Replay shows it.
 *
 * The choices are kept in this browser under `myvgc-prototype-dev246`, so they survive moving
 * between pages; `?variant=A|B|C` on any address sets the variant.
 */
export type Variant = 'A' | 'B' | 'C'
export type When = 'first' | 'every'
export type Progress = 'none' | 'busy' | 'count'
export type Wording = 1 | 2 | 3
export type Phase = 'idle' | 'downloading' | 'ready'
export type Reason = 'first' | 'update'

export const VARIANTS: Variant[] = ['A', 'B', 'C']
export const VARIANT_LABELS: Record<Variant, string> = {
  A: 'Toast',
  B: 'Header',
  C: 'Settings page',
}
export const WHEN_LABELS: Record<When, string> = {
  first: 'First visit only',
  every: 'Every update too',
}
export const PROGRESS_LABELS: Record<Progress, string> = {
  none: 'None',
  busy: 'Busy',
  count: 'File count',
}

/** Each wording set: the line while downloading, and the line once done, per reason. */
export const WORDINGS: Record<
  Wording,
  { downloading: Record<Reason, string>; ready: Record<Reason, string>; short: string }
> = {
  1: {
    downloading: {
      first: 'Getting ready to use offline',
      update: 'Getting the new version ready to use offline',
    },
    ready: { first: 'Ready to use offline', update: 'New version ready to use offline' },
    short: 'Ready to use offline',
  },
  2: {
    downloading: {
      first: 'Saving MyVGC to this device',
      update: 'Saving the new version to this device',
    },
    ready: {
      first: 'MyVGC now works with no signal',
      update: 'The new version works with no signal',
    },
    short: 'Works with no signal',
  },
  3: {
    downloading: { first: 'Downloading for offline use', update: 'Downloading the update' },
    ready: {
      first: 'Saved on this device: you can lose the signal now',
      update: 'Update saved on this device',
    },
    short: 'Saved for offline',
  },
}

const STORAGE_KEY = 'myvgc-prototype-dev246'
const FAKE_TOTAL = 690
const FAKE_SECONDS = 15

interface Choices {
  variant: Variant
  when: When
  progress: Progress
  wording: Wording
}

function loadChoices(): Choices {
  const fallback: Choices = { variant: 'A', when: 'first', progress: 'count', wording: 1 }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return { ...fallback, ...stored }
  } catch {
    return fallback
  }
}

export function usePrototypeOfflineReady() {
  const choices = useState<Choices>('prototype-dev246-choices', loadChoices)
  const phase = useState<Phase>('prototype-dev246-phase', () => 'idle')
  const reason = useState<Reason>('prototype-dev246-reason', () => 'first')
  const done = useState('prototype-dev246-done', () => 0)
  const total = useState('prototype-dev246-total', () => FAKE_TOTAL)
  const source = useState<'replay' | 'service worker' | 'none'>(
    'prototype-dev246-source',
    () => 'none',
  )
  /** Bumped on every start, so a variant can show its notice again. */
  const runId = useState('prototype-dev246-run', () => 0)
  /** Variant C: the Account menu's dot, until the User opens Settings. */
  const unseen = useState('prototype-dev246-unseen', () => false)

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choices.value))
    } catch {}
  }
  function set<K extends keyof Choices>(key: K, value: Choices[K]) {
    choices.value = { ...choices.value, [key]: value }
    save()
  }

  /** Whether this run's notice is shown at all, given When. */
  const shown = computed(() => reason.value === 'first' || choices.value.when === 'every')

  const percent = computed(() =>
    total.value ? Math.min(100, Math.round((done.value / total.value) * 100)) : 0,
  )

  function start(next: Reason, from: 'replay' | 'service worker', of = FAKE_TOTAL) {
    reason.value = next
    source.value = from
    total.value = of
    done.value = 0
    phase.value = 'downloading'
    runId.value++
    if (shown.value) unseen.value = true
  }
  function finish() {
    done.value = total.value
    phase.value = 'ready'
  }

  let timer: ReturnType<typeof setInterval> | undefined
  function replay(next: Reason) {
    clearInterval(timer)
    start(next, 'replay')
    // Uneven speed, as on a slow signal: bursts and stalls.
    const started = Date.now()
    timer = setInterval(() => {
      const t = (Date.now() - started) / 1000 / FAKE_SECONDS
      const eased = Math.min(1, t + 0.04 * Math.sin(t * 20))
      done.value = Math.max(done.value, Math.floor(eased * total.value))
      if (t >= 1) {
        clearInterval(timer)
        finish()
      }
    }, 120)
  }

  return {
    choices,
    set,
    phase,
    reason,
    done,
    total,
    percent,
    source,
    runId,
    unseen,
    shown,
    replay,
    start,
    finish,
  }
}

/**
 * Follows a real service worker install, reading its events only. Called once, from the
 * prototype bar. The precache's size is counted from sw.js; entries from its Workbox cache.
 */
export function watchRealServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const notice = usePrototypeOfflineReady()

  async function precacheTotal() {
    try {
      const text = await (await fetch('/sw.js')).text()
      return text.match(/url:\s*"/g)?.length ?? FAKE_TOTAL
    } catch {
      return FAKE_TOTAL
    }
  }
  async function precacheDone() {
    const keys = await caches.keys()
    const name = keys.find((key) => key.includes('precache'))
    return name ? (await (await caches.open(name)).keys()).length : 0
  }

  function follow(worker: ServiceWorker, reason: Reason) {
    void precacheTotal().then((of) => {
      notice.start(reason, 'service worker', of)
      const poll = setInterval(async () => {
        notice.done.value = Math.min(of, await precacheDone())
      }, 300)
      worker.addEventListener('statechange', () => {
        // A first install activates; an update waits as "installed" for the Update banner.
        if (worker.state === 'activated' || (reason === 'update' && worker.state === 'installed')) {
          clearInterval(poll)
          notice.finish()
        }
        if (worker.state === 'redundant') clearInterval(poll)
      })
    })
  }

  let watched: ServiceWorkerRegistration | undefined
  function watch(registration: ServiceWorkerRegistration | undefined) {
    if (!registration || registration === watched) return
    watched = registration
    const watchFound = () => {
      const worker = registration.installing
      if (worker) follow(worker, registration.active ? 'update' : 'first')
    }
    if (registration.installing) watchFound()
    registration.addEventListener('updatefound', watchFound)
  }
  // Registered already, or about to be (the PWA module's hook).
  void navigator.serviceWorker.getRegistration().then(watch)
  useNuxtApp().hooks.hook('service-worker:registered', ({ registration }) => watch(registration))
}
