// The real Tracker: Linear's GraphQL API with the maintainer's personal API key (DEV-253). Thin on
// purpose, and not unit-tested: the pilot's first Run proves it (DEV-269, Testing Decisions).
import {
  STATUS_TYPES,
  type Issue,
  type Status,
  type StatusType,
  type Ticket,
  type Tracker,
} from './ports.ts'

const API = 'https://api.linear.app/graphql'

export function linearTracker(apiKey: string): Tracker {
  return {
    async getIssue(id) {
      const data = await query<{ issue: GraphQLIssue | null }>(
        apiKey,
        `query Issue($id: String!) {
          issue(id: $id) { identifier title description labels { nodes { name } } }
        }`,
        { id },
      )
      return data?.issue ? toIssue(data.issue) : null
    },

    async getSubIssues(id) {
      // A spec has far fewer than 250 tickets, and a ticket far fewer than 50 relations. Past
      // either, this refuses rather than miss a ticket or a blocker.
      const data = await query<{ issue: { children: Page<GraphQLTicket> } | null }>(
        apiKey,
        `query SubIssues($id: String!) {
          issue(id: $id) {
            children(first: 250) {
              pageInfo { hasNextPage }
              nodes {
                identifier title description branchName subIssueSortOrder
                state { name type }
                labels { nodes { name } }
                inverseRelations(first: 50) {
                  pageInfo { hasNextPage }
                  nodes { type issue { identifier state { name type } } }
                }
              }
            }
          }
        }`,
        { id },
      )
      return data?.issue ? allOf(data.issue.children, `${id}'s sub-issues`).map(toTicket) : []
    },

    async setStatus(id, status) {
      const data = await query<{
        issue: { team: { states: { nodes: { id: string; name: string }[] } } }
      }>(
        apiKey,
        `query TeamStates($id: String!) {
          issue(id: $id) { team { states { nodes { id name } } } }
        }`,
        { id },
      )
      const state = data?.issue.team.states.nodes.find((candidate) => candidate.name === status)
      if (!state) throw new Error(`${id}'s team has no status named ${status}.`)
      await mutate(
        apiKey,
        `mutation SetStatus($id: String!, $stateId: String!) {
          issueUpdate(id: $id, input: { stateId: $stateId }) { success }
        }`,
        { id, stateId: state.id },
      )
    },

    async comment(id, body) {
      await mutate(
        apiKey,
        `mutation Comment($id: String!, $body: String!) {
          commentCreate(input: { issueId: $id, body: $body }) { success }
        }`,
        { id, body },
      )
    },
  }
}

/** Runs a mutation, which must succeed. */
async function mutate(apiKey: string, text: string, variables: object): Promise<void> {
  const data = await query<Record<string, { success: boolean }>>(apiKey, text, variables)
  if (!data || Object.values(data).some((payload) => !payload.success)) {
    throw new Error(`Linear didn't apply ${text.trim().split(/[ (]/)[1]}.`)
  }
}

interface Page<T> {
  pageInfo: { hasNextPage: boolean }
  nodes: T[]
}

/** The page's nodes, or an error when there are more than one page holds. */
function allOf<T>(page: Page<T>, what: string): T[] {
  if (page.pageInfo.hasNextPage) throw new Error(`Linear has more ${what} than the factory reads.`)
  return page.nodes
}

interface GraphQLIssue {
  identifier: string
  title: string
  description: string | null
  labels: { nodes: { name: string }[] }
}

interface GraphQLState {
  name: string
  type: string
}

interface GraphQLTicket extends GraphQLIssue {
  branchName: string
  subIssueSortOrder: number | null
  state: GraphQLState
  /** Relations naming this ticket as their relatedIssue: for `blocks`, `issue` blocks this one. */
  inverseRelations: Page<{ type: string; issue: { identifier: string; state: GraphQLState } }>
}

function toTicket(ticket: GraphQLTicket): Ticket {
  return {
    ...toIssue(ticket),
    status: toStatus(ticket.state),
    blockedBy: allOf(ticket.inverseRelations, `relations on ${ticket.identifier}`)
      .filter((relation) => relation.type === 'blocks')
      .map((relation) => ({
        id: relation.issue.identifier,
        status: toStatus(relation.issue.state),
      })),
    // Null only for top-level issues, which a spec's children never are.
    order: ticket.subIssueSortOrder ?? Number.MAX_VALUE,
    branch: ticket.branchName,
  }
}

function toStatus(state: GraphQLState): Status {
  if (!isStatusType(state.type)) {
    throw new Error(`Linear gave a status of an unknown type: ${state.name} (${state.type}).`)
  }
  return { name: state.name, type: state.type }
}

function isStatusType(type: string): type is StatusType {
  return (STATUS_TYPES as readonly string[]).includes(type)
}

function toIssue(issue: GraphQLIssue): Issue {
  return {
    id: issue.identifier,
    title: issue.title,
    labels: issue.labels.nodes.map((label) => label.name),
    description: issue.description ?? '',
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
