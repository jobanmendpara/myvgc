// DEV-102 baseline: runs the real anthropicTeamReader on the sample screenshots and compares
// readSeenTeam's draft with the true Team. Usage is captured by wrapping fetch.
import { readFileSync, writeFileSync } from 'node:fs'
import { anthropicTeamReader } from '/Users/jobanmendpara/Developer/sites/myvgc/apps/api/src/team-reader.ts'
import { readSeenTeam } from '/Users/jobanmendpara/Developer/sites/myvgc/packages/core/src/index.ts'

process.loadEnvFile('/Users/jobanmendpara/Developer/sites/myvgc/.env')
const apiKey = process.env.ANTHROPIC_API_KEY!
const DIR = '/Users/jobanmendpara/Downloads/temp-vgc-screenshots'
const OUT = '/private/tmp/claude-501/-Users-jobanmendpara-Developer-sites-myvgc/96bc0a61-105f-4c50-b36d-9348b2726bfb/scratchpad'

const PRICES: Record<string, [number, number]> = {
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
}

const truth = [
  { species: 'charizard', nickname: 'Chorizo', gender: 'M', ability: 'solarpower', item: 'charizarditey', nature: 'timid', moves: ['heatwave', 'weatherball', 'solarbeam', 'protect'], sp: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 } },
  { species: 'venusaur', nickname: 'V', gender: 'M', ability: 'overgrow', item: 'sitrusberry', nature: 'calm', moves: ['gigadrain', 'sludgebomb', 'sleeppowder', 'protect'], sp: { hp: 32, atk: 0, def: 2, spa: 16, spd: 16, spe: 0 } },
  { species: 'whimsicott', nickname: 'MichaelScott', gender: 'F', ability: 'prankster', item: 'focussash', nature: 'timid', moves: ['moonblast', 'encore', 'tailwind', 'protect'], sp: { hp: 4, atk: 0, def: 0, spa: 30, spd: 0, spe: 32 } },
  { species: 'kingambit', nickname: 'Queenambit', gender: 'F', ability: 'defiant', item: 'chopleberry', nature: 'adamant', moves: ['kowtowcleave', 'suckerpunch', 'ironhead', 'protect'], sp: { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 2 } },
  { species: 'garchomp', nickname: 'Garchoid', gender: 'F', ability: 'roughskin', item: 'lifeorb', nature: 'jolly', moves: ['earthquake', 'rockslide', 'dragonclaw', 'protect'], sp: { hp: 0, atk: 32, def: 2, spa: 0, spd: 0, spe: 32 } },
  { species: 'basculegion', nickname: 'Bad Sushi', gender: 'M', ability: 'adaptability', item: 'mysticwater', nature: 'adamant', moves: ['wavecrash', 'aquajet', 'flipturn', 'lastrespects'], sp: { hp: 0, atk: 32, def: 2, spa: 0, spd: 0, spe: 32 } },
]

const PAIR = ['IMG_5085.PNG', 'IMG_5086.PNG']
const DETAIL = ['IMG_5079.PNG', 'IMG_5080.PNG', 'IMG_5081.PNG', 'IMG_5082.PNG', 'IMG_5083.PNG', 'IMG_5084.PNG']
const runs = [
  ['sonnet-pair-1', 'claude-sonnet-5-5', PAIR],
  ['sonnet-pair-2', 'claude-sonnet-5-5', PAIR],
  ['sonnet-detail', 'claude-sonnet-5-5', DETAIL],
  ['sonnet-all-1', 'claude-sonnet-5-5', [...PAIR, ...DETAIL]],
  ['sonnet-all-2', 'claude-sonnet-5-5', [...PAIR, ...DETAIL]],
  ['haiku-pair', 'claude-haiku-5-5', PAIR],
  ['haiku-detail', 'claude-haiku-5-5', DETAIL],
  ['haiku-all', 'claude-haiku-5-5', [...PAIR, ...DETAIL]],
] as const

async function run([label, model, files]: (typeof runs)[number]) {
  let usage: any
  let servedModel: string | undefined
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init)
    try {
      const body = await response.clone().json()
      usage = body.usage
      servedModel = body.model
    } catch {}
    return response
  }
  const reader = anthropicTeamReader({ apiKey, model, fetch })
  const images = files.map((f) => ({ type: 'image/png' as const, bytes: readFileSync(`${DIR}/${f}`) }))
  const started = performance.now()
  try {
    const seen = await reader.read(images)
    const seconds = (performance.now() - started) / 1000
    const draft = readSeenTeam(seen)
    writeFileSync(`${OUT}/run-${label}.json`, JSON.stringify({ seen, draft, usage, servedModel }, null, 2))
    const [pin, pout] = PRICES[model]
    const cost = (usage.input_tokens * pin + usage.output_tokens * pout) / 1e6
    const errors: string[] = []
    for (const t of truth) {
      const got = draft.pokemon.find((p) => p.species === t.species)
      if (!got) { errors.push(`${t.species}: missing`); continue }
      for (const field of ['ability', 'item', 'nature'] as const)
        if (got[field] !== t[field]) errors.push(`${t.species}.${field}: ${got[field] ?? '∅'} (want ${t[field]})`)
      if (JSON.stringify(got.moves) !== JSON.stringify(t.moves)) errors.push(`${t.species}.moves: ${got.moves.join(',')}`)
      for (const [stat, v] of Object.entries(t.sp))
        if ((got.statPoints as any)[stat] !== v) errors.push(`${t.species}.sp.${stat}: ${(got.statPoints as any)[stat]} (want ${v})`)
    }
    const extra = draft.pokemon.filter((p) => !truth.some((t) => t.species === p.species)).map((p) => p.species)
    if (extra.length) errors.push(`unexpected species: ${extra.join(',')}`)
    return { label, model: servedModel, images: files.length, seconds: +seconds.toFixed(1), input: usage.input_tokens, output: usage.output_tokens, cost: +cost.toFixed(4), name: draft.name, errors, flags: draft.flags.map((f) => `${f.path.join('.')}: ${f.message}`) }
  } catch (error: any) {
    return { label, failed: error?.reason ?? String(error), seconds: +((performance.now() - started) / 1000).toFixed(1), usage }
  }
}

const results = await Promise.all(runs.map(run))
writeFileSync(`${OUT}/baseline-summary.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
