import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { type SeenTeam, type TeamImageType, seenTeamSchema } from '@myvgc/core'

/** One image a User chose, already checked to be a PNG, JPEG or WebP. */
export interface TeamImage {
  type: TeamImageType
  bytes: Uint8Array
}

/**
 * Reads what images of a Team show (ADR 24): screenshots of a Replica Team or photos of a paper
 * Teamsheet, all of one Team. It returns the words and numbers seen; the route matches them to
 * the Champions data. Images are never stored or logged.
 *
 * Throws `ImageReadFailed` when the provider can't give an answer.
 */
export interface ImageTeamReader {
  read(images: TeamImage[]): Promise<SeenTeam>
}

/** The provider couldn't read the images. `reason` is for the logs and never holds image data. */
export class ImageReadFailed extends Error {
  constructor(readonly reason: string) {
    super(`Image reading failed: ${reason}`)
    this.name = 'ImageReadFailed'
  }
}

const INSTRUCTIONS = `You read Pokémon Champions Teams off images for a VGC player's records.
The images are screenshots of one Team (such as its Replica Team or status screens) or photos of one paper Teamsheet. Together they show one Team of up to six Pokémon.
For each Pokémon, give exactly what the images show: species or form, ability, held item, Stat Alignment (nature), up to four moves, and its stats. Use the English names as the game writes them.
Give stat values (the final numbers, such as 169 Speed) and Stat Points (0 to 32 per stat) only where the images show them; leave the rest null. Never work numbers out or guess them.
A Pokémon that appears on more than one image is listed once, with what every image shows of it.
List a field in "unsure" when it was hard to make out, such as a blurred word or a cut-off number.
If the images show no Pokémon Team, return an empty list of Pokémon.`

/** Reads images with an Anthropic model, using structured output for the answer. */
export function anthropicTeamReader({
  apiKey,
  model,
  fetch,
}: {
  apiKey: string
  model: string
  /** Tests pass a stub, so nothing reaches Anthropic. */
  fetch?: typeof globalThis.fetch
}): ImageTeamReader {
  const client = new Anthropic({ apiKey, fetch })
  return {
    async read(images) {
      let response
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          // On a declined request the API retries on a model chosen for that refusal's category.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: INSTRUCTIONS,
          messages: [
            {
              role: 'user',
              content: [
                ...images.map((image) => ({
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: image.type,
                    data: Buffer.from(image.bytes).toString('base64'),
                  },
                })),
                { type: 'text', text: 'Read the Team on these images.' },
              ],
            },
          ],
          output_config: { format: betaZodOutputFormat(seenTeamSchema) },
        })
      } catch (error) {
        // Only the status and class: an error's message or body could echo the request.
        if (error instanceof Anthropic.APIError)
          throw new ImageReadFailed(`${error.name} ${error.status ?? ''}`.trim())
        throw new ImageReadFailed(error instanceof Error ? error.name : 'unknown error')
      }
      if (response.stop_reason === 'refusal') throw new ImageReadFailed('refusal')
      if (response.stop_reason === 'max_tokens') throw new ImageReadFailed('max_tokens')
      if (!response.parsed_output) throw new ImageReadFailed('no structured output')
      return response.parsed_output
    },
  }
}
