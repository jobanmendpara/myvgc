// Working a spec's whole frontier (How a factory Run works, DEV-253; DEV-285). At most two tickets
// are in flight at once, so the Docker VM and the subscription's limits hold: each sandbox holds a
// slot from its creation to its close, and a ticket is claimed only with a slot in hand, which
// its first sandbox then holds. A ticket waiting on CI has closed its sandbox, so it holds no
// slot; the sandbox a CI fix round or a rebase needs waits for one, ahead of claiming another
// ticket. After every merge the frontier is read again, so a ticket the merge unblocks is claimed
// in the same Run. The Run ends when nothing is takeable and nothing is in flight.
import { frontier } from './frontier.ts'
import type { Sandbox, Sandboxes, Ticket } from './ports.ts'
import type { TicketOutcome } from './run.ts'

/** How many tickets may hold a sandbox at once. */
export const SLOTS = 2

interface Slot {
  /** Frees the slot; any call after the first does nothing. */
  release(): void
}

/** A fixed number of slots. A slot freed while someone waits goes to the first who waits. */
class Slots {
  #free: number
  readonly #waiting: ((slot: Slot) => void)[] = []
  readonly #freed: () => void

  /** `freed` is called whenever a slot becomes free with nobody waiting for it. */
  constructor(count: number, freed: () => void) {
    this.#free = count
    this.#freed = freed
  }

  /** A slot now, or null when none is free or someone already waits for one. */
  tryTake(): Slot | null {
    if (this.#free === 0 || this.#waiting.length > 0) return null
    this.#free -= 1
    return this.#slot()
  }

  /** A slot, once one is free. */
  take(): Promise<Slot> {
    const slot = this.tryTake()
    return slot ? Promise.resolve(slot) : new Promise((resolve) => this.#waiting.push(resolve))
  }

  #slot(): Slot {
    let held = true
    return {
      release: () => {
        if (!held) return
        held = false
        const next = this.#waiting.shift()
        if (next) return next(this.#slot())
        this.#free += 1
        this.#freed()
      },
    }
  }
}

/**
 * The Sandboxes a ticket's turn uses: each sandbox takes a slot (the first one the slot the
 * ticket was claimed with) and frees it on close.
 */
function slotted(sandboxes: Sandboxes, slots: Slots, claimedWith: Slot): Sandboxes {
  let first: Slot | undefined = claimedWith
  return {
    async create(options) {
      const slot = first ?? (await slots.take())
      first = undefined
      let sandbox: Sandbox
      try {
        sandbox = await sandboxes.create(options)
      } catch (error) {
        slot.release()
        throw error
      }
      return {
        worktreePath: sandbox.worktreePath,
        exec: (command, execOptions) => sandbox.exec(command, execOptions),
        runAgent: (step) => sandbox.runAgent(step),
        async close() {
          try {
            await sandbox.close()
          } finally {
            slot.release()
          }
        },
      }
    },
  }
}

export interface FrontierWork {
  /** The tickets to take, in order: the frontier when the Run starts, or the `--only` ticket. */
  takeable: Ticket[]
  /** Reads the spec's tickets again, after a merge. Absent with `--only`, which takes no more. */
  reread?: () => Promise<Ticket[]>
  sandboxes: Sandboxes
  /** Works one ticket's turn, making its sandboxes with `sandboxes`. */
  work: (ticket: Ticket, sandboxes: Sandboxes) => Promise<TicketOutcome>
}

/** How one ticket's turn in the Run ended. */
export interface TicketResult {
  ticket: Ticket
  outcome: TicketOutcome
}

/**
 * Works the tickets, two at a time, until nothing is takeable and nothing is in flight. When a
 * turn or a reading of the frontier throws, it takes no more tickets, lets the turns in flight
 * finish, then throws that error.
 */
export async function workFrontier({
  takeable: initial,
  reread,
  sandboxes,
  work,
}: FrontierWork): Promise<TicketResult[]> {
  let wake = () => {}
  const slots = new Slots(SLOTS, () => wake())
  const taken = new Set<string>()
  const merged = new Set<string>()
  const results: TicketResult[] = []
  const inFlight = new Set<Promise<void>>()
  let failure: { error: unknown } | undefined
  let takeable = initial
  let mergedSinceRead = false
  const fail = (error: unknown) => {
    failure ??= { error }
  }
  const mustReread = () => mergedSinceRead && reread !== undefined && !failure

  for (;;) {
    if (mustReread() && reread) {
      mergedSinceRead = false
      try {
        takeable = frontier(await reread(), merged)
      } catch (error) {
        fail(error)
      }
    }
    const next = failure ? undefined : takeable.find((each) => !taken.has(each.id))
    const slot = next ? slots.tryTake() : null
    if (next && slot) {
      taken.add(next.id)
      const turn: Promise<void> = Promise.resolve()
        .then(() => work(next, slotted(sandboxes, slots, slot)))
        .then((outcome) => {
          results.push({ ticket: next, outcome })
          if (outcome === 'merged') {
            merged.add(next.id)
            mergedSinceRead = true
          }
        }, fail)
        .finally(() => {
          // The slot it was claimed with, if no sandbox ever took it.
          slot.release()
          inFlight.delete(turn)
          wake()
        })
      inFlight.add(turn)
      continue
    }
    // A merge made while the frontier was being read: read it again.
    if (mustReread()) continue
    if (inFlight.size === 0) break
    // Until a slot frees or a ticket's turn ends.
    await new Promise<void>((resolve) => (wake = resolve))
  }
  if (failure) throw failure.error
  return results
}
