import { PDFDocument, PDFTextField } from 'pdf-lib'
import { MAX_MOVES, type PokemonBuild, STAT_IDS } from './build'
import { type BuildText, readBuild } from './read-build'
import {
  ABILITY,
  FIELD_COUNT,
  FIRST_MOVE,
  FIRST_STAT,
  ITEM,
  SPECIES,
  STAT_ALIGNMENT,
  TEAM_LIST_PAGES,
} from './team-list'
import type { ReadFlag } from './team'

export type ReadTeamsheetResult =
  | { ok: true; name: string; pokemon: PokemonBuild[]; flags: ReadFlag[] }
  | { ok: false; error: string }

const NOT_A_TEAMSHEET =
  "This isn't a recognised Teamsheet. MyVGC reads Teamsheets filled in on teamsheet.gg."

/**
 * Reads a Teamsheet PDF filled in on teamsheet.gg into a draft Team (ADR 24). Names become
 * Showdown IDs; one the Champions data doesn't know is left out and flagged. Stat Points are
 * worked out from the staff page's stat values. Player details are ignored.
 */
export async function readTeamsheet(pdf: Uint8Array): Promise<ReadTeamsheetResult> {
  let fields: Map<string, string>
  try {
    const doc = await PDFDocument.load(pdf, { updateMetadata: false })
    fields = new Map(
      doc
        .getForm()
        .getFields()
        .map((field) => [
          field.getName(),
          field instanceof PDFTextField ? (field.getText() ?? '').trim() : '',
        ]),
    )
  } catch (error) {
    // pdf-lib's error classes don't survive its ES5 build, so `instanceof` can't tell them apart.
    if (error instanceof Error && /\bis encrypted\b/.test(error.message))
      return { ok: false, error: "This PDF is password-protected, so MyVGC can't read it." }
    return { ok: false, error: "This file isn't a PDF MyVGC can open." }
  }
  if (!Array.from({ length: FIELD_COUNT }, (_, n) => `f${n}`).every((name) => fields.has(name)))
    return { ok: false, error: NOT_A_TEAMSHEET }

  const text = (field: number) => fields.get(`f${field}`) ?? ''
  // The staff page has stat values; the opponents page is the fallback.
  const page = TEAM_LIST_PAGES.find(({ boxes }) => boxes.some((first) => text(first + SPECIES)))
  if (!page) return { ok: false, error: 'This Teamsheet has no Pokémon on it.' }

  const flags: ReadFlag[] = []
  const pokemon = page.boxes
    .filter((first) => text(first + SPECIES))
    .map((first, index) => readBuild(boxText(text, first, page.stats), index, flags))
  // Players often fill in only one page's header.
  const name =
    text(page.header.battleTeamName) ||
    TEAM_LIST_PAGES.map((other) => text(other.header.battleTeamName)).find(Boolean) ||
    ''
  return { ok: true, name, pokemon, flags }
}

/** The text of one Pokémon box, from the number of its first field, such as 19 for `f19`. */
function boxText(text: (field: number) => string, first: number, withStats: boolean): BuildText {
  const box: BuildText = {
    species: text(first + SPECIES),
    statAlignment: text(first + STAT_ALIGNMENT),
    ability: text(first + ABILITY),
    item: text(first + ITEM),
    moves: Array.from({ length: MAX_MOVES }, (_, move) => text(first + FIRST_MOVE + move)),
  }
  if (withStats)
    box.statValues = Object.fromEntries(
      STAT_IDS.flatMap((stat, offset) => {
        const value = text(first + FIRST_STAT + offset)
        return /^\d+$/.test(value) ? [[stat, Number(value)]] : []
      }),
    )
  return box
}
