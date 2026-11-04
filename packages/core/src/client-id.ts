import { z } from 'zod'

/**
 * An ID the client picks for a record it creates, so a write queued while offline can be sent
 * again without making a second record (ADR 17). Optional: without one, the server picks it.
 */
export const clientIdSchema = z.uuid('IDs are UUIDs.').optional()
