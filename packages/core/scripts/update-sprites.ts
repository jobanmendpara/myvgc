// `pnpm sprites:update`: downloads the Sprites, Item icons and Type icons from the pinned PokeAPI
// commit, converts them to WebP and writes them to `apps/web/public/` (ADR 29, ADR 32):
// - `sprites/<showdown-id>.webp`, 96 × 96, from SPRITE_FILES
// - `item-icons/<showdown-item-id>.webp`, 48 × 48, from ITEM_ICON_FILES
// - `type-icons/<type-id>.webp`, 48 × 48, from TYPE_ICON_NUMBERS
// The output is committed; building the image and running the app never download one.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { ITEM_ICON_FILES, POKEAPI_ICONS, TYPE_ICON_NUMBERS } from '../src/icons.ts'
import { POKEAPI_SPRITES, SPRITE_FILES } from '../src/sprites.ts'

const publicFolder = new URL('../../../apps/web/public/', import.meta.url)
const raw = (folder: string) =>
  `https://raw.githubusercontent.com/${POKEAPI_SPRITES.repository}/${POKEAPI_SPRITES.commit}/${folder}/`

interface Folder {
  /** The folder under `apps/web/public/`. */
  name: string
  /** Where the files come from. */
  source: string
  /** Output ID → source file. */
  rows: Record<string, string>
  size: number
}

const FOLDERS: Folder[] = [
  {
    name: 'sprites',
    source: raw(POKEAPI_SPRITES.folder),
    rows: SPRITE_FILES,
    size: 96,
  },
  {
    name: 'item-icons',
    source: raw(POKEAPI_ICONS.itemFolder),
    rows: ITEM_ICON_FILES,
    size: 48,
  },
  {
    name: 'type-icons',
    source: raw(POKEAPI_ICONS.typeFolder),
    rows: Object.fromEntries(
      Object.entries(TYPE_ICON_NUMBERS).map(([id, number]) => [id, `${number}.png`]),
    ),
    size: 48,
  },
]

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return Buffer.from(await response.arrayBuffer())
}

async function toWebp(png: Buffer, size: number): Promise<Buffer> {
  // Pixel art smaller than the output (the 30 px Item icons) is scaled nearest-neighbour, so it
  // stays crisp instead of blurring. Larger art is scaled down smoothly.
  const { width = size } = await sharp(png).metadata()
  const pixelArt = width < size
  return (
    sharp(png)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: pixelArt ? 'nearest' : 'lanczos3',
      })
      // Quality 80 is about 3.7 KB a Sprite, 16% under 90, with no visible loss at 48 CSS px.
      // Pixel art is lossless: it keeps its hard edges and is smaller that way.
      .webp(pixelArt ? { lossless: true, effort: 6 } : { quality: 80, effort: 6 })
      .toBuffer()
  )
}

for (const folder of FOLDERS) {
  const out = new URL(`${folder.name}/`, publicFolder)
  await mkdir(out, { recursive: true })

  // Remove files whose row is gone, so the folder holds exactly the table.
  const wanted = new Set(Object.keys(folder.rows).map((id) => `${id}.webp`))
  for (const name of await readdir(out)) {
    if (name.endsWith('.webp') && !wanted.has(name)) await rm(new URL(name, out))
  }

  const rows = Object.entries(folder.rows)
  let total = 0
  // A few at a time, to be gentle with GitHub.
  for (let at = 0; at < rows.length; at += 8) {
    await Promise.all(
      rows.slice(at, at + 8).map(async ([id, file]) => {
        const webp = await toWebp(await download(folder.source + file), folder.size)
        await writeFile(new URL(`${id}.webp`, out), webp)
        total += webp.length
      }),
    )
  }

  console.log(
    `Wrote ${rows.length} files to ${folder.name}/ from ` +
      `${POKEAPI_SPRITES.repository}@${POKEAPI_SPRITES.commit.slice(0, 7)}, ` +
      `${(total / 1024).toFixed(1)} KB in all.`,
  )
}
