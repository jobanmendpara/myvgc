import type { Context } from 'hono'
import type { z } from 'zod'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether a route parameter can be a record ID. Anything else can only be "not found". */
export const isId = (value: string | undefined): value is string =>
  value !== undefined && UUID.test(value)

/**
 * The answer for a record that doesn't exist or belongs to another User. Both look the same,
 * so nobody can tell which IDs exist.
 */
export const notFound = (c: Context) => c.json({ error: 'Not found' }, 404)

/**
 * The answer for a create whose client-chosen ID is already used by a record it can't be a replay
 * of: another User's, or a Round in another Tournament.
 */
export const idTaken = (c: Context) => c.json({ error: 'That ID is already in use.' }, 409)

/**
 * The answer for a delete, whether or not it found anything of the User's to delete. A replayed
 * delete must not fail, and saying "done" for another User's ID reveals as little as "not found"
 * would.
 */
export const deleted = (c: Context) => c.body(null, 204)

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response }

/**
 * Reads a JSON body against a schema. A body that doesn't parse or doesn't match answers 400
 * with the first message for each field, which the web app shows next to that field.
 */
export async function readBody<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<BodyResult<z.output<S>>> {
  const body = await c.req.json().catch(() => undefined)
  const input = schema.safeParse(body)
  if (input.success) return { ok: true, data: input.data }
  return { ok: false, response: invalid(c, input.error.issues) }
}

type Issue = { path: PropertyKey[]; message: string }

/** The first message for each field. */
function byField(issues: readonly Issue[]) {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    const field = issue.path.length ? issue.path.map(String).join('.') : 'body'
    fields[field] ??= issue.message
  }
  return fields
}

/** A 400 with the first message for each field. */
export function invalid(c: Context, issues: readonly Issue[]) {
  return c.json({ error: 'Invalid request', fields: byField(issues) }, 400)
}

/**
 * A 409 for a valid request that clashes with what is saved, such as a round number already
 * logged. It names the fields, like a 400, so the form can show the message next to them.
 */
export function clash(c: Context, issues: readonly [Issue, ...Issue[]]) {
  return c.json({ error: issues[0].message, fields: byField(issues) }, 409)
}

/** Makes `%`, `_` and `\\` in a search match themselves in a LIKE pattern. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)

/** The constraint a Postgres unique violation names, if the error is one. */
export function uniqueViolation(error: unknown): string | undefined {
  for (let e = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: string; constraint?: string }
    if (code === '23505') return constraint
  }
  return undefined
}

/** A Content-Disposition with an ASCII fallback name and the real one in RFC 5987 encoding. */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
