// Waiting out the subscription's usage limit (DEV-269, AC-27.1 and AC-27.2). Sandcastle never
// retries a 429 (the spike, DEV-251): the agent reports an error and stops. The Run then starts no
// new agent step, for any ticket, until the reset time the error gives, or checks again every 15
// minutes when it gives none, and the stopped step resumes its session with "continue". Each pause
// is logged in run.json. It is not the maintainer's to deal with, so nothing tells them.
import type { Clock } from './ports.ts'
import type { RunLog } from './runlog.ts'

/** How long to wait when the error gives no reset time, before trying again. */
export const RECHECK_MS = 15 * 60_000

/** What a usage-limited step is resumed with. */
export const CONTINUE = 'continue'

/** Whether an agent's error is the usage limit (a 429), rather than another failure. */
export function isUsageLimit(message: string): boolean {
  return /\b429\b|rate[ _-]?limit|usage limit|hit your limit|limit reached/i.test(message)
}

/** The Run-wide pause: while it lasts, no agent step starts. */
export class UsageLimit {
  readonly #clock: Clock
  readonly #log: RunLog
  #until: Date | null = null

  constructor(clock: Clock, log: RunLog) {
    this.#clock = clock
    this.#log = log
  }

  /** Waits until no pause holds. */
  async wait(): Promise<void> {
    for (;;) {
      const until = this.#until
      const left = until ? until.getTime() - this.#clock.now().getTime() : 0
      if (left <= 0) return
      await this.#clock.sleep(left)
    }
  }

  /** Pauses the Run after `step` of `ticket` hit the limit, and returns until when. */
  pause(ticket: string, step: string, message: string): Date {
    const at = this.#clock.now()
    const reset = resetTime(message, at)
    const until =
      reset && reset.getTime() > at.getTime() ? reset : new Date(at.getTime() + RECHECK_MS)
    if (!this.#until || until.getTime() > this.#until.getTime()) this.#until = until
    this.#log.pause({
      ticket,
      step,
      at: at.toISOString(),
      until: until.toISOString(),
      resetGiven: reset !== undefined,
      message,
    })
    return until
  }
}

/**
 * When the limit resets, as the error gives it, or undefined when it doesn't. Claude Code has said
 * it in three ways: "Claude AI usage limit reached|<Unix seconds>", an ISO 8601 time, and
 * "resets 3pm (Europe/London)", the next such time in that zone (or the host's own).
 */
export function resetTime(message: string, now: Date): Date | undefined {
  const unix = /\|(\d{10})\b/.exec(message)?.[1]
  if (unix) return new Date(Number(unix) * 1000)
  const iso = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/.exec(
    message,
  )?.[0]
  if (iso && !Number.isNaN(Date.parse(iso))) return new Date(iso)
  const clock = /resets(?: at)? (\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*\(([^)]+)\))?/i.exec(message)
  if (!clock) return undefined
  const [, hours = '', minutes = '0', half = '', zone] = clock
  const hour = (Number(hours) % 12) + (half.toLowerCase() === 'pm' ? 12 : 0)
  return nextWallTime(now, hour, Number(minutes), zone)
}

/** The first instant after `now` when the wall clock in `zone` shows hour:minute. */
function nextWallTime(now: Date, hour: number, minute: number, zone?: string): Date | undefined {
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
  } catch {
    return undefined
  }
  /** The wall clock in `zone` at `date`, read as if it were UTC. */
  const wall = (date: Date) => {
    const part = (type: string) =>
      Number(format.formatToParts(date).find((p) => p.type === type)?.value)
    return Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
    )
  }
  const offset = wall(now) - now.getTime()
  const today = new Date(wall(now))
  const target = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    hour,
    minute,
  )
  let instant = target - offset
  if (instant <= now.getTime()) instant += 24 * 60 * 60_000
  return new Date(instant)
}
