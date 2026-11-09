import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  type PDFFont,
  PDFName,
  PDFString,
  PDFTextField,
  TextAlignment,
  rgb,
} from 'pdf-lib'
import { type PokemonBuild, STAT_IDS, totalStatPoints } from './build'
import { championsNames, displayName, modDexes } from './champions'
import { AGE_DIVISIONS, type AgeDivision } from './player-details'
import { statValues } from './stat-values'
import {
  ABILITY,
  FIRST_MOVE,
  FIRST_STAT,
  ITEM,
  SPECIES,
  STAT_ALIGNMENT,
  TEAM_LIST_PAGES,
  pageFields,
} from './team-list'
import type { TeamsheetExport } from './teamsheet-export'

/** The SHA-256 of TPCi's blank team list, which the field rectangles were measured on (ADR 18). */
export const TEAM_LIST_SHA256 = '4c0bb4ebe74d22edce3dd48d87f8009e0fb2121e43fd2c8cc7c0e01fedad9b56'

export interface WriteTeamsheetInput {
  /** The bundled blank team list. */
  template: Uint8Array
  /** The full Noto Sans, embedded as the fields' font (ADR 25). */
  font: Uint8Array
  pokemon: PokemonBuild[]
  /** Player details and the Battle Team name, Age Division already worked out. */
  header: Omit<TeamsheetExport, 'ageDivision'> & { ageDivision: AgeDivision | null }
}

export type WriteTeamsheetResult =
  { ok: true; pdf: Uint8Array<ArrayBuffer> } | { ok: false; error: string }

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A species as the Battle Team shows it: a battle-only form, such as a Mega, as its base form. */
function speciesName(id: string): string {
  const species = Object.values(modDexes)
    .map((modDex) => modDex.species.get(id))
    .find((found) => found.exists)
  const base = [species?.battleOnly ?? []].flat()[0]
  return displayName('species', base ?? id)
}

/** The text of each field, by field number. Fields left out stay empty. */
function fieldTexts({ pokemon, header }: WriteTeamsheetInput): Map<number, string> {
  const texts = new Map<number, string>()
  const set = (field: number | undefined, text: string) => {
    if (field !== undefined && text) texts.set(field, text)
  }
  const [year = '', month = '', day = ''] = header.dateOfBirth?.split('-') ?? []

  for (const page of TEAM_LIST_PAGES) {
    const fields = page.header
    set(fields.playerName, header.playerName)
    set(fields.trainerName, header.trainerName)
    set(fields.battleTeamName, header.battleTeamName)
    set(fields.switchProfileName, header.switchProfileName)
    set(fields.playerId, header.playerId)
    set(fields.supportId, header.supportId)
    set(fields.dateOfBirth?.[0], month)
    set(fields.dateOfBirth?.[1], day)
    set(fields.dateOfBirth?.[2], year)

    pokemon.forEach((build, index) => {
      const first = page.boxes[index]
      if (first === undefined) return
      set(first + SPECIES, speciesName(build.species))
      if (build.nature) set(first + STAT_ALIGNMENT, displayName('nature', build.nature))
      if (build.ability) set(first + ABILITY, displayName('ability', build.ability))
      if (build.item) set(first + ITEM, displayName('item', build.item))
      build.moves.forEach((move, slot) => set(first + FIRST_MOVE + slot, displayName('move', move)))

      // Stat boxes are filled only for a build with a Stat Alignment or Stat Points (ADR 20).
      const baseStats = championsNames().baseStats[build.species]
      if (!page.stats || !baseStats || (!build.nature && totalStatPoints(build.statPoints) === 0))
        return
      const values = statValues(baseStats, build.statPoints, build.nature)
      STAT_IDS.forEach((stat, offset) => set(first + FIRST_STAT + offset, String(values[stat])))
    })
  }
  return texts
}

/**
 * Makes a Teamsheet from a Team (ADR 25): adds teamsheet.gg's form fields to the blank team list
 * and fills them, so the User can still change any value in a PDF viewer. Gaps stay blank, and
 * builds fill the boxes in Team order. Refuses a template whose SHA-256 doesn't match, since the
 * fields would land in the wrong places.
 */
export async function writeTeamsheet(input: WriteTeamsheetInput): Promise<WriteTeamsheetResult> {
  if ((await sha256(input.template)) !== TEAM_LIST_SHA256)
    return {
      ok: false,
      error: "The bundled team list PDF isn't the one MyVGC knows, so it can't be filled in.",
    }

  const doc = await PDFDocument.load(input.template)
  doc.registerFontkit(fontkit)
  // The full font, not a subset, so text typed into the PDF later can use any of its characters.
  const font = await doc.embedFont(input.font, { subset: false })
  const form = doc.getForm()
  const pages = doc.getPages()
  const texts = fieldTexts(input)

  TEAM_LIST_PAGES.forEach((page, pageIndex) => {
    const pdfPage = pages[pageIndex]!
    for (const { field, rect, check, stat } of pageFields(page)) {
      const [x, y, width, height] = rect
      const options = {
        x,
        y,
        width,
        height,
        textColor: rgb(0, 0, 0),
        backgroundColor: undefined,
        borderColor: undefined,
        borderWidth: 0,
      }
      if (check) {
        const box = form.createCheckBox(`f${field}`)
        box.addToPage(pdfPage, options)
        const division = AGE_DIVISIONS[page.header.ageDivision.indexOf(field)]
        if (division === input.header.ageDivision) box.check()
        continue
      }
      const text = form.createTextField(`f${field}`)
      text.setText(texts.get(field))
      // Centred, so a stat value clears the box's printed label.
      if (stat) text.setAlignment(TextAlignment.Center)
      text.addToPage(pdfPage, { ...options, font })
    }
  })

  form.updateFieldAppearances(font)
  useAutoFontSize(doc, font)
  // pdf-lib always saves into a plain ArrayBuffer.
  const pdf = (await doc.save({ updateFieldAppearances: false })) as Uint8Array<ArrayBuffer>
  return { ok: true, pdf }
}

/**
 * Sets every text field to the embedded font at auto size (0), so a viewer shrinks text to fit as
 * it is typed, and lists the font in the form's resources so viewers can find it by name.
 */
function useAutoFontSize(doc: PDFDocument, font: PDFFont) {
  const appearance = `/${font.name} 0 Tf 0 g`
  const form = doc.getForm()
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue
    field.acroField.setDefaultAppearance(appearance)
    for (const widget of field.acroField.getWidgets()) widget.setDefaultAppearance(appearance)
  }
  const resources = doc.context.obj({ Font: { [font.name]: font.ref } })
  form.acroForm.dict.set(PDFName.of('DR'), resources)
  form.acroForm.dict.set(PDFName.of('DA'), PDFString.of(appearance))
}
