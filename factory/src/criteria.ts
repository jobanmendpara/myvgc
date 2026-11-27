// Acceptance criteria (How specs prove themselves, DEV-252): each one is a bold `AC-n.m` under a
// user story in the signed-off spec, and a ticket says which it covers in a "Covers:" line.

export interface Criterion {
  id: string
  /** The criterion's Given/When/Then text, as the spec has it. */
  text: string
  /** Tested by a test that can fail, or Seen in a screenshot. Specs mark Seen ones "(Seen)". */
  kind: 'tested' | 'seen'
}

const CRITERION = /\*\*(AC-\d+\.\d+)\*\*\s*(.+)/g
const COVERS = /\*\*Covers:\*\*\s*(.+)/
const ID = /AC-\d+\.\d+/g

/** Every criterion in the spec's description, by ID. */
export function criteriaOf(specDescription: string): Map<string, Criterion> {
  const criteria = new Map<string, Criterion>()
  for (const [, id, text] of specDescription.matchAll(CRITERION)) {
    if (!id || !text) continue
    criteria.set(id, { id, text: text.trim(), kind: /\(Seen\)/i.test(text) ? 'seen' : 'tested' })
  }
  return criteria
}

/** The criterion IDs in the ticket's "Covers:" line, in order. */
export function coveredIds(ticketDescription: string): string[] {
  return ticketDescription.match(COVERS)?.[1]?.match(ID) ?? []
}
