import type { TeamsheetAttachmentView } from '@myvgc/core'
import type { tournament } from '../db/schema'
import type { FileStorage } from '../storage'

type TournamentRow = typeof tournament.$inferSelect

export function toTeamsheetView(row: TournamentRow): TeamsheetAttachmentView | null {
  if (!row.teamsheetFileName || row.teamsheetSize === null || !row.teamsheetUploadedAt) return null
  return {
    fileName: row.teamsheetFileName,
    size: row.teamsheetSize,
    uploadedAt: row.teamsheetUploadedAt.toISOString(),
  }
}

/**
 * Deletes a file whose record is already gone. A failure only leaves an orphaned file, which
 * nobody can reach, so it is logged rather than failing the request (ADR 27).
 */
export async function discardFile(storage: FileStorage, key: string | null) {
  if (!key) return
  await storage.delete(key).catch((error) => console.error(`Couldn't delete ${key}:`, error))
}
