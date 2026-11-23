import {
  type NoteEntryView,
  type RoundInput,
  roundInputSchema,
  roundIssues,
  type RoundView,
  TOP_CUT_STAGE_LABELS,
  type TournamentView,
} from '@myvgc/core/schema'
import type { WriteDraft } from './outbox'

// The writes the outbox sends (ADR 17): new, changed and deleted Rounds, new Opponents, and new,
// changed and deleted Note entries. Every other write stays online-only. A new record gets its ID
// here, so sending it again is recognised as the same record.

/** A new random UUID, also where `crypto.randomUUID` is missing (a page not served over HTTPS). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type TournamentRef = Pick<TournamentView, 'id' | 'name'>
type OpponentRef = { id: string; displayName: string }

/** Rounds on one Tournament go in series; so do writes on one Opponent and their Note entries. */
const tournamentSeries = (id: string) => `tournament:${id}`
const opponentSeries = (id: string) => `opponent:${id}`

function roundName(input: Pick<RoundInput, 'phase' | 'roundNumber' | 'stage'>) {
  if (input.phase === 'top-cut' && input.stage) return TOP_CUT_STAGE_LABELS[input.stage]
  return input.roundNumber ? `Round ${input.roundNumber}` : 'A Round'
}

function roundWrite(
  kind: 'log-round' | 'edit-round',
  tournament: TournamentRef,
  roundId: string,
  body: RoundInput & { id?: string },
  opponentName: string | null,
  before?: RoundView,
): WriteDraft {
  const opponentId = body.bye ? undefined : (body.opponentId ?? body.newOpponentId ?? undefined)
  const rounds = `/api/tournaments/${tournament.id}/rounds`
  return {
    id: newId(),
    kind,
    request:
      kind === 'log-round'
        ? { method: 'POST', url: rounds, body }
        : { method: 'PATCH', url: `${rounds}/${roundId}`, body },
    series: [tournamentSeries(tournament.id), ...(opponentId ? [opponentSeries(opponentId)] : [])],
    subject: {
      tournamentId: tournament.id,
      roundId,
      ...(opponentId ? { opponentId } : {}),
      ...(opponentName ? { opponentName } : {}),
      ...(before ? { before } : {}),
    },
    label: `${roundName(body)} in ${tournament.name}`,
  }
}

/**
 * Logs a Round. A new Opponent added with it gets its ID here too. A Swiss Round whose number
 * the User didn't type leaves `roundNumber` out, so the server gives it the next free one.
 */
export function logRound(
  tournament: TournamentRef,
  input: RoundInput,
  opponentName: string | null,
): WriteDraft {
  const body = {
    ...input,
    id: newId(),
    ...(input.newOpponentName ? { newOpponentId: input.newOpponentId ?? newId() } : {}),
  }
  return roundWrite('log-round', tournament, body.id, body, opponentName)
}

/**
 * What is wrong with a Round, by field, as far as the device can tell: the server checks the
 * same rules, but with no signal it can't say so until much later. Nothing when it looks right.
 */
export function roundProblems(
  tournament: Pick<TournamentView, 'defaultBestOf' | 'rounds'>,
  input: RoundInput,
  roundId?: string,
): Record<string, string> | undefined {
  const fields: Record<string, string> = {}
  const add = (issue: { path: readonly PropertyKey[]; message: string }) =>
    (fields[issue.path.map(String).join('.') || 'body'] ??= issue.message)
  const parsed = roundInputSchema.safeParse(input)
  if (!parsed.success) {
    parsed.error.issues.forEach(add)
    return fields
  }
  const round = parsed.data
  const others = tournament.rounds.filter((r) => r.id !== roundId)
  const nextNumber = Math.max(0, ...others.map((r) => r.roundNumber ?? 0)) + 1
  const roundNumber =
    round.phase === 'swiss' ? (round.roundNumber ?? nextNumber) : (round.roundNumber ?? null)
  roundIssues({
    phase: round.phase,
    roundNumber,
    stage: round.stage ?? null,
    bestOf: round.bestOf ?? tournament.defaultBestOf,
    bye: round.bye,
    result: round.result ?? null,
    gameScore: round.gameScore ?? null,
    hasOpponent: Boolean(round.opponentId || round.newOpponentName),
    games: round.games,
    hasOpponentTeam: Boolean(round.opponentTeam?.length),
    hasOpponentAgeDivision: Boolean(round.opponentAgeDivision),
  }).forEach(add)
  if (round.roundNumber != null && others.some((r) => r.roundNumber === round.roundNumber))
    add({ path: ['roundNumber'], message: `Round ${round.roundNumber} is already logged.` })
  if (round.stage && others.some((r) => r.stage === round.stage))
    add({ path: ['stage'], message: 'That Top cut stage is already logged.' })
  return Object.keys(fields).length ? fields : undefined
}

export function editRound(
  tournament: TournamentRef,
  round: RoundView,
  input: RoundInput,
  opponentName: string | null,
): WriteDraft {
  const body = {
    ...input,
    ...(input.newOpponentName ? { newOpponentId: input.newOpponentId ?? newId() } : {}),
  }
  return roundWrite('edit-round', tournament, round.id, body, opponentName, round)
}

export function deleteRound(tournament: TournamentRef, round: RoundView): WriteDraft {
  return {
    id: newId(),
    kind: 'delete-round',
    request: { method: 'DELETE', url: `/api/tournaments/${tournament.id}/rounds/${round.id}` },
    series: [tournamentSeries(tournament.id)],
    subject: { tournamentId: tournament.id, roundId: round.id, before: round },
    label: `Deleting ${roundName(round)} in ${tournament.name}`,
  }
}

export function addOpponent(displayName: string): WriteDraft {
  const id = newId()
  return {
    id: newId(),
    kind: 'add-opponent',
    request: { method: 'POST', url: '/api/opponents', body: { id, displayName } },
    series: [opponentSeries(id)],
    subject: { opponentId: id, opponentName: displayName },
    label: `New Opponent ${displayName}`,
  }
}

export interface NoteEntryFields {
  date: string
  text: string
}

export function addNoteEntry(opponent: OpponentRef, fields: NoteEntryFields): WriteDraft {
  const noteEntryId = newId()
  return {
    id: newId(),
    kind: 'add-note-entry',
    request: {
      method: 'POST',
      url: `/api/opponents/${opponent.id}/note-entries`,
      body: { id: noteEntryId, ...fields },
    },
    series: [opponentSeries(opponent.id)],
    subject: { opponentId: opponent.id, noteEntryId },
    label: `Note entry on ${opponent.displayName}`,
  }
}

export function editNoteEntry(
  opponent: OpponentRef,
  entry: NoteEntryView,
  fields: NoteEntryFields,
): WriteDraft {
  return {
    id: newId(),
    kind: 'edit-note-entry',
    request: { method: 'PATCH', url: `/api/note-entries/${entry.id}`, body: fields },
    series: [opponentSeries(opponent.id)],
    subject: { opponentId: opponent.id, noteEntryId: entry.id, before: entry },
    label: `Note entry on ${opponent.displayName}`,
  }
}

export function deleteNoteEntry(opponent: OpponentRef, entry: NoteEntryView): WriteDraft {
  return {
    id: newId(),
    kind: 'delete-note-entry',
    request: { method: 'DELETE', url: `/api/note-entries/${entry.id}` },
    series: [opponentSeries(opponent.id)],
    subject: { opponentId: opponent.id, noteEntryId: entry.id, before: entry },
    label: `Deleting a Note entry on ${opponent.displayName}`,
  }
}
