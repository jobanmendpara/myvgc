import { z } from 'zod'
import { teamPokemonSchema } from './build'
import { newNoteEntrySchema } from './note-entry'
import { newOpponentSchema } from './opponent'
import { ROUND_RESULTS, TOP_CUT_STAGES, TOP_CUT_STAGE_LABELS, roundInputSchema } from './round'
import { REGULATIONS, teamSchema } from './team'
import { newTournamentSchema } from './tournament'

/**
 * A Data export (ADR 23): one User's data as versioned JSON, grouped by record as the API shows
 * it, with every id and timestamp kept. Nothing about the account is in it.
 */
export const DATA_EXPORT_FORMAT = 'myvgc-export'
/** The version this install writes. Each new kind of User data bumps it, with an upgrade step. */
export const DATA_EXPORT_VERSION = 1

const recordId = z.uuid('IDs are UUIDs.')
const timestamp = z.iso.datetime('Use a time such as 2026-09-19T10:00:00.000Z.')
const timestamps = { createdAt: timestamp, updatedAt: timestamp }

// Each record is checked with the schema its normal write uses, plus the id and timestamps.
const exportedTeamSchema = teamSchema.extend({ id: recordId, ...timestamps })

const exportedNoteEntrySchema = newNoteEntrySchema.extend({ id: recordId, ...timestamps })

const exportedOpponentSchema = newOpponentSchema.extend({
  id: recordId,
  noteEntries: z.array(exportedNoteEntrySchema),
  ...timestamps,
})

const exportedRoundSchema = roundInputSchema
  .omit({ newOpponentId: true, newOpponentName: true })
  .extend({
    id: recordId,
    // Always stored, so totals don't recompute it.
    result: z.enum(ROUND_RESULTS),
    opponentId: recordId.nullable(),
    ...timestamps,
  })

const exportedSnapshotSchema = z.object({
  /** The Team it was copied from, or null once that Team is deleted. */
  teamId: recordId.nullable(),
  name: teamSchema.shape.name,
  regulation: z.enum(REGULATIONS),
  pokemon: teamPokemonSchema,
  snapshotAt: timestamp,
})

const exportedTournamentSchema = newTournamentSchema.safeExtend({
  id: recordId,
  regulation: z.enum(REGULATIONS),
  team: exportedSnapshotSchema.nullable(),
  rounds: z.array(exportedRoundSchema),
  ...timestamps,
})

/** A Data export in the current version. */
export const dataExportSchema = z.object({
  format: z.literal(DATA_EXPORT_FORMAT),
  version: z.literal(DATA_EXPORT_VERSION),
  exportedAt: timestamp,
  teams: z.array(exportedTeamSchema),
  opponents: z.array(exportedOpponentSchema),
  tournaments: z.array(exportedTournamentSchema),
})

export type DataExport = z.input<typeof dataExportSchema>
/** A Data export once read: trimmed and with defaults filled in, ready to write. */
export type ReadDataExport = z.output<typeof dataExportSchema>
export type ExportedTeam = DataExport['teams'][number]
export type ExportedOpponent = DataExport['opponents'][number]
export type ExportedNoteEntry = ExportedOpponent['noteEntries'][number]
export type ExportedTournament = DataExport['tournaments'][number]
export type ExportedRound = ExportedTournament['rounds'][number]

/**
 * Steps that upgrade a file by one version, keyed by the version they upgrade from. A file from
 * version 1 when the current version is 3 goes through `1` and then `2`.
 */
const UPGRADES: Record<number, (file: Record<string, unknown>) => Record<string, unknown>> = {}

/** A problem with a Data export, naming the record it is in, such as `Tournament “Worlds”`. */
export interface ImportIssue {
  path: (string | number)[]
  record: string
  message: string
}

const WHOLE_FILE = 'The file'

/** An issue as one line, such as `Tournament “Worlds”, Round 3: Choose Win, Loss or Tie.` */
export const importIssueText = (issue: Pick<ImportIssue, 'record' | 'message'>) =>
  issue.record === WHOLE_FILE ? issue.message : `${issue.record}: ${issue.message}`

export type ReadDataExportResult =
  { ok: true; file: ReadDataExport } | { ok: false; issues: [ImportIssue, ...ImportIssue[]] }

const headerSchema = z.object({
  format: z.literal(DATA_EXPORT_FORMAT),
  version: z.number().int().min(1),
})

const fileIssue = (message: string): ReadDataExportResult => ({
  ok: false,
  issues: [{ path: [], record: WHOLE_FILE, message }],
})

/**
 * Reads a Data export from any version up to this install's, upgrading older ones. A file from a
 * newer version is refused, as this install can't know what it holds.
 */
export function readDataExport(input: unknown): ReadDataExportResult {
  const header = headerSchema.safeParse(input)
  if (!header.success) return fileIssue('This isn’t a MyVGC Data export.')
  const { version } = header.data
  if (version > DATA_EXPORT_VERSION)
    return fileIssue(
      `This file is from a newer version of MyVGC (format version ${version}). Update this install to import it.`,
    )

  let file = input as Record<string, unknown>
  for (let from = version; from < DATA_EXPORT_VERSION; from++)
    file = { ...UPGRADES[from]!(file), version: from + 1 }

  const read = dataExportSchema.safeParse(file)
  if (read.success) return { ok: true, file: read.data }
  const issues = read.error.issues.map((issue) => {
    const path = issue.path.map((key) => (typeof key === 'number' ? key : String(key)))
    return { path, record: recordLabel(file, path), message: issue.message }
  })
  return { ok: false, issues: issues as [ImportIssue, ...ImportIssue[]] }
}

/** What a record is called, from a file that may not be valid. */
const nameOf = (record: unknown, field: string): string | undefined => {
  const value = (record as Record<string, unknown> | undefined)?.[field]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const at = (list: unknown, index: string | number | undefined): unknown =>
  Array.isArray(list) && typeof index === 'number' ? list[index] : undefined

/**
 * The record a path into a Data export points at, as a User would name it: `Team “Rain”`,
 * `Opponent “Wolfe”, Note entry of 2026-09-19` or `Tournament “Worlds”, Top 8`.
 */
export function recordLabel(file: unknown, path: readonly (string | number)[]): string {
  const [kind, index, child, childIndex] = path
  const named = (what: string, field: string) => {
    const record = at((file as Record<string, unknown> | null)?.[kind as string], index)
    const name = nameOf(record, field)
    return { record, label: name ? `${what} “${name}”` : `${what} ${Number(index) + 1}` }
  }

  if (kind === 'teams' && typeof index === 'number') return named('Team', 'name').label
  if (kind === 'opponents' && typeof index === 'number') {
    const { record, label } = named('Opponent', 'displayName')
    if (child !== 'noteEntries' || typeof childIndex !== 'number') return label
    const date = nameOf(at((record as Record<string, unknown>)?.noteEntries, childIndex), 'date')
    return `${label}, ${date ? `Note entry of ${date}` : `Note entry ${childIndex + 1}`}`
  }
  if (kind === 'tournaments' && typeof index === 'number') {
    const { record, label } = named('Tournament', 'name')
    if (child !== 'rounds' || typeof childIndex !== 'number') return label
    const round = at((record as Record<string, unknown>)?.rounds, childIndex) as
      Record<string, unknown> | undefined
    const stage = TOP_CUT_STAGES.find((s) => s === round?.stage)
    if (round?.phase === 'top-cut' && stage) return `${label}, ${TOP_CUT_STAGE_LABELS[stage]}`
    if (typeof round?.roundNumber === 'number') return `${label}, Round ${round.roundNumber}`
    return `${label}, Round ${childIndex + 1} in the file`
  }
  return WHOLE_FILE
}

/** The kinds of record an import counts. Aliases count with their Opponent. */
export const IMPORT_KINDS = ['teams', 'opponents', 'noteEntries', 'tournaments', 'rounds'] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  teams: 'Teams',
  opponents: 'Opponents',
  noteEntries: 'Note entries',
  tournaments: 'Tournaments',
  rounds: 'Rounds',
}

/** What the API answers after an import: per kind, how many were added and how many it had. */
export type ImportCounts = Record<ImportKind, { added: number; alreadyThere: number }>
