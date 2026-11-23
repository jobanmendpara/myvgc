import { RETRY_INTERVAL } from './outbox-rules'

// When the outbox tries to send what is pending (ADR 17): as the app opens, whenever it becomes
// visible or the browser says it is back online, and on a timer while writes are pending and the
// page is visible. `online` is only a hint: a request that fails decides the server can't be
// reached. Nothing runs in the background, as iOS has no Background Sync.

export interface TriggerOptions {
  /** Tries to send what is pending. */
  tryNow: () => void
  /** Whether any write is waiting to be sent. */
  hasPending: () => boolean
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
  interval?: number
}

/** Starts trying as the app opens, and from then on as above. Returns a function that stops. */
export function watchOutboxTriggers({
  tryNow,
  hasPending,
  win = window,
  doc = document,
  interval = RETRY_INTERVAL,
}: TriggerOptions) {
  const visible = () => doc.visibilityState === 'visible'
  const onVisibility = () => {
    if (visible()) tryNow()
  }
  const onOnline = () => tryNow()
  doc.addEventListener('visibilitychange', onVisibility)
  win.addEventListener('online', onOnline)
  const timer = setInterval(() => {
    if (visible() && hasPending()) tryNow()
  }, interval)
  tryNow()
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    win.removeEventListener('online', onOnline)
    clearInterval(timer)
  }
}
