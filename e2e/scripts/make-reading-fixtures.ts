// Makes one Team's reading fixtures for `pnpm accuracy` (DEV-123) from the maintainer's own
// screenshots. Each image listed in the Team's expected.json is written twice to
// apps/api/test/reading-fixtures/<team>/: as PNG scaled to at most 2576 px on the long edge, and
// as a JPEG copy encoded as the web app uploads it (UPLOAD_ENCODING: quality 0.9, DEV-132). Both
// come from the web app's own shrinkImage, run in Playwright's Chromium, so the JPEGs are what the
// web app sends. On the images marked
// `paintTrainerName` (the two Replica Team tabs) a made-up name is painted over the Trainer Name
// in Game first. Check every image by eye before committing it.
//
//   pnpm --filter @myvgc/e2e reading-fixtures <folder of screenshots> <team>
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { UPLOAD_ENCODING, shrinkImage } from '../../apps/web/app/lib/shrink-image.ts'

/** The name painted over the Trainer Name in Game. */
const PAINTED_NAME = 'Pip'

/**
 * Where the Trainer Name in Game sits on a Replica Team tab, as fractions of the image's width
 * and height (measured on a 2622 × 1206 screenshot): the right end of the banner, after the
 * avatar.
 */
const TRAINER_NAME = { x: 1691 / 2622, y: 81 / 1206, width: 407 / 2622, height: 67 / 1206 }

const [sourceDir, team] = process.argv.slice(2)
if (!sourceDir || !team) {
  console.error('Usage: reading-fixtures <folder of screenshots> <team>')
  process.exit(1)
}
const fixtureDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../apps/api/test/reading-fixtures',
  team,
)
const expected = JSON.parse(readFileSync(join(fixtureDir, 'expected.json'), 'utf8')) as {
  images: Record<string, { source: string; paintTrainerName?: boolean }>
}

/**
 * Paints `text` over a box of the image, filled with the box's own edge colours so it blends into
 * the banner. Runs in the browser, so it uses nothing outside its own body.
 */
async function paintOver(
  image: Blob,
  box: { x: number; y: number; width: number; height: number },
  text: string,
): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No 2D canvas.')
  context.drawImage(bitmap, 0, 0)
  const x = Math.round(box.x * bitmap.width)
  const y = Math.round(box.y * bitmap.height)
  const width = Math.round(box.width * bitmap.width)
  const height = Math.round(box.height * bitmap.height)
  const average = (left: number) => {
    const pixels = context.getImageData(left, y, 1, height).data
    const sum = [0, 0, 0]
    for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) sum[c]! += pixels[i + c]!
    return `rgb(${sum.map((total) => Math.round(total / height)).join(',')})`
  }
  const fill = context.createLinearGradient(x, 0, x + width, 0)
  fill.addColorStop(0, average(x - 1))
  fill.addColorStop(1, average(x + width))
  context.fillStyle = fill
  context.fillRect(x, y, width, height)
  context.fillStyle = 'white'
  context.font = `${Math.round(height * 0.6)}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, x + width / 2, y + height / 2)
  return await new Promise<Blob>((done, fail) =>
    canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('No PNG.'))), 'image/png'),
  )
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.addScriptTag({
    content: `window.shrinkImage = ${shrinkImage.toString()}; window.paintOver = ${paintOver.toString()};`,
  })
  for (const [name, { source, paintTrainerName }] of Object.entries(expected.images)) {
    const bytes = readFileSync(join(sourceDir, source)).toString('base64')
    const made = await page.evaluate(
      async ({ bytes, paint, box, text, upload }) => {
        const tools = window as unknown as {
          shrinkImage: typeof shrinkImage
          paintOver: typeof paintOver
        }
        let image = await (await fetch(`data:image/png;base64,${bytes}`)).blob()
        if (paint) image = await tools.paintOver(image, box, text)
        const encode = async (blob: Blob) => {
          const data = new Uint8Array(await blob.arrayBuffer())
          let binary = ''
          for (let i = 0; i < data.length; i += 0x8000)
            binary += String.fromCharCode(...data.subarray(i, i + 0x8000))
          return btoa(binary)
        }
        const png = await tools.shrinkImage(image, { type: 'image/png' })
        const jpeg = await tools.shrinkImage(image, upload)
        const size = await createImageBitmap(png)
        return {
          png: await encode(png),
          jpeg: await encode(jpeg),
          width: size.width,
          height: size.height,
        }
      },
      {
        bytes,
        paint: paintTrainerName === true,
        box: TRAINER_NAME,
        text: PAINTED_NAME,
        upload: UPLOAD_ENCODING,
      },
    )
    writeFileSync(join(fixtureDir, `${name}.png`), Buffer.from(made.png, 'base64'))
    writeFileSync(join(fixtureDir, `${name}.jpg`), Buffer.from(made.jpeg, 'base64'))
    console.log(
      `${name}: ${made.width} × ${made.height}${paintTrainerName ? ', name painted' : ''}`,
    )
  }
} finally {
  await browser.close()
}
