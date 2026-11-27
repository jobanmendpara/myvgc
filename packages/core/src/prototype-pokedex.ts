// PROTOTYPE (DEV-264), throwaway: never merge to main. A rough stand-in for `GET /api/pokedex`
// (DEV-263), so the Pokédex prototype has descriptions, move fields, weights, learnsets and the
// type chart to show. No tests, no corrections beyond PP.
import { championsNames, modDexes, modLearnsets } from './champions'

const dex = modDexes.champions

export interface PrototypePokedex {
  species: Record<
    string,
    {
      weightkg: number
      /** Ability IDs by slot: 0, 1, H. */
      abilitySlots: Record<string, string>
      baseSpecies: string
      forms: string[]
      learnset: string[]
      /** Mega Stone needed, if a Mega. */
      requiredItem?: string
    }
  >
  moves: Record<
    string,
    {
      category: 'Physical' | 'Special' | 'Status'
      pp: number
      priority: number
      target: string
      contact: boolean
      shortDesc: string
      desc: string
    }
  >
  items: Record<string, { shortDesc: string; desc: string; megaFor?: string }>
  abilities: Record<string, { shortDesc: string; desc: string }>
  /** damageTaken codes per defending type: 0 normal, 1 weak, 2 resists, 3 immune. */
  typeChart: Record<string, Record<string, number>>
}

let built: PrototypePokedex | undefined

export function prototypePokedex(): PrototypePokedex {
  if (built) return built
  const names = championsNames()
  const ids = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const species: PrototypePokedex['species'] = {}
  for (const id of Object.keys(names.species)) {
    const entry = dex.species.get(id)
    const base = dex.species.get(entry.baseSpecies)
    const learnsetKey = [id, ids(entry.changesFrom ?? ''), ids(entry.baseSpecies)].find(
      (key) => key && modLearnsets.champions[0]![key]?.learnset,
    )
    const learnset = learnsetKey
      ? Object.keys(modLearnsets.champions[0]![learnsetKey]!.learnset!).filter(
          (move) => move in names.moves,
        )
      : []
    const abilitySlots: Record<string, string> = {}
    for (const [slot, ability] of Object.entries(entry.abilities)) {
      if (ability) abilitySlots[slot] = ids(ability)
    }
    species[id] = {
      weightkg: entry.weightkg,
      abilitySlots,
      baseSpecies: base.id,
      forms: [base.id, ...(base.otherFormes ?? []).map(ids)].filter(
        (form) => form in names.species,
      ),
      learnset,
      ...(entry.requiredItem ? { requiredItem: ids(entry.requiredItem) } : {}),
    }
  }
  const moves: PrototypePokedex['moves'] = {}
  for (const id of Object.keys(names.moves)) {
    const move = dex.moves.get(id)
    const pp = move.noPPBoosts ? move.pp : (Math.min(move.pp, 20) / 5 + 1) * 4
    moves[id] = {
      category: move.category,
      pp,
      priority: move.priority,
      target: move.target,
      contact: !!move.flags.contact,
      shortDesc: move.shortDesc,
      desc: move.desc || move.shortDesc,
    }
  }
  const items: PrototypePokedex['items'] = {}
  for (const id of Object.keys(names.items)) {
    const item = dex.items.get(id)
    items[id] = {
      shortDesc: item.shortDesc,
      desc: item.desc || item.shortDesc,
      ...(item.megaStone ? { megaFor: ids(Object.values(item.megaStone)[0] ?? '') } : {}),
    }
  }
  const abilities: PrototypePokedex['abilities'] = {}
  for (const id of Object.keys(names.abilities)) {
    const ability = dex.abilities.get(id)
    abilities[id] = { shortDesc: ability.shortDesc, desc: ability.desc || ability.shortDesc }
  }
  const typeChart: PrototypePokedex['typeChart'] = {}
  for (const type of dex.types.all()) {
    if (type.id === 'stellar') continue
    typeChart[type.id] = Object.fromEntries(
      Object.entries(type.damageTaken)
        .filter(([attacker]) => /^[A-Z]/.test(attacker) && attacker !== 'Stellar')
        .map(([attacker, code]) => [attacker.toLowerCase(), code]),
    )
  }
  built = { species, moves, items, abilities, typeChart }
  return built
}
