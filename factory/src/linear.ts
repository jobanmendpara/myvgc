// The real Tracker: Linear's GraphQL API with the maintainer's personal API key (DEV-253). Thin on
// purpose, and not unit-tested: the pilot's first Run proves it (DEV-269, Testing Decisions).
import type { Issue, Tracker } from './ports.ts'

const API = 'https://api.linear.app/graphql'

export function linearTracker(apiKey: string): Tracker {
  return {
    async getIssue(id) {
      const data = await query<{ issue: GraphQLIssue | null }>(
        apiKey,
        `query Issue($id: String!) {
          issue(id: $id) { identifier title labels { nodes { name } } }
        }`,
        { id },
      )
      return data?.issue ? toIssue(data.issue) : null
    },
  }
}

interface GraphQLIssue {
  identifier: string
  title: string
  labels: { nodes: { name: string }[] }
}

function toIssue(issue: GraphQLIssue): Issue {
  return {
    id: issue.identifier,
    title: issue.title,
    labels: issue.labels.nodes.map((label) => label.name),
  }
}

/** The query's data, or null when Linear says the entity isn't found. */
async function query<T>(apiKey: string, text: string, variables: object): Promise<T | null> {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query: text, variables }),
  })
  let body: { data?: T; errors?: { message: string }[] }
  try {
    body = (await response.json()) as typeof body
  } catch {
    throw new Error(`Linear answered ${response.status} ${response.statusText} without JSON.`)
  }
  // Linear answers an unknown identifier with an "Entity not found" error rather than a null issue.
  if (body.errors?.some((error) => /not found/i.test(error.message))) return null
  if (!response.ok || body.errors || !body.data) {
    const reason = body.errors?.map((error) => error.message).join('; ') ?? response.statusText
    throw new Error(`Linear answered ${response.status}: ${reason}`)
  }
  return body.data
}
