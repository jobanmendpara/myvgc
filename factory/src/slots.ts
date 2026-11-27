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

/** Works the tickets, two at a time, until nothing is takeable and nothing is in flight. */
export async function workFrontier({
  takeable: initial,
  reread,
  sandboxes,
  work,
}: FrontierWork): Promise<{ ticket: Ticket; outcome: TicketOutcome }[]> {
  let wake = () => {}
  const slots = new Slots(SLOTS, () => wake())
  const taken = new Set<string>()
  const merged = new Set<string>()
  const outcomes: { ticket: Ticket; outcome: TicketOutcome }[] = []
  const inFlight = new Set<Promise<void>>()
  let failure: { error: unknown } | undefined
  let takeable = initial
  let stale = false

  for (;;) {
    if (stale && reread && !failure) {
      stale = false
      // A ticket merged in this Run is Done to its blockers, even before Linear says so.
      takeable = frontier(
        (await reread()).map((each) => ({
          ...each,
          blockedBy: each.blockedBy.map((blocker) =>
            merged.has(blocker.id)
              ? { ...blocker, status: { name: 'Done', type: 'completed' as const } }
              : blocker,
          ),
        })),
      )
    }
    const next = failure ? undefined : takeable.find((each) => !taken.has(each.id))
    const slot = next ? slots.tryTake() : null
    if (next && slot) {
      taken.add(next.id)
      const turn: Promise<void> = work(next, slotted(sandboxes, slots, slot))
        .then(
          (outcome) => {
            outcomes.push({ ticket: next, outcome })
            if (outcome === 'merged') {
              merged.add(next.id)
              stale = true
            }
          },
          (error: unknown) => {
            failure ??= { error }
          },
        )
        .finally(() => {
          // The slot it was claimed with, if no sandbox ever took it.
          slot.release()
          inFlight.delete(turn)
          wake()
        })
      inFlight.add(turn)
      continue
    }
    if (inFlight.size === 0 && !(stale && reread && !failure)) break
    // Until a slot frees or a ticket's turn ends.
    if (inFlight.size > 0) await new Promise<void>((resolve) => (wake = resolve))
  }
  if (failure) throw failure.error
  return outcomes
}
