import { describe, expect, it } from 'vitest'
import { imageToUpload } from '../app/lib/shrink-image'

/** A PNG the User chose, `size` bytes long. */
const chosen = (size: number) =>
  new File([new Uint8Array(size)], 'stats-tab.png', { type: 'image/png' })
const shrunkTo = (size: number) => async () =>
  new Blob([new Uint8Array(size)], { type: 'image/png' })

describe('choosing the image to upload', () => {
  it('uploads the shrunk image, under the name the User chose, when it came out smaller', async () => {
    const upload = await imageToUpload(chosen(3000), shrunkTo(1000))

    expect(upload.size).toBe(1000)
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
