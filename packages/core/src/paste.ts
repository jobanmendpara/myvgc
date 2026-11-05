import { type ChampionsKind, champions, displayName, unknownName } from './champions'
import {
  MAX_MOVES,
  MAX_NICKNAME_LENGTH,
  MAX_STAT_POINTS,
  MAX_TEAM_SIZE,
  MAX_TOTAL_STAT_POINTS,
  type PokemonBuild,
  STAT_IDS,
  STAT_LABELS,
  type StatId,
  type StatPoints,
  repeatedMoves,
  totalStatPoints,
} from './build'

/** A problem with one line of a paste. Lines are numbered from 1. */
export interface PasteIssue {
  line: number
  message: string
}

export type ReadPasteResult =
  | { ok: true; pokemon: PokemonBuild[]; warnings: PasteIssue[] }
  | { ok: false; errors: PasteIssue[]; warnings: PasteIssue[] }

interface Line {
  number: number
  text: string
}

// Stat names as written in pastes, after lowercasing and removing everything but letters.
const STAT_NAMES: Record<string, StatId> = {
  hp: 'hp',
  atk: 'atk',
  attack: 'atk',
  def: 'def',
  defense: 'def',
  spa: 'spa',
  spatk: 'spa',
  specialattack: 'spa',
  spd: 'spd',
  spdef: 'spd',
  specialdefense: 'spd',
  spe: 'spe',
  speed: 'spe',
}

// Lines Showdown writes that don't apply in Champions. They're skipped with a warning.
const IGNORED_LINES: { label: string; message: string }[] = [
  {
    label: 'Level',
    message: 'Champions Pokémon are always level 50, so the Level line was ignored.',
  },
  { label: 'IVs', message: 'Champions has no IVs, so the IVs line was ignored.' },
  {
    label: 'Tera Type',
    message: 'Champions has no Terastallization, so the Tera Type line was ignored.',
  },
  { label: 'Shiny', message: "MyVGC doesn't track shiny Pokémon, so the Shiny line was ignored." },
  {
    label: 'Happiness',
    message: "Champions doesn't use Happiness, so the Happiness line was ignored.",
  },
]

/**
 * Reads a Champions-format Showdown paste: Showdown's export format, where the `EVs:` line holds
 * Stat Points. Either every Pokémon is read, or the paste is rejected with line-by-line errors.
 */
export function readPaste(paste: string): ReadPasteResult {
  const errors: PasteIssue[] = []
  const warnings: PasteIssue[] = []
  const blocks = splitIntoBlocks(paste)

  if (blocks.length === 0) {
    errors.push({ line: 1, message: 'The paste has no Pokémon.' })
  }
  if (blocks.length > MAX_TEAM_SIZE) {
    errors.push({
      line: blocks[MAX_TEAM_SIZE]![0]!.number,
      message: `A Team has at most ${MAX_TEAM_SIZE} Pokémon; this is Pokémon ${MAX_TEAM_SIZE + 1}.`,
    })
  }

  const pokemon = blocks.map((block) => readBuild(block, errors, warnings))

  if (errors.length > 0) {
    return { ok: false, errors: errors.sort((a, b) => a.line - b.line), warnings }
  }
  return { ok: true, pokemon, warnings }
}

function splitIntoBlocks(paste: string): Line[][] {
  const blocks: Line[][] = []
  let current: Line[] | undefined
  paste.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.trim()
    if (text === '' || text === '---') {
      current = undefined
    } else if (text.startsWith('===')) {
      // A Showdown team-backup header, such as "=== [gen9championsvgc2026regmc] Sun ===".
    } else {
      if (!current) blocks.push((current = []))
      current.push({ number: index + 1, text })
    }
  })
  return blocks
}

function readBuild(
  [first, ...rest]: Line[],
  errors: PasteIssue[],
  warnings: PasteIssue[],
): PokemonBuild {
  const lookUp = (kind: ChampionsKind, name: string, line: Line): string | undefined => {
    const found = champions[kind](name)
    if (!found) {
      errors.push({ line: line.number, message: unknownName(kind, name) })
    }
    return found?.id
  }

  const build: PokemonBuild = {
    species: '',
    moves: [],
    statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  }

  const head = readFirstLine(first!.text)
  build.species = lookUp('species', head.species, first!) ?? ''
  if (head.nickname && head.nickname !== champions.species(head.species)?.name) {
    if (head.nickname.length > MAX_NICKNAME_LENGTH) {
      errors.push({
        line: first!.number,
        message: `Nicknames can be at most ${MAX_NICKNAME_LENGTH} characters.`,
      })
    }
    build.nickname = head.nickname
  }
  if (head.gender) build.gender = head.gender
  if (head.item) {
    const item = lookUp('item', head.item, first!)
    if (item) build.item = item
  }

  for (const line of rest) {
    const { text } = line
    const labelled = /^([A-Za-z ]+):\s*(.*)$/.exec(text)
    const label = labelled?.[1]!.toLowerCase()
    const value = labelled?.[2]!.trim() ?? ''

    if (label === 'ability') {
      const ability = lookUp('ability', value, line)
      if (ability) build.ability = ability
    } else if (label === 'evs') {
      const statPoints = readStatPoints(value, line, errors)
      if (statPoints) build.statPoints = statPoints
    } else if (label && IGNORED_LINES.some((ignored) => ignored.label.toLowerCase() === label)) {
      const ignored = IGNORED_LINES.find((i) => i.label.toLowerCase() === label)!
      warnings.push({ line: line.number, message: ignored.message })
    } else if (/^[A-Za-z]+ nature$/i.test(text)) {
      const nature = lookUp('nature', text.slice(0, -' nature'.length), line)
      if (nature) build.nature = nature
    } else if (text.startsWith('-') || text.startsWith('~')) {
      const name = text.slice(1).trim()
      if (build.moves.length >= MAX_MOVES) {
        errors.push({
          line: line.number,
          message: `A Pokémon has at most ${MAX_MOVES} moves; this is move ${build.moves.length + 1}.`,
        })
        build.moves.push('')
        continue
      }
      const move = lookUp('move', name, line)
      if (move && repeatedMoves([...build.moves, move]).length > 0) {
        errors.push({ line: line.number, message: `This Pokémon already has "${name}".` })
      }
      build.moves.push(move ?? '')
    } else {
      errors.push({ line: line.number, message: "Can't read this line." })
    }
  }

  return build
}

/** Reads `Nickname (Species) (F) @ Item`, where everything but the species is optional. */
function readFirstLine(text: string): {
  species: string
  nickname?: string
  gender?: 'M' | 'F'
  item?: string
} {
  const at = text.indexOf(' @ ')
  let name = at === -1 ? text : text.slice(0, at).trim()
  const item = at === -1 ? undefined : text.slice(at + 3).trim()

  let gender: 'M' | 'F' | undefined
  const genderMatch = / \((M|F)\)$/.exec(name)
  if (genderMatch) {
    gender = genderMatch[1] as 'M' | 'F'
    name = name.slice(0, genderMatch.index).trim()
  }

  const nicknameMatch = /^(.*)\(([^()]+)\)$/.exec(name)
  if (nicknameMatch && nicknameMatch[1]!.trim()) {
    return { species: nicknameMatch[2]!.trim(), nickname: nicknameMatch[1]!.trim(), gender, item }
  }
  return { species: name, gender, item }
}

function readStatPoints(value: string, line: Line, errors: PasteIssue[]): StatPoints | undefined {
  const points: StatPoints = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const errorCount = errors.length

  for (const part of value.split('/')) {
    const match = /^(\d+)\s+([A-Za-z. ]+)$/.exec(part.trim())
    const stat = match && STAT_NAMES[match[2]!.toLowerCase().replace(/[^a-z]/g, '')]
    if (!match || !stat) {
      errors.push({
        line: line.number,
        message: `Can't read the Stat Points "${value}". Write them like "32 HP / 2 Atk / 32 Spe".`,
      })
      return undefined
    }
    points[stat] = Number(match[1])
  }

  for (const stat of STAT_IDS) {
    if (points[stat] > MAX_STAT_POINTS) {
      errors.push({
        line: line.number,
        message: `${STAT_LABELS[stat]} has ${points[stat]} Stat Points; the most for one stat is ${MAX_STAT_POINTS}.`,
      })
    }
  }
  const total = totalStatPoints(points)
  if (total > MAX_TOTAL_STAT_POINTS) {
    errors.push({
      line: line.number,
      message: `The Stat Points add up to ${total}; the most is ${MAX_TOTAL_STAT_POINTS}.`,
    })
  }
  return errors.length === errorCount ? points : undefined
}

/** Writes Pokémon builds as a Champions-format Showdown paste, using display names. */
export function writePaste(pokemon: PokemonBuild[]): string {
  return pokemon.map(writeBuild).join('\n')
}

function writeBuild(build: PokemonBuild): string {
  const species = displayName('species', build.species)
  let first = build.nickname ? `${build.nickname} (${species})` : species
  if (build.gender) first += ` (${build.gender})`
  if (build.item) first += ` @ ${displayName('item', build.item)}`

  const lines = [first]
  if (build.ability) lines.push(`Ability: ${displayName('ability', build.ability)}`)
  const statPoints = STAT_IDS.filter((stat) => build.statPoints[stat] > 0).map(
    (stat) => `${build.statPoints[stat]} ${STAT_LABELS[stat]}`,
  )
  if (statPoints.length > 0) lines.push(`EVs: ${statPoints.join(' / ')}`)
  if (build.nature) lines.push(`${displayName('nature', build.nature)} Nature`)
  for (const move of build.moves) lines.push(`- ${displayName('move', move)}`)
  return lines.map((line) => `${line}\n`).join('')
}
