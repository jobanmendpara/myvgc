// The form fields of a filled-in official team list, as teamsheet.gg names and places them
// (`f0` to `f150`, docs/research/vg-team-list-pdf.md). Reading (ADR 24) and export (ADR 25) share
// them. Rectangles are [x, y, width, height] in points, measured from
// `test/fixtures/teamsheet-gg-filled.pdf`.

export type Rectangle = readonly [x: number, y: number, width: number, height: number]

export const FIELD_COUNT = 151

// A Pokémon box's fields run on from its first.
export const SPECIES = 0
export const STAT_ALIGNMENT = 1
export const ABILITY = 2
export const ITEM = 3
export const FIRST_MOVE = 4
export const FIRST_STAT = 8

/** Each page's header fields. The opponents page has no Player ID, Date of Birth or Support ID. */
export interface HeaderFields {
  playerName: number
  trainerName: number
  battleTeamName: number
  switchProfileName: number
  /** The Junior, Senior and Masters check boxes. */
  ageDivision: readonly [number, number, number]
  playerId?: number
  /** Month, day and year. */
  dateOfBirth?: readonly [number, number, number]
  supportId?: number
}

export interface TeamListPage {
  header: HeaderFields
  /** Each Pokémon box's first field, left to right, then top to bottom. */
  boxes: readonly number[]
  /** Whether its boxes have the six stat boxes. */
  stats: boolean
  /** The left edge of each column of boxes, and the bottom of each row's Pokémon field. */
  columns: readonly number[]
  rows: readonly number[]
  /** The width of a box's text fields. */
  width: number
}

/** The staff page first, then the opponents page. */
export const TEAM_LIST_PAGES: readonly TeamListPage[] = [
  {
    header: {
      playerName: 0,
      trainerName: 1,
      ageDivision: [2, 3, 4],
      battleTeamName: 10,
      switchProfileName: 12,
      playerId: 14,
      dateOfBirth: [15, 16, 17],
      supportId: 18,
    },
    boxes: [19, 41, 63, 85, 107, 129],
    stats: true,
    columns: [91, 383.5],
    rows: [608, 406.6, 205.2],
    width: 152,
  },
  {
    header: {
      playerName: 5,
      trainerName: 6,
      ageDivision: [7, 8, 9],
      battleTeamName: 11,
      switchProfileName: 13,
    },
    boxes: [33, 55, 77, 99, 121, 143],
    stats: false,
    columns: [91, 383.5],
    rows: [610.2, 408.8, 207.4],
    width: 202,
  },
]

const HEADER_RECTANGLES: Record<number, Rectangle> = {
  0: [145, 702.9, 220, 14],
  1: [145, 680.8, 220, 14],
  2: [471.5, 703.3, 12.3, 11.1],
  3: [527.2, 703.7, 12.2, 11],
  4: [576.8, 704.7, 12.2, 11],
  5: [145, 704.7, 220, 14],
  6: [145, 682.6, 220, 14],
  7: [471.5, 705.1, 12.3, 11.1],
  8: [527.2, 705.5, 12.2, 11],
  9: [576.8, 706.5, 12.2, 11],
  10: [145, 660.9, 220, 14],
  11: [145, 661.3, 220, 14],
  12: [145, 636.4, 220, 14],
  13: [145, 638.2, 220, 14],
  14: [437, 680.8, 150, 14],
  15: [436, 660.9, 38, 15],
  16: [488, 660.9, 42, 15],
  17: [544, 660.9, 46, 15],
  18: [437, 636.4, 150, 14],
}

// Within a box, measured down from the bottom of its Pokémon field.
const ROW_PITCH = 23.16
const round = (n: number) => Math.round(n * 100) / 100

export interface PlacedField {
  field: number
  rect: Rectangle
  check: boolean
  /** A stat box, whose top-left corner holds a small printed label. */
  stat?: boolean
}

/** Every field on a page with its rectangle, and whether it is a check box. */
export function pageFields(page: TeamListPage): PlacedField[] {
  const { header } = page
  const headerFields = [
    header.playerName,
    header.trainerName,
    header.battleTeamName,
    header.switchProfileName,
    ...(header.playerId === undefined ? [] : [header.playerId]),
    ...(header.dateOfBirth ?? []),
    ...(header.supportId === undefined ? [] : [header.supportId]),
  ].map((field) => ({ field, rect: HEADER_RECTANGLES[field]!, check: false }))
  const checks = header.ageDivision.map((field) => ({
    field,
    rect: HEADER_RECTANGLES[field]!,
    check: true,
  }))

  const boxFields = page.boxes.flatMap((first, index) => {
    const x = page.columns[index % page.columns.length]!
    const y = page.rows[Math.floor(index / page.columns.length)]!
    const fields: PlacedField[] = [
      { field: first + SPECIES, rect: [x, y, page.width, 18], check: false },
      { field: first + STAT_ALIGNMENT, rect: [x, round(y - 27), page.width, 14], check: false },
    ]
    for (let line = 0; line < FIRST_STAT - ABILITY; line++)
      fields.push({
        field: first + ABILITY + line,
        rect: [x, round(y - 51.5 - ROW_PITCH * line), page.width, 17],
        check: false,
      })
    if (page.stats)
      for (let stat = 0; stat < 6; stat++)
        fields.push({
          field: first + FIRST_STAT + stat,
          rect: [x + 158.5, round(y - 47 - ROW_PITCH * stat), 51, 14],
          check: false,
          stat: true,
        })
    return fields
  })
  return [...headerFields, ...checks, ...boxFields]
}
