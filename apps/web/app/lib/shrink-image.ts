/** The longest edge, in pixels, an image is sent at: the largest the model reads (ADR 24, DEV-119). */
export const MAX_IMAGE_EDGE = 2576

/**
 * Scales an image down so its long edge is at most `maxEdge` pixels (ADR 24). An image already
 * that small comes back as it was. `type` and `quality` re-encode it, such as
 * `{ type: 'image/jpeg', quality: 0.9 }`; by default it keeps its own type.
 *
 * It uses nothing outside its own body, so a script can run it in a browser as it is: the
 * reading-fixtures script (`e2e/scripts/make-reading-fixtures.ts`) passes it to Playwright's
 * Chromium, so the fixtures come from the same encoder the web app uses.
 */
export async function shrinkImage(
  image: Blob,
  options: { maxEdge?: number; type?: string; quality?: number } = {},
): Promise<Blob> {
  // A literal, not MAX_IMAGE_EDGE, so the function still runs when copied into a browser alone.
  const maxEdge = options.maxEdge ?? 2576
  const type = options.type ?? image.type
  const bitmap = await createImageBitmap(image)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && type === image.type) {
    bitmap.close()
    return image
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error("Couldn't shrink the image.")
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't shrink the image."))),
      type,
      options.quality,
    ),
  )
}

/**
 * The file to upload for an image the User chose: the shrunk one when shrinking worked and made it
 * smaller, else the original (ADR 24, DEV-122). A browser that can't decode the image (such as
 * HEIC outside Safari) makes `shrink` throw, so the original goes and the server checks it as it
 * would any upload. The shrunk file keeps the original's name.
 */
export async function imageToUpload(
  image: File,
  shrink: (image: Blob) => Promise<Blob> = shrinkImage,
): Promise<File> {
  const shrunk = await shrink(image).catch(() => undefined)
  if (!shrunk || shrunk.size >= image.size) return image
  return new File([shrunk], image.name, { type: shrunk.type || image.type })
}
