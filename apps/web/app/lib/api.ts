import type { TeamView } from '@myvgc/core/schema'
import { FetchError } from 'ofetch'

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
