import type { TeamView } from '@myvgc/core/schema'
import { FetchError } from 'ofetch'
import { RejectedChange } from './outbox'

/** A problem with one line of a paste, as the API reports it. Lines are numbered from 1. */
export interface PasteIssue {
  line: number
  message: string
}

export interface CreatedTeam {
  team: TeamView
  warnings: PasteIssue[]
}

/** Why the API refused to create a Team. */
export type CreateTeamError =
  | { kind: 'paste'; errors: PasteIssue[]; warnings: PasteIssue[] }
  | { kind: 'fields'; fields: Record<string, string> }
  | { kind: 'other'; message: string }

export function toCreateTeamError(error: unknown): CreateTeamError {
  if (error instanceof FetchError) {
    if (error.statusCode === 422 && error.data?.errors) {
      return { kind: 'paste', errors: error.data.errors, warnings: error.data.warnings ?? [] }
    }
    if (error.statusCode === 400 && error.data?.fields) {
      return { kind: 'fields', fields: error.data.fields }
    }
    if (error.statusCode === 401) {
      return { kind: 'other', message: 'Your session has ended. Log in again to save this Team.' }
    }
  }
  return { kind: 'other', message: "Couldn't save the Team. Check your connection and try again." }
}

/**
 * The errors per field from a 400 answer, or from a 409 that names fields (such as a round
 * number already logged). Nothing for any other failure.
 */
export function fieldErrorsOf(error: unknown): Record<string, string> | undefined {
  if (error instanceof RejectedChange) return error.fields
  return error instanceof FetchError && (error.statusCode === 400 || error.statusCode === 409)
    ? error.data?.fields
    : undefined
}

/** A message for a failed save that isn't about a particular field. */
export function saveFailureMessage(error: unknown, what: string): string {
  // Saved through the outbox (ADR 17): the server's own message.
  if (error instanceof RejectedChange && error.statusCode === 401)
    return `Your session has ended. Log in again to save this ${what}.`
  if (error instanceof RejectedChange) return error.message
  if (error instanceof FetchError && error.statusCode === 401)
    return `Your session has ended. Log in again to save this ${what}.`
  if (error instanceof FetchError && error.statusCode === 404)
    return `This ${what} no longer exists. It may have been deleted on another device.`
  if (error instanceof FetchError && error.statusCode === 409 && error.data?.error)
    return error.data.error
  return `Couldn't save the ${what}. Check your connection and try again.`
}

type Checked =
  | { success: true }
  | {
      success: false
      error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }
    }

/**
 * Checks a change against its schema before it is kept on the phone (ADR 17), since with no
 * signal the server can't say what is wrong with it. Throws the first problem for each field, as
 * the server's 400 would.
 */
export function checkBeforeSaving(schema: { safeParse(body: unknown): Checked }, body: unknown) {
  const checked = schema.safeParse(body)
  if (checked.success) return
  const fields: Record<string, string> = {}
  for (const issue of checked.error.issues)
    fields[issue.path.map(String).join('.') || 'body'] ??= issue.message
  throw new RejectedChange(400, 'Invalid request', fields)
}
