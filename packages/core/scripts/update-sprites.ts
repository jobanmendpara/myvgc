// `pnpm sprites:update`: downloads each icon in SPRITE_FILES from the pinned PokeAPI commit,
// converts it to a 96 × 96 WebP and writes `apps/web/public/sprites/<showdown-id>.webp` (ADR 29).
// The output is committed; building the image and running the app never download a Sprite.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { POKEAPI_SPRITES, SPRITE_FILES } from '../src/sprites.ts'

const SIZE = 96
const out = new URL('../../../apps/web/public/sprites/', import.meta.url)
const source = `https://raw.githubusercontent.com/${POKEAPI_SPRITES.repository}/${POKEAPI_SPRITES.commit}/${POKEAPI_SPRITES.folder}/`

async function download(file: string): Promise<Buffer> {
  const response = await fetch(source + file)
  if (!response.ok) throw new Error(`${file}: ${response.status} ${response.statusText}`)
  return Buffer.from(await response.arrayBuffer())
}

async function toWebp(png: Buffer): Promise<Buffer> {
  return (
    sharp(png)
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      // Quality 80 is about 3.7 KB a Sprite, 16% under 90, with no visible loss at 48 CSS px.
      .webp({ quality: 80, effort: 6 })
      .toBuffer()
  )
}

await mkdir(out, { recursive: true })

// Remove Sprites whose row is gone, so the folder holds exactly the table.
const wanted = new Set(Object.keys(SPRITE_FILES).map((id) => `${id}.webp`))
for (const name of await readdir(out)) {
  if (name.endsWith('.webp') && !wanted.has(name)) await rm(new URL(name, out))
}

const rows = Object.entries(SPRITE_FILES)
let total = 0
// A few at a time, to be gentle with GitHub.
for (let at = 0; at < rows.length; at += 8) {
  await Promise.all(
    rows.slice(at, at + 8).map(async ([id, file]) => {
      const webp = await toWebp(await download(file))
      await writeFile(new URL(`${id}.webp`, out), webp)
      total += webp.length
    }),
  )
}

console.log(
  `Wrote ${rows.length} Sprites from ${POKEAPI_SPRITES.repository}@${POKEAPI_SPRITES.commit.slice(0, 7)}, ` +
    `${(total / 1024).toFixed(1)} KB in all.`,
)
