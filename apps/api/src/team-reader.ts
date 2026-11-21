import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { type SeenTeam, type TeamImageType, seenTeamSchema } from '@myvgc/core'

/** One image a User chose, already checked to be a PNG, JPEG or WebP. */
export interface TeamImage {
  type: TeamImageType
  bytes: Uint8Array
}

/**
 * Reads what screenshots of a Team show (ADR 24): the Replica Team's "Moves & More" and "Stats"
 * tabs and Pokémon detail screens, all of one Team. It labels each image's kind, and reads nothing
 * from any other image. It returns the words and numbers seen; the route matches them to the
 * Champions data. Images are never stored or logged.
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

const INSTRUCTIONS = `You read Pokémon Champions Teams off screenshots for a VGC player's records.
The images are screenshots of one Team of up to six Pokémon. Only two kinds of screen are supported:
- The Replica Team, which has two tabs. Both show a banner with the slot, the Replica Team ID after "Team ID:" (a code of letters and digits, such as 9TCG84KWXK) and the Trainer Name in Game, then six numbered panels, one per Pokémon, each headed by its species and its gender symbol (♂ or ♀; some Pokémon have none). The Replica Team tabs show only the species, never a nickname.
  - The "Moves & More" tab (kind replicaTeamMoves): each panel shows the ability and the held item under the species, and the four moves on the right.
  - The "Stats" tab (kind replicaTeamStats): each panel shows, for each stat, the stat value then its Stat Points after a bar. A tiny pink ▲ by a stat's name marks the stat the Stat Alignment raises, and a tiny blue ▼ the stat it lowers; the tab never writes the Stat Alignment's name.
- A Pokémon detail screen (kind pokemonDetail), one Pokémon each: each stat's value then its Stat Points after a bar, with the same ▲ and ▼ by the raised and lowered stats, and the Stat Alignment's name after "Stat Alignment"; the four moves under "Moves" (the number by each move is its PP, not part of the move); the ability under "Ability"; and at the bottom, the nickname by the Poké Ball and the gender symbol, and on a separate line the species after "No." and the Pokédex number (such as "No. 6 Charizard"), followed for Meowstic, Indeedee and Basculegion by the word Male or Female (such as "No. 902 Basculegion Male"). A detail screen never shows the held item.
Label every image's kind, one entry per image in the order given. Any other image, such as a battle screen, a status screen, a photo or a paper Teamsheet, is unsupported: read nothing from it, even if a Pokémon is on it, since it could be someone else's.
For each Pokémon, give exactly what the supported images show: species or form, nickname, gender, ability, held item, Stat Alignment, up to four moves, and its stats. Use the English names as the game writes them, copying each name letter by letter: every move, ability, held item and Stat Alignment is an official Pokémon name, so never change a letter to make a different word.
On a detail screen the species is the name after "No.", and the nickname is the name by the Poké Ball and gender symbol; give the nickname exactly as written, even when it looks like a species name. Never give the nickname as the species. Leave the nickname null when only the Replica Team tabs show a Pokémon. Give the species exactly as the screen writes it, with its form only when the screen names one (such as Rotom-Wash); never add a form, a gender or anything else in brackets to it. The word Male or Female after the species on a detail screen is the gender, not part of the species: give "Basculegion", never "Basculegion-Male" or "Basculegion Male".
Give the gender only as gender, from its symbol: ♂ is male, ♀ is female. Leave it null when no symbol is shown.
Give the Stat Alignment only where its name is written; leave it null when only arrows show. Give the stat with the ▲ as raisedStat and the stat with the ▼ as loweredStat (atk Attack, def Defense, spa Sp. Atk, spd Sp. Def, spe Speed), wherever the arrows show; leave each null when that arrow isn't shown. Read the arrows themselves: never work them out from the numbers or from the Stat Alignment's name.
Set itemShown to true when any image shows the Pokémon's held-item slot, which only the Moves & More tab does, even when the slot is empty; then leave the held item null only for an empty slot. When no image shows the slot, set itemShown to false and leave the held item null.
Give stat values (the final numbers, such as 169 Speed) and Stat Points (0 to 32 per stat) only where the images show them; leave the rest null. Never work numbers out or guess them.
List each Pokémon once, merged across images, with what every image shows of it. When two images show different values for one of its fields, give the clearer one and list the field in "disagreeing"; otherwise leave "disagreeing" empty.List them in the Replica Team's order (its panel numbers) when a Replica Team tab is among the images; otherwise in the order they first appear in the images.
Give the Replica Team ID only as replicaTeamId, never as the Battle Team name. Champions shows no Battle Team name on these screens, so leave it null unless the images show the Team's own name.
Ignore the Trainer Name in Game: never put it in any field.
List a field in "unsure" when it was hard to make out, such as a blurred word, a cut-off number or a Replica Team ID character that could be 0 or O, or 1 or I.
If no supported image shows a Pokémon, return an empty list of Pokémon.`

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
  // No retries: one read is one request (and one charge). A failed read isn't counted against the
  // daily limit, so the User can simply try again.
  const client = new Anthropic({ apiKey, fetch, maxRetries: 0 })
  return {
    async read(images) {
      let response
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          // On a declined request the API retries on a model chosen for that refusal's category.
          // Haiku 5.5, the default, has no such fallback, so there a refused read simply fails.
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
