// After the host dies (DEV-269, AC-29.1): running the same command again takes the dead Run up
// again. Its run.json names the host process that ran it and each ticket's last finished step
// (its checkpoint), so the tickets it claimed and didn't finish are adopted and each resumes from
// there, with no second claim. A Run whose process is still alive is left alone: its tickets are
// its own.
//
// Its worktrees stay on the host: Sandcastle reuses a ticket's worktree under .sandcastle/worktrees
// when the branch is checked out there, so commits never pushed carry on into the new sandbox.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Ticket } from './ports.ts'
import { type Checkpoint, RunLog, type RunRecord } from './runlog.ts'

export interface Adoption {
  /** The dead Run's folder and record, which the new process carries on in. */
  dir: string
  record: RunRecord
  /** Its unfinished tickets this command takes, in the order it took them, with their checkpoints. */
  tickets: { ticket: Ticket; checkpoint: Checkpoint }[]
}

/**
 * The latest Run of the spec whose host died with tickets unfinished, and those tickets: with
 * `only`, that one ticket alone. Null when there is none to adopt.
 */
export function adoption(
  repoDir: string,
  specId: string,
  isAlive: (pid: number) => boolean,
  tickets: Ticket[],
  only: string | undefined,
): Adoption | null {
  const runs = join(repoDir, '.factory', 'runs')
  if (!existsSync(runs)) return null
  // Run IDs start with their date and time, so the latest sorts last.
  for (const name of readdirSync(runs).sort().reverse()) {
    const dir = join(runs, name)
    const record = RunLog.read(dir)
    if (!record || record.specId !== specId || isAlive(record.pid)) continue
    const unfinished = record.tickets.flatMap((ticketRecord) => {
      const ticket = tickets.find((candidate) => candidate.id === ticketRecord.id)
      const { checkpoint } = ticketRecord
      return ticketRecord.outcome === null && checkpoint && ticket ? [{ ticket, checkpoint }] : []
    })
    if (unfinished.length === 0) continue
    const taken = unfinished.filter(({ ticket }) => !only || ticket.id === only)
    return taken.length > 0 ? { dir, record, tickets: taken } : null
  }
  return null
}
