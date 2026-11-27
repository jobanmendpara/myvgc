// What an agent step cost at API prices, summed from its Claude Code session JSONL. Sandcastle's
// own `usage` is the last message's alone (the spike, DEV-251), so every message is counted here.
//
// Claude Code writes one line per content block, and each line of a message repeats that
// message's usage, so a message is counted once by its ID. A resumed session's JSONL holds the
// messages of the steps before it too, so the Run passes the IDs it has already counted.

/** US dollars per million tokens. */
interface Price {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

/**
 * Anthropic's API prices for the models the factory runs (the claude-api skill, 2026-11-03).
 * Cache writes are 1.25 times the input price for five minutes and twice it for an hour.
 */
const PRICES: Record<string, Price> = {
  'claude-opus-5-5': price(4, 20, 0.2),
  'claude-sonnet-5-5': price(2, 10, 0.1),
  'claude-haiku-5-5': price(0.1, 0.5, 0.01),
  'claude-fable-5-2': price(8, 40, 0.2),
}

/** Haiku 5.5's prices for a prompt over 100K tokens. */
const HAIKU_LONG = price(0.5, 2.5, 0.05)
const HAIKU_LONG_PROMPT = 100_000

function price(input: number, output: number, cacheRead: number): Price {
  return { input, output, cacheRead, cacheWrite5m: input * 1.25, cacheWrite1h: input * 2 }
}

export interface Tokens {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export interface StepCost {
  /** The priced models' cost, in US dollars. */
  usd: number
  /** Models it has no price for, whose tokens aren't in `usd`. */
  unpriced: string[]
  /** The tokens of each model, by type. */
  tokens: Record<string, Tokens>
}

interface Line {
  type?: string
  uuid?: string
  message?: {
    id?: string
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
      cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
    }
  }
}

/**
 * The cost of the messages in `jsonl` that aren't in `counted`, which it adds them to. A line that
 * isn't JSON, such as a half-written last one, is skipped.
 */
export function sessionCost(jsonl: string, counted: Set<string>): StepCost {
  const cost: StepCost = { usd: 0, unpriced: [], tokens: {} }
  for (const text of jsonl.split('\n')) {
    let line: Line
    try {
      line = JSON.parse(text) as Line
    } catch {
      continue
    }
    const { message } = line
    const usage = message?.usage
    if (line.type !== 'assistant' || !message || !usage) continue
    const id = message.id ?? line.uuid
    if (!id || counted.has(id)) continue
    counted.add(id)
    const write5m = usage.cache_creation?.ephemeral_5m_input_tokens
    const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
    const tokens: Tokens = {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      // Without the breakdown, a write is the five-minute kind, Claude Code's default.
      cacheWrite5m: write5m ?? Math.max(0, (usage.cache_creation_input_tokens ?? 0) - write1h),
      cacheWrite1h: write1h,
    }
    const total = Object.values(tokens).reduce((sum, count) => sum + count, 0)
    // Claude Code's own notes ("<synthetic>") carry no tokens.
    if (total === 0) continue
    const model = message.model ?? 'unknown'
    const sum = (cost.tokens[model] ??= {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
    })
    for (const key of Object.keys(tokens) as (keyof Tokens)[]) sum[key] += tokens[key]
    const rates = priceOf(model, tokens)
    if (!rates) {
      if (!cost.unpriced.includes(model)) cost.unpriced.push(model)
      continue
    }
    for (const key of Object.keys(tokens) as (keyof Tokens)[]) {
      cost.usd += (tokens[key] * rates[key]) / 1_000_000
    }
  }
  return cost
}

/** The model's prices, matching a dated ID such as claude-opus-5-5-20261101 too. */
function priceOf(model: string, tokens: Tokens): Price | undefined {
  const name = Object.keys(PRICES).find((key) => model === key || model.startsWith(`${key}-`))
  if (!name) return undefined
  const prompt = tokens.input + tokens.cacheRead + tokens.cacheWrite5m + tokens.cacheWrite1h
  if (name === 'claude-haiku-5-5' && prompt > HAIKU_LONG_PROMPT) return HAIKU_LONG
  return PRICES[name]
}
