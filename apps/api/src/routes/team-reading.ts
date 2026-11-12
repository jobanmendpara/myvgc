import {
  MAX_TEAM_IMAGES,
  MAX_TEAM_IMAGE_BYTES,
  MAX_TEAM_IMAGE_MB,
  NOT_A_TEAM_IMAGE,
  type ReadTeamView,
  TEAM_IMAGE_TOO_LARGE,
  TOO_MANY_TEAM_IMAGES,
  type TeamReadingView,
  nameBuild,
  readSeenTeam,
  teamImageType,
  today,
} from '@myvgc/core'
import { and, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../app'
import { imageReads } from '../db/schema'
import type { Database } from '../db/types'
import { type ImageTeamReader, ImageReadFailed, type TeamImage } from '../team-reader'

export interface ImageReading {
  reader: ImageTeamReader
  /** Most reads from images per User per day. Leave out for no limit. */
  dailyLimit?: number
}

const NOT_TURNED_ON = "Reading Teams from images isn't turned on for this install."

/**
 * Reading Teams from images (ADR 24), mounted at /api/teams/read behind the session middleware.
 * With no `imageReading` the install has no key, so reading images answers 404.
 */
export function teamReadingRoutes(db: Database, imageReading?: ImageReading) {
  /** Counts one read for today, or answers false when the User has used today's reads. */
  async function countRead(userId: string, day: string, limit: number) {
    const counted = await db
      .insert(imageReads)
      .values({ userId, day, count: 1 })
      .onConflictDoUpdate({
        target: [imageReads.userId, imageReads.day],
        set: { count: sql`${imageReads.count} + 1` },
        setWhere: sql`${imageReads.count} < ${limit}`,
      })
      .returning({ count: imageReads.count })
    return counted.length > 0
  }

  /** Gives back a read the provider couldn't do, so a provider outage doesn't use up the day. */
  async function uncountRead(userId: string, day: string) {
    await db
      .update(imageReads)
      .set({ count: sql`greatest(${imageReads.count} - 1, 0)` })
      .where(and(eq(imageReads.userId, userId), eq(imageReads.day, day)))
  }

  return (
    new Hono<AppEnv>()
      .get('/', (c) => c.json({ images: imageReading !== undefined } satisfies TeamReadingView))
      // Reads screenshots or photos of one Team into a draft for the Team builder. Nothing is
      // saved, and the images are never stored or logged: they go to the model provider and are
      // dropped.
      .post(
        '/images',
        bodyLimit({
          // Room for the multipart wrapping around the images themselves.
          maxSize: MAX_TEAM_IMAGES * MAX_TEAM_IMAGE_BYTES + 256 * 1024,
          onError: (c) =>
            c.json(
              {
                error: `The images add up to more than ${MAX_TEAM_IMAGES * MAX_TEAM_IMAGE_MB} MB.`,
              },
              413,
            ),
        }),
        async (c) => {
          if (!imageReading) return c.json({ error: NOT_TURNED_ON }, 404)

          const form = await c.req.parseBody({ all: true }).catch(() => undefined)
          const files = [form?.image ?? []].flat().filter((file) => file instanceof File)
          if (files.length === 0)
            return c.json({ error: 'Choose screenshots or photos of a Team to read.' }, 400)
          if (files.length > MAX_TEAM_IMAGES) return c.json({ error: TOO_MANY_TEAM_IMAGES }, 400)
          if (files.some((file) => file.size > MAX_TEAM_IMAGE_BYTES))
            return c.json({ error: TEAM_IMAGE_TOO_LARGE }, 413)

          const images: TeamImage[] = []
          for (const file of files) {
            const bytes = new Uint8Array(await file.arrayBuffer())
            const type = teamImageType(bytes)
            if (!type) return c.json({ error: NOT_A_TEAM_IMAGE }, 422)
            images.push({ type, bytes })
          }

          const userId = c.get('user').id
          const day = today()
          const { dailyLimit } = imageReading
          if (dailyLimit !== undefined && !(await countRead(userId, day, dailyLimit)))
            return c.json(
              {
                error: `You've read ${dailyLimit} ${dailyLimit === 1 ? 'Team' : 'Teams'} from images today, the most for one day. Try again tomorrow.`,
              },
              429,
            )

          let seen
          try {
            seen = await imageReading.reader.read(images)
          } catch (error) {
            if (dailyLimit !== undefined) await uncountRead(userId, day)
            // Never the images: only why the provider failed.
            console.error(
              error instanceof ImageReadFailed ? error.message : 'Image reading failed.',
            )
            return c.json(
              { error: "Couldn't read the images right now. Try again in a little while." },
              502,
            )
          }

          const read = readSeenTeam(seen)
          if (read.pokemon.length === 0)
            return c.json({ error: "MyVGC couldn't find a Team's Pokémon on these images." }, 422)
          const draft: ReadTeamView = {
            name: read.name,
            pokemon: read.pokemon.map(nameBuild),
            flags: read.flags,
          }
          return c.json(draft)
        },
      )
  )
}
