import {
  DATA_EXPORT_FORMAT,
  DATA_EXPORT_VERSION,
  type DataExport,
  type ImportCounts,
  type ImportIssue,
  type ReadDataExport,
  checkDataExport,
  compareRounds,
  importIssueText,
  readDataExport,
  recordLabel,
  settleImportedRound,
  today,
} from '@myvgc/core'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../app'
import {
  opponent,
  opponentAlias,
  opponentNoteEntry,
  opponentTeam,
  round,
  team,
  tournament,
} from '../db/schema'
import type { Database } from '../db/types'
import { uniqueViolation } from './helpers'
import { toNoteEntryView } from './note-entry-data'
import { entryFeeOf } from './tournaments'

/** The largest Data export an import takes (ADR 23). */
const MAX_IMPORT_BYTES = 10 * 1024 * 1024
/** Rows per insert, so a large import stays under Postgres's limit on bind parameters. */
const INSERT_CHUNK = 500

/** All of one User's data as a Data export (ADR 23), in a stable order. */
export async function exportData(db: Database, ownerId: string): Promise<DataExport> {
  const ownOpponents = db
    .select({ id: opponent.id })
    .from(opponent)
    .where(eq(opponent.ownerId, ownerId))
  const ownTournaments = db
    .select({ id: tournament.id })
    .from(tournament)
    .where(eq(tournament.ownerId, ownerId))

  const [teams, opponents, aliases, noteEntries, tournaments, rounds, opponentTeams] =
    await Promise.all([
      db
        .select()
        .from(team)
        .where(eq(team.ownerId, ownerId))
        .orderBy(asc(team.createdAt), asc(team.id)),
      db
        .select()
        .from(opponent)
        .where(eq(opponent.ownerId, ownerId))
        .orderBy(asc(opponent.createdAt), asc(opponent.id)),
      db
        .select()
        .from(opponentAlias)
        .where(inArray(opponentAlias.opponentId, ownOpponents))
        .orderBy(asc(sql`lower(${opponentAlias.name})`), asc(opponentAlias.name)),
      db
        .select()
        .from(opponentNoteEntry)
        .where(inArray(opponentNoteEntry.opponentId, ownOpponents))
        .orderBy(
          asc(opponentNoteEntry.date),
          asc(opponentNoteEntry.createdAt),
          asc(opponentNoteEntry.id),
        ),
      db
        .select()
        .from(tournament)
        .where(eq(tournament.ownerId, ownerId))
        .orderBy(asc(tournament.startDate), asc(tournament.createdAt), asc(tournament.id)),
      db.select().from(round).where(inArray(round.tournamentId, ownTournaments)),
      db
        .select()
        .from(opponentTeam)
        .where(inArray(opponentTeam.tournamentId, ownTournaments))
        .orderBy(asc(opponentTeam.createdAt), asc(opponentTeam.id)),
    ])

  const times = (row: { createdAt: Date; updatedAt: Date }) => ({
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
  return {
    format: DATA_EXPORT_FORMAT,
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    teams: teams.map((row) => ({
      id: row.id,
      name: row.name,
      regulation: row.regulation,
      notes: row.notes,
      pokemon: row.pokemon,
      ...times(row),
    })),
    opponents: opponents.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      aliases: aliases.filter((a) => a.opponentId === row.id).map((a) => a.name),
      notes: row.notes,
      noteEntries: noteEntries.filter((n) => n.opponentId === row.id).map(toNoteEntryView),
      ...times(row),
    })),
    tournaments: tournaments.map((row) => ({
      id: row.id,
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      eventTier: row.eventTier,
      online: row.online,
      regulation: row.regulation,
      defaultBestOf: row.defaultBestOf,
      location: row.location,
      organizer: row.organizer,
      entryFee: entryFeeOf(row),
      championshipPoints: row.championshipPoints,
      playerCount: row.playerCount,
      link: row.link,
      placement: row.placement,
      dropped: row.dropped,
      notes: row.notes,
      team:
        row.teamName && row.teamRegulation && row.teamPokemon && row.teamSnapshotAt
          ? {
              teamId: row.teamId,
              name: row.teamName,
              regulation: row.teamRegulation,
              pokemon: row.teamPokemon,
              snapshotAt: row.teamSnapshotAt.toISOString(),
            }
          : null,
      rounds: rounds
        .filter((r) => r.tournamentId === row.id)
        .sort(compareRounds)
        .map((r) => ({
          id: r.id,
          phase: r.phase,
          roundNumber: r.roundNumber,
          stage: r.stage,
          bestOf: r.bestOf,
          bye: r.bye,
          result: r.result,
          gameScore:
            r.gamesWon !== null && r.gamesLost !== null
              ? { won: r.gamesWon, lost: r.gamesLost }
              : null,
          opponentId: r.opponentId,
          notes: r.notes,
          games: r.games,
          ...times(r),
        })),
      opponentTeams: opponentTeams
        .filter((o) => o.tournamentId === row.id)
        .map((o) => ({ id: o.id, opponentId: o.opponentId, pokemon: o.pokemon, ...times(o) })),
      ...times(row),
    })),
  }
}

/** Why an import was refused, leading with the first problem and listing each by its field. */
function refused(c: Context, status: 400 | 409, issues: readonly [ImportIssue, ...ImportIssue[]]) {
  return c.json(
    {
      error: importIssueText(issues[0]),
      problems: issues.slice(0, 50).map((issue) => ({
        record: issue.record,
        field: issue.path.join('.'),
        message: issue.message,
      })),
    },
    status,
  )
}

/** Ends the import's transaction without writing, with why it was refused. */
class Refused extends Error {
  constructor(readonly refusal: { status: 400 | 409; issues: [ImportIssue, ...ImportIssue[]] }) {
    super('Import refused')
  }
}

/** The owner of each id, for the ids an import uses that this install already has. */
type OwnerById = Map<string, string>
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

/** Inserts rows a few hundred at a time. */
async function insertAll<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) await insert(rows.slice(i, i + INSERT_CHUNK))
}

/**
 * Writes a checked Data export into one User's account, adding only what it doesn't have
 * (ADR 23). Throws `Refused` when a record can't be imported, before anything is written.
 */
async function importData(tx: Tx, ownerId: string, file: ReadDataExport): Promise<ImportCounts> {
  const fileRounds = file.tournaments.flatMap((t, ti) =>
    t.rounds.map((r, ri) => ({ round: r, tournament: t, path: ['tournaments', ti, 'rounds', ri] })),
  )
  const fileOpponentTeams = file.tournaments.flatMap((t, ti) =>
    t.opponentTeams.map((o, oi) => ({
      team: o,
      tournamentId: t.id,
      path: ['tournaments', ti, 'opponentTeams', oi],
    })),
  )
  const fileNoteEntries = file.opponents.flatMap((o, oi) =>
    o.noteEntries.map((n, ni) => ({
      entry: n,
      opponentId: o.id,
      path: ['opponents', oi, 'noteEntries', ni],
    })),
  )

  // Who owns each id the file uses, on this install.
  const owners = async (rows: Promise<{ id: string; ownerId: string }[]>): Promise<OwnerById> =>
    new Map((await rows).map((row) => [row.id, row.ownerId]))
  const teamIds = [
    ...file.teams.map((t) => t.id),
    ...file.tournaments.flatMap((t) => t.team?.teamId ?? []),
  ]
  const opponentIds = [
    ...file.opponents.map((o) => o.id),
    ...fileRounds.flatMap((r) => r.round.opponentId ?? []),
  ]
  const [
    teamOwners,
    opponentOwners,
    noteEntryOwners,
    storedTournaments,
    roundOwners,
    opponentTeamOwners,
  ] = await Promise.all([
    owners(
      tx.select({ id: team.id, ownerId: team.ownerId }).from(team).where(inArray(team.id, teamIds)),
    ),
    owners(
      tx
        .select({ id: opponent.id, ownerId: opponent.ownerId })
        .from(opponent)
        .where(inArray(opponent.id, opponentIds)),
    ),
    owners(
      tx
        .select({ id: opponentNoteEntry.id, ownerId: opponent.ownerId })
        .from(opponentNoteEntry)
        .innerJoin(opponent, eq(opponentNoteEntry.opponentId, opponent.id))
        .where(
          inArray(
            opponentNoteEntry.id,
            fileNoteEntries.map((n) => n.entry.id),
          ),
        ),
    ),
    tx
      .select({
        id: tournament.id,
        ownerId: tournament.ownerId,
        defaultBestOf: tournament.defaultBestOf,
      })
      .from(tournament)
      .where(
        inArray(
          tournament.id,
          file.tournaments.map((t) => t.id),
        ),
      ),
    owners(
      tx
        .select({ id: round.id, ownerId: tournament.ownerId })
        .from(round)
        .innerJoin(tournament, eq(round.tournamentId, tournament.id))
        .where(
          inArray(
            round.id,
            fileRounds.map((r) => r.round.id),
          ),
        ),
    ),
    owners(
      tx
        .select({ id: opponentTeam.id, ownerId: tournament.ownerId })
        .from(opponentTeam)
        .innerJoin(tournament, eq(opponentTeam.tournamentId, tournament.id))
        .where(
          inArray(
            opponentTeam.id,
            fileOpponentTeams.map((o) => o.team.id),
          ),
        ),
    ),
  ])

  const tournamentOwners: OwnerById = new Map(storedTournaments.map((t) => [t.id, t.ownerId]))

  // An ID another User holds can't be this User's record, so the whole import stops.
  const records: { held: OwnerById; id: string; path: (string | number)[] }[] = [
    ...file.teams.map((t, i) => ({ held: teamOwners, id: t.id, path: ['teams', i] })),
    ...file.opponents.map((o, i) => ({ held: opponentOwners, id: o.id, path: ['opponents', i] })),
    ...fileNoteEntries.map((n) => ({ held: noteEntryOwners, id: n.entry.id, path: n.path })),
    ...file.tournaments.map((t, i) => ({
      held: tournamentOwners,
      id: t.id,
      path: ['tournaments', i],
    })),
    ...fileRounds.map((r) => ({ held: roundOwners, id: r.round.id, path: r.path })),
    ...fileOpponentTeams.map((o) => ({ held: opponentTeamOwners, id: o.team.id, path: o.path })),
  ]
  for (const { held, id, path } of records) {
    const owner = held.get(id)
    if (owner && owner !== ownerId)
      throw new Refused({
        status: 409,
        issues: [
          {
            path: [...path, 'id'],
            record: recordLabel(file, path),
            message: 'Its ID is already used by another account on this install.',
          },
        ],
      })
  }
  const isOwn = (held: OwnerById, id: string) => held.get(id) === ownerId

  // A Tournament the User has keeps its own settings, so new Rounds on it are judged by them.
  const storedBestOf = new Map(
    storedTournaments.filter((t) => t.ownerId === ownerId).map((t) => [t.id, t.defaultBestOf]),
  )
  const bestOfFor = (t: { id: string; defaultBestOf: 1 | 3 }) =>
    storedBestOf.get(t.id) ?? t.defaultBestOf
  const issues = checkDataExport(
    { ...file, tournaments: file.tournaments.map((t) => ({ ...t, defaultBestOf: bestOfFor(t) })) },
    {
      opponentIds: new Set(opponentIds.filter((id) => isOwn(opponentOwners, id))),
    },
  )
  const [firstIssue, ...moreIssues] = issues
  if (firstIssue) throw new Refused({ status: 400, issues: [firstIssue, ...moreIssues] })

  // New Rounds landing on a Tournament the User has can clash with the Rounds logged there.
  const newRounds = fileRounds.filter((r) => !isOwn(roundOwners, r.round.id))
  const existingTournamentIds = [...new Set(newRounds.map((r) => r.tournament.id))].filter((id) =>
    isOwn(tournamentOwners, id),
  )
  const loggedRounds = existingTournamentIds.length
    ? await tx
        .select({
          tournamentId: round.tournamentId,
          roundNumber: round.roundNumber,
          stage: round.stage,
        })
        .from(round)
        .where(inArray(round.tournamentId, existingTournamentIds))
    : []
  const clashes: ImportIssue[] = []
  for (const { round: r, tournament: t, path } of newRounds) {
    const inTournament = loggedRounds.filter((l) => l.tournamentId === t.id)
    const record = recordLabel(file, path)
    if (r.roundNumber != null && inTournament.some((l) => l.roundNumber === r.roundNumber))
      clashes.push({
        path: [...path, 'roundNumber'],
        record,
        message: `Round ${r.roundNumber} is already logged.`,
      })
    if (r.stage != null && inTournament.some((l) => l.stage === r.stage))
      clashes.push({
        path: [...path, 'stage'],
        record,
        message: 'That Top cut stage is already logged.',
      })
  }
  const [firstClash, ...moreClashes] = clashes
  if (firstClash) throw new Refused({ status: 409, issues: [firstClash, ...moreClashes] })

  const date = (text: string) => new Date(text)
  const times = (row: { createdAt: string; updatedAt: string }) => ({
    createdAt: date(row.createdAt),
    updatedAt: date(row.updatedAt),
  })

  const newTeams = file.teams.filter((t) => !isOwn(teamOwners, t.id))
  await insertAll(newTeams, (chunk) =>
    tx.insert(team).values(
      chunk.map((t) => ({
        id: t.id,
        ownerId,
        name: t.name,
        regulation: t.regulation,
        notes: t.notes,
        pokemon: t.pokemon,
        ...times(t),
      })),
    ),
  )

  const newOpponents = file.opponents.filter((o) => !isOwn(opponentOwners, o.id))
  await insertAll(newOpponents, (chunk) =>
    tx.insert(opponent).values(
      chunk.map((o) => ({
        id: o.id,
        ownerId,
        displayName: o.displayName,
        notes: o.notes,
        ...times(o),
      })),
    ),
  )
  await insertAll(
    newOpponents.flatMap((o) => o.aliases.map((name) => ({ opponentId: o.id, name }))),
    (chunk) => tx.insert(opponentAlias).values(chunk),
  )

  const newNoteEntries = fileNoteEntries.filter((n) => !isOwn(noteEntryOwners, n.entry.id))
  await insertAll(newNoteEntries, (chunk) =>
    tx.insert(opponentNoteEntry).values(
      chunk.map(({ entry, opponentId }) => ({
        id: entry.id,
        opponentId,
        date: entry.date,
        text: entry.text,
        ...times(entry),
      })),
    ),
  )

  // A Team snapshot keeps its link only to a Team the User will have.
  const linkable = new Set([
    ...file.teams.map((t) => t.id),
    ...teamIds.filter((id) => isOwn(teamOwners, id)),
  ])
  const newTournaments = file.tournaments.filter((t) => !isOwn(tournamentOwners, t.id))
  await insertAll(newTournaments, (chunk) =>
    tx.insert(tournament).values(
      chunk.map((t) => ({
        id: t.id,
        ownerId,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate ?? null,
        eventTier: t.eventTier,
        online: t.online,
        regulation: t.regulation,
        defaultBestOf: t.defaultBestOf,
        location: t.location ?? null,
        organizer: t.organizer ?? null,
        entryFeeAmount: t.entryFee?.amount ?? null,
        entryFeeCurrency: t.entryFee?.currency ?? null,
        championshipPoints: t.championshipPoints ?? null,
        playerCount: t.playerCount ?? null,
        link: t.link ?? null,
        placement: t.placement ?? null,
        dropped: t.dropped,
        notes: t.notes,
        teamId: t.team?.teamId && linkable.has(t.team.teamId) ? t.team.teamId : null,
        teamName: t.team?.name ?? null,
        teamRegulation: t.team?.regulation ?? null,
        teamPokemon: t.team?.pokemon ?? null,
        teamSnapshotAt: t.team ? date(t.team.snapshotAt) : null,
        ...times(t),
      })),
    ),
  )

  await insertAll(newRounds, (chunk) =>
    tx.insert(round).values(
      chunk.map(({ round: r, tournament: t }) => {
        const settled = settleImportedRound(r, bestOfFor(t))
        return {
          id: r.id,
          tournamentId: t.id,
          phase: settled.phase,
          roundNumber: settled.roundNumber,
          stage: settled.stage,
          bestOf: settled.bestOf,
          bye: settled.bye,
          result: settled.result,
          gamesWon: settled.gameScore?.won ?? null,
          gamesLost: settled.gameScore?.lost ?? null,
          opponentId: settled.bye ? null : (r.opponentId ?? null),
          notes: r.notes,
          games: settled.games,
          ...times(r),
        }
      }),
    ),
  )

  // An Opponent's Team the User already has for that Opponent there is kept, and one is only
  // added for an Opponent a Round there is against, which a Round the User has may no longer be
  // (ADR 22).
  const played = new Set(
    (
      await tx
        .selectDistinct({ tournamentId: round.tournamentId, opponentId: round.opponentId })
        .from(round)
        .where(
          inArray(round.tournamentId, [...new Set(fileOpponentTeams.map((o) => o.tournamentId))]),
        )
    ).map((r) => `${r.tournamentId} ${r.opponentId}`),
  )
  await insertAll(
    fileOpponentTeams
      .filter((o) => played.has(`${o.tournamentId} ${o.team.opponentId}`))
      .map(({ team: o, tournamentId }) => ({
        id: o.id,
        tournamentId,
        opponentId: o.opponentId,
        pokemon: o.pokemon,
        ...times(o),
      })),
    (chunk) => tx.insert(opponentTeam).values(chunk).onConflictDoNothing(),
  )

  const count = (all: number, added: number) => ({ added, alreadyThere: all - added })
  return {
    teams: count(file.teams.length, newTeams.length),
    opponents: count(file.opponents.length, newOpponents.length),
    noteEntries: count(fileNoteEntries.length, newNoteEntries.length),
    tournaments: count(file.tournaments.length, newTournaments.length),
    rounds: count(fileRounds.length, newRounds.length),
  }
}

/** Data export and import (ADR 23), mounted at /api behind the session middleware. Online only. */
export function dataRoutes(db: Database) {
  return new Hono<AppEnv>()
    .get('/export', async (c) => {
      const file = await exportData(db, c.get('user').id)
      c.header('content-disposition', `attachment; filename="myvgc-${today()}.json"`)
      return c.json(file)
    })
    .post(
      '/import',
      bodyLimit({
        maxSize: MAX_IMPORT_BYTES,
        onError: (c) => c.json({ error: 'The file is larger than 10 MB.' }, 413),
      }),
      async (c) => {
        const body = await c.req.json().catch(() => undefined)
        const read = readDataExport(body)
        if (!read.ok) return refused(c, 400, read.issues)
        try {
          const counts = await db.transaction((tx) => importData(tx, c.get('user').id, read.file))
          return c.json(counts)
        } catch (error) {
          if (error instanceof Refused)
            return refused(c, error.refusal.status, error.refusal.issues)
          // Something saved while the import ran took one of its IDs, numbers or stages.
          if (uniqueViolation(error) !== undefined)
            return c.json(
              { error: 'Something was saved while the file was importing. Import it again.' },
              409,
            )
          throw error
        }
      },
    )
}
