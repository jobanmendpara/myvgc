import { randomUUID } from 'node:crypto'
import { MAX_TEAMSHEET_BYTES, TEAMSHEET_TOO_LARGE } from '@myvgc/core'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../app'
import { tournament } from '../db/schema'
import type { Database } from '../db/types'
import type { FileStorage } from '../storage'
import { contentDisposition, deleted, isId, notFound } from './helpers'
import { discardFile, toTeamsheetView } from './teamsheet-attachment-data'
import { ownTournament } from './tournaments'

const MAX_FILE_NAME = 200

// Direction overrides can make `fdp.exe` read as `exe.pdf`.
const UNSAFE = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu

/** The name the file was uploaded with, without folders, control characters or overrides. */
function cleanFileName(name: string): string {
  const characters = Array.from((name.split(/[/\\]/).pop() ?? '').replace(UNSAFE, '').trim())
  // Cut by character, not UTF-16 unit, so an emoji is never split in half.
  return characters.slice(0, MAX_FILE_NAME).join('').trim() || 'teamsheet.pdf'
}

const PDF_HEADER = new TextEncoder().encode('%PDF-')
const isPdf = (bytes: Uint8Array) => PDF_HEADER.every((byte, index) => bytes[index] === byte)

/**
 * A Tournament's Teamsheet attachment (ADR 27): a PDF the User uploaded, kept exactly as sent.
 * Mounted at /api/tournaments/:tournamentId/teamsheet behind the session middleware.
 */
export function teamsheetAttachmentRoutes(db: Database, storage: FileStorage) {
  return new Hono<AppEnv>()
    .put(
      '/',
      bodyLimit({
        // Room for the multipart wrapping around the file itself.
        maxSize: MAX_TEAMSHEET_BYTES + 64 * 1024,
        onError: (c) => c.json({ error: TEAMSHEET_TOO_LARGE }, 413),
      }),
      async (c) => {
        const id = c.req.param('tournamentId')
        if (!isId(id)) return notFound(c)
        const ownerId = c.get('user').id
        const where = ownTournament(id, ownerId)
        const [saved] = await db.select().from(tournament).where(where)
        if (!saved) return notFound(c)

        const form = await c.req.parseBody().catch(() => undefined)
        const file = form?.file
        if (!(file instanceof File))
          return c.json({ error: 'Choose a Teamsheet PDF to upload.' }, 400)
        if (file.size > MAX_TEAMSHEET_BYTES) return c.json({ error: TEAMSHEET_TOO_LARGE }, 413)
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (!isPdf(bytes)) return c.json({ error: "This file isn't a PDF." }, 400)

        // A fresh key each time: the new file is in place before the row points to it, and the
        // old one goes after.
        const key = `teamsheets/${ownerId}/${randomUUID()}.pdf`
        await storage.put(key, bytes)
        const [row] = await db
          .update(tournament)
          .set({
            teamsheetKey: key,
            teamsheetFileName: cleanFileName(file.name),
            teamsheetSize: bytes.length,
            teamsheetUploadedAt: new Date(),
          })
          .where(where)
          .returning()
        if (!row) {
          // Deleted while the file was uploading.
          await discardFile(storage, key)
          return notFound(c)
        }
        await discardFile(storage, saved.teamsheetKey)
        return c.json(toTeamsheetView(row))
      },
    )
    .get('/', async (c) => {
      const id = c.req.param('tournamentId')
      if (!isId(id)) return notFound(c)
      const [row] = await db
        .select()
        .from(tournament)
        .where(ownTournament(id, c.get('user').id))
      const file = row?.teamsheetKey ? await storage.get(row.teamsheetKey) : undefined
      if (!row?.teamsheetFileName || !file) return notFound(c)
      return c.body(file, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition('inline', row.teamsheetFileName),
        'Cache-Control': 'private, no-store',
        // Uploaded files come from our own origin, so they never run as a page.
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox allow-scripts',
      })
    })
    .delete('/', async (c) => {
      const id = c.req.param('tournamentId')
      if (!isId(id)) return deleted(c)
      const where = ownTournament(id, c.get('user').id)
      const [saved] = await db.select().from(tournament).where(where)
      if (!saved?.teamsheetKey) return deleted(c)
      await db
        .update(tournament)
        .set({
          teamsheetKey: null,
          teamsheetFileName: null,
          teamsheetSize: null,
          teamsheetUploadedAt: null,
        })
        .where(where)
      await discardFile(storage, saved.teamsheetKey)
      return deleted(c)
    })
}
