import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RETRY_INTERVAL } from '../app/lib/outbox-rules'
import { watchOutboxTriggers } from '../app/lib/outbox-triggers'

/** A page whose visibility the test sets. */
function fakePage() {
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  })
  return { win: new EventTarget(), doc }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('When the outbox tries to send', () => {
  it('tries as the app opens, when it becomes visible and when it comes back online', () => {
    const { win, doc } = fakePage()
    const tryNow = vi.fn()
    const stop = watchOutboxTriggers({ tryNow, hasPending: () => false, win, doc })
    expect(tryNow).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(tryNow).toHaveBeenCalledTimes(1)
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(tryNow).toHaveBeenCalledTimes(2)

    win.dispatchEvent(new Event('online'))
    expect(tryNow).toHaveBeenCalledTimes(3)

    stop()
    win.dispatchEvent(new Event('online'))
    expect(tryNow).toHaveBeenCalledTimes(3)
  })

  it('tries every 30 seconds, only while writes are pending and the page is visible', () => {
    const { win, doc } = fakePage()
    const tryNow = vi.fn()
    let pending = false
    const stop = watchOutboxTriggers({ tryNow, hasPending: () => pending, win, doc })
    tryNow.mockClear()

    vi.advanceTimersByTime(RETRY_INTERVAL)
    expect(tryNow).not.toHaveBeenCalled()

    pending = true
    vi.advanceTimersByTime(RETRY_INTERVAL)
    expect(tryNow).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'hidden'
    vi.advanceTimersByTime(RETRY_INTERVAL * 3)
    expect(tryNow).toHaveBeenCalledTimes(1)
    expect(RETRY_INTERVAL).toBe(30_000)
    stop()
  })
})
