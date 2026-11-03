import type { PasteIssue } from '@/lib/api'

/** Warnings from importing a Team, kept for its page to show once after saving. */
export function useImportWarnings(teamId: string) {
  return useState<PasteIssue[]>(`import-warnings:${teamId}`, () => [])
}
