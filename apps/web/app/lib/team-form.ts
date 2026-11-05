import {
  DEFAULT_REGULATION,
  type LegalityCheck,
  MAX_MOVES,
  type NamedPokemonBuild,
  type Regulation,
  type StatPoints,
  type TeamBody,
  type TeamView,
  teamSchema,
} from '@myvgc/core/schema'

/** One slot's Pokémon build while it's being edited. Moves always has a place for each move. */
export interface BuildDraft {
  /** Keeps a slot's identity on screen while it moves around. Never sent. */
  key: number
  species: string | null
  nickname: string
  gender: '' | 'M' | 'F'
  item: string | null
  ability: string | null
  nature: string
  moves: (string | null)[]
  statPoints: StatPoints
}

export interface TeamDraft {
  name: string
  regulation: Regulation
  notes: string
  pokemon: BuildDraft[]
}

let nextKey = 0

export function blankBuild(): BuildDraft {
  return {
    key: nextKey++,
    species: null,
    nickname: '',
    gender: '',
    item: null,
    ability: null,
    nature: '',
    moves: Array<null>(MAX_MOVES).fill(null),
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  }
}

function buildToDraft(build: NamedPokemonBuild): BuildDraft {
  return {
    ...blankBuild(),
    species: build.species,
    nickname: build.nickname ?? '',
    gender: build.gender ?? '',
    item: build.item ?? null,
    ability: build.ability ?? null,
    nature: build.nature ?? '',
    moves: Array.from({ length: MAX_MOVES }, (_, index) => build.moves[index] ?? null),
    statPoints: { ...build.statPoints },
  }
}

/** The form for an existing Team, or a blank one. */
export function teamToDraft(team?: TeamView): TeamDraft {
  return {
    name: team?.name ?? '',
    regulation: team?.regulation ?? DEFAULT_REGULATION,
    notes: team?.notes ?? '',
    pokemon: team?.pokemon.map(buildToDraft) ?? [],
  }
}

/** What to send for the form as it stands. A missing species stays empty for the schema to report. */
export function draftToBody(draft: TeamDraft): TeamBody {
  return {
    name: draft.name,
    regulation: draft.regulation,
    notes: draft.notes,
    pokemon: draft.pokemon.map((build) => ({
      species: build.species ?? '',
      nickname: build.nickname.trim() || undefined,
      gender: build.gender || undefined,
      item: build.item ?? undefined,
      ability: build.ability ?? undefined,
      nature: build.nature || undefined,
      moves: build.moves.filter((move) => move !== null),
      statPoints: build.statPoints,
    })),
  }
}

/** What to have judged for the form as it stands. Every slot is sent, so paths match the slots. */
export function draftToLegalityCheck(draft: TeamDraft): LegalityCheck {
  return {
    regulation: draft.regulation,
    pokemon: draft.pokemon.map((build) => ({
      species: build.species,
      item: build.item ?? undefined,
      ability: build.ability ?? undefined,
      moves: build.moves.filter((move) => move !== null),
    })),
  }
}

/** The first problem with each field of the form, keyed like the API's: `pokemon.2.moves.1`. */
export function draftErrors(draft: TeamDraft): Record<string, string> {
  const result = teamSchema.safeParse(draftToBody(draft))
  const fields: Record<string, string> = {}
  for (const issue of result.error?.issues ?? []) {
    fields[issue.path.map(String).join('.')] ??= issue.message
  }
  return fields
}

/** Where a move's picker lands among the moves sent: empty pickers aren't sent, so later moves shift up. */
export function sentMoveIndex(build: BuildDraft, picker: number): number {
  return build.moves.slice(0, picker).filter((move) => move !== null).length
}

/** The field a move's picker answers for. */
export function moveField(build: BuildDraft, buildIndex: number, picker: number): string {
  return `pokemon.${buildIndex}.moves.${sentMoveIndex(build, picker)}`
}
