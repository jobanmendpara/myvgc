import {
  type NewTournament,
  type NoteEntryView,
  type RoundInput,
  roundInputSchema,
  roundIssues,
  type RoundView,
  type TeamSnapshotView,
  type TeamView,
  TOP_CUT_STAGE_LABELS,
  type TournamentChanges,
  tournamentChangesSchema,
  tournamentIssues,
  type TournamentView,
} from '@myvgc/core/schema'
import type { WriteDraft, WriteFix } from './outbox'
import type { OutboxWrite } from './outbox-rules'

// The writes the outbox sends (ADR 17): new, changed and deleted Tournaments and their Team, new,
// changed and deleted Rounds, new Opponents, and new, changed and deleted Note entries. Every
// other write stays online-only. A new record gets its ID
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

/**
 * Writes on one Tournament and its Rounds go in series; so do writes on one Opponent and their
 * Note entries, and on one Team.
 */
export const tournamentSeries = (id: string) => `tournament:${id}`
const opponentSeries = (id: string) => `opponent:${id}`
export const teamSeries = (id: string) => `team:${id}`

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

type SentRound = RoundInput & { id?: string }

/**
 * A rejected Round write as the User fixed it in the Round form, to send again in its place. It
 * keeps the Round's ID. The form starts from the Round as the write had it, so what it leaves out
 * as unchanged (the Opponent's Team and Age Division) is the write's own, and a new Opponent the
 * write was to add, which the server never got, is still added.
 */
export function reviseRound(
  write: OutboxWrite,
  tournament: TournamentRef,
  input: RoundInput,
  opponentName: string | null,
): WriteFix {
  const sent = (write.request.body ?? {}) as SentRound
  const roundId = write.subject.roundId!
  const toAdd = sent.newOpponentId && input.opponentId === sent.newOpponentId
  const before = sent.newOpponentId ?? sent.opponentId ?? null
  const after = toAdd ? sent.newOpponentId : (input.opponentId ?? input.newOpponentId ?? null)
  const sameOpponent = !input.newOpponentName && before === after
  const body: SentRound = {
    ...input,
    ...(toAdd
      ? {
          opponentId: null,
          newOpponentName: sent.newOpponentName,
          newOpponentId: sent.newOpponentId,
        }
      : {}),
    ...(sameOpponent && input.opponentTeam === undefined && sent.opponentTeam !== undefined
      ? { opponentTeam: sent.opponentTeam }
      : {}),
    ...(sameOpponent &&
    input.opponentAgeDivision === undefined &&
    sent.opponentAgeDivision !== undefined
      ? { opponentAgeDivision: sent.opponentAgeDivision }
      : {}),
  }
  if (body.newOpponentName && !body.newOpponentId) body.newOpponentId = newId()
  const kind = write.kind === 'log-round' ? 'log-round' : 'edit-round'
  const draft = roundWrite(
    kind,
    tournament,
    roundId,
    kind === 'log-round' ? { ...body, id: roundId } : body,
    opponentName,
    write.subject.before as RoundView | undefined,
  )
  return {
    request: draft.request,
    label: draft.label,
    series: draft.series,
    subject: draft.subject,
  }
}

/** A Tournament's fields as the API takes them, without the ID the outbox gives a new one. */
export type TournamentFields = Omit<NewTournament, 'id'>

/**
 * Creates a Tournament under an ID chosen here, so the Rounds logged in it before the server has
 * it can refer to it, and wait for it (ADR 17).
 */
export function addTournament(fields: TournamentFields): WriteDraft {
  const id = newId()
  return {
    id: newId(),
    kind: 'add-tournament',
    request: { method: 'POST', url: '/api/tournaments', body: { ...fields, id } },
    series: [tournamentSeries(id)],
    creates: tournamentSeries(id),
    subject: { tournamentId: id },
    label: `New Tournament ${fields.name.trim()}`,
  }
}

/** The ID of the Tournament a write creates. */
export const createdTournamentId = (write: OutboxWrite) =>
  write.kind === 'add-tournament' ? write.subject.tournamentId : undefined

/** A Tournament's changes, checked against the Tournament as it will be saved, as the server does. */
export const tournamentChangesFor = (saved: TournamentView) =>
  tournamentChangesSchema.superRefine((changes, ctx) => {
    for (const issue of tournamentIssues({ ...saved, ...changes }))
      ctx.addIssue({ code: 'custom', ...issue })
  })

const changesLabel = (name: string) => `Changes to ${name}`

/** Changes a Tournament's details, Placement or Championship Points. */
export function editTournament(tournament: TournamentView, changes: TournamentChanges): WriteDraft {
  return {
    id: newId(),
    kind: 'edit-tournament',
    request: { method: 'PATCH', url: `/api/tournaments/${tournament.id}`, body: changes },
    series: [tournamentSeries(tournament.id)],
    subject: { tournamentId: tournament.id, before: tournament },
    label: changesLabel(changes.name?.trim() || tournament.name),
  }
}

export function deleteTournament(tournament: TournamentView): WriteDraft {
  return {
    id: newId(),
    kind: 'delete-tournament',
    request: { method: 'DELETE', url: `/api/tournaments/${tournament.id}` },
    series: [tournamentSeries(tournament.id)],
    subject: { tournamentId: tournament.id, before: tournament },
    label: `Deleting ${tournament.name}`,
  }
}

/**
 * The Team snapshot a link shows until the server has made its own (ADR 9). The server judges it
 * against the Tournament's Regulation; here it can only reuse the Team's own judgement, so a Team
 * of another Regulation shows as not checked.
 */
function snapshotOf(tournament: TournamentView, team: TeamView, at: string): TeamSnapshotView {
  return {
    teamId: team.id,
    name: team.name,
    regulation: team.regulation,
    pokemon: team.pokemon,
    legality:
      team.legality.regulation === tournament.regulation
        ? team.legality
        : { regulation: tournament.regulation, status: 'unchecked', problems: [] },
    snapshotAt: at,
  }
}

/**
 * Links one of the User's Teams to a Tournament, or snapshots it again. It waits for that Team's
 * create, should the Team itself still be waiting to be sent.
 */
export function linkTournamentTeam(tournament: TournamentView, team: TeamView): WriteDraft {
  return {
    id: newId(),
    kind: 'link-tournament-team',
    request: {
      method: 'PUT',
      url: `/api/tournaments/${tournament.id}/team`,
      body: { teamId: team.id },
    },
    series: [tournamentSeries(tournament.id), teamSeries(team.id)],
    subject: {
      tournamentId: tournament.id,
      teamId: team.id,
      before: tournament.team,
      after: snapshotOf(tournament, team, new Date().toISOString()),
    },
    label: `${team.name} as your Team in ${tournament.name}`,
  }
}

export function unlinkTournamentTeam(tournament: TournamentView): WriteDraft {
  return {
    id: newId(),
    kind: 'unlink-tournament-team',
    request: { method: 'DELETE', url: `/api/tournaments/${tournament.id}/team` },
    series: [tournamentSeries(tournament.id)],
    subject: { tournamentId: tournament.id, before: tournament.team },
    label: `Unlinking your Team from ${tournament.name}`,
  }
}

/**
 * A rejected new or changed Tournament as the User fixed it in the Tournament form, to send again
 * in its place. A new Tournament keeps its ID, so the Rounds waiting on it still belong to it.
 */
export function reviseTournament(write: OutboxWrite, fields: TournamentFields): WriteFix {
  if (write.kind === 'add-tournament')
    return {
      request: { ...write.request, body: { ...fields, id: write.subject.tournamentId } },
      label: `New Tournament ${fields.name.trim()}`,
    }
  const before = write.subject.before as TournamentView | undefined
  return {
    request: { ...write.request, body: fields },
    label: changesLabel(fields.name.trim() || before?.name || ''),
  }
}
