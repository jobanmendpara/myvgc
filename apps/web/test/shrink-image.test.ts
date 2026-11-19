import { describe, expect, it } from 'vitest'
import { imageToUpload, type shrinkImage } from '../app/lib/shrink-image'

/** An image the User chose, `size` bytes long. */
const chosen = (size: number, name = 'stats-tab.png', type = 'image/png') =>
  new File([new Uint8Array(size)], name, { type })

/** A shrink that comes out `size` bytes long, in the type it was asked for. */
const shrunkTo =
  (size: number): typeof shrinkImage =>
  async (image, options = {}) =>
    new Blob([new Uint8Array(size)], { type: options.type ?? image.type })

describe('choosing the image to upload', () => {
  it('re-encodes the image as JPEG at quality 0.9', async () => {
    const asked: Parameters<typeof shrinkImage>[1][] = []
    const shrink: typeof shrinkImage = async (image, options) => {
      asked.push(options)
      return shrunkTo(1000)(image, options)
    }

    const upload = await imageToUpload(chosen(3000), shrink)

    expect(asked).toEqual([{ type: 'image/jpeg', quality: 0.9 }])
    expect(upload.size).toBe(1000)
    expect(upload.type).toBe('image/jpeg')
  })

  it('names the JPEG after the image the User chose, with a .jpg extension', async () => {
    const upload = async (name: string, type: string) =>
      (await imageToUpload(chosen(3000, name, type), shrunkTo(1000))).name

    expect(await upload('stats-tab.png', 'image/png')).toBe('stats-tab.jpg')
    expect(await upload('Replica.Team.webp', 'image/webp')).toBe('Replica.Team.jpg')
    expect(await upload('stats-tab', 'image/png')).toBe('stats-tab.jpg')
    expect(await upload('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg')
  })

  it('keeps the name the User chose when the browser encoded another type than asked', async () => {
    const shrink: typeof shrinkImage = async () =>
      new Blob([new Uint8Array(1000)], { type: 'image/png' })

    const upload = await imageToUpload(chosen(3000), shrink)

    expect(upload.name).toBe('stats-tab.png')
    expect(upload.type).toBe('image/png')
  })

  it('uploads the original when shrinking would make it bigger or leave it the same size', async () => {
    const original = chosen(1000)

    expect(await imageToUpload(original, shrunkTo(1200))).toBe(original)
    expect(await imageToUpload(original, shrunkTo(1000))).toBe(original)
  })

  it("uploads the original when the browser can't decode it", async () => {
    const original = chosen(1000)
    const cannotDecode = async (): Promise<Blob> => {
      throw new DOMException('The source image could not be decoded.', 'InvalidStateError')
    }

    expect(await imageToUpload(original, cannotDecode)).toBe(original)
  })
})
