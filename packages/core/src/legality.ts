import { type ChampionsMod, REGULATION_MODS } from './calendar'
import { modDexes, modLearnsets } from './champions'
import type { Legality, LegalityBuild, LegalityProblem, Regulation } from './team'

/** Species tags a Regulation bans. Sub-Legendary Pokémon are allowed. */
const BANNED_TAGS = ['Mythical', 'Restricted Legendary']

/** An entry's display name, or the stored ID when the data doesn't have it. */
const nameOf = (entry: { exists: boolean; name: string }, id: string) =>
  entry.exists ? entry.name : id

type Species = ReturnType<(typeof modDexes)[ChampionsMod]['species']['get']>

/**
 * The moves a species can learn in a mod's data, or undefined if the data has none for it. A Mega
 * or other battle-only form, and a cosmetic form such as a Vivillon pattern, has no learnset of its
 * own and learns what the form it comes from learns.
 */
function learnsetOf(mod: ChampionsMod, species: Species): Record<string, unknown> | undefined {
  const dex = modDexes[mod]
  const forms = [species.id, species.changesFrom, species.baseSpecies].filter((form) => form)
  for (const form of forms) {
    const id = dex.species.get(form!).id
    for (const learnsets of modLearnsets[mod]) {
      const learnset = learnsets[id]?.learnset
      if (learnset) return learnset
    }
  }
  return undefined
}

/** The first entry of each group sharing a key with another entry. */
function repeatedBy<T>(entries: readonly T[], key: (entry: T) => unknown): T[] {
  const keys = entries.map(key)
  return entries.filter(
    (_, index) => keys.indexOf(keys[index]) === index && keys.lastIndexOf(keys[index]) !== index,
  )
}

/**
 * Judges Pokémon builds against a Regulation's rules (ADR 18). This is a warning a Team can always
 * save past, so anything the data doesn't have, such as a name dropped by a data update, is one
 * more problem rather than a failure.
 */
export function judgeTeam(pokemon: readonly LegalityBuild[], regulation: Regulation): Legality {
  const mod = REGULATION_MODS[regulation]
  if (!mod) return { regulation, status: 'unchecked', problems: [] }

  const dex = modDexes[mod]
  const problems: LegalityProblem[] = []
  const notAllowed = (name: string) => `${name} isn't allowed in Reg ${regulation}.`

  pokemon.forEach((build, index) => {
    if (build.species === null) return
    const path = (field: string): LegalityProblem['path'] => ['pokemon', index, field]

    const species = dex.species.get(build.species)
    const name = nameOf(species, build.species)
    const banned = species.tags.find((tag) => BANNED_TAGS.includes(tag))
    if (banned) {
      problems.push({
        path: path('species'),
        message: `${name} is a ${banned} Pokémon, banned in Reg ${regulation}.`,
      })
    } else if (!species.exists || species.isNonstandard) {
      problems.push({ path: path('species'), message: notAllowed(name) })
    }

    if (build.ability && species.exists) {
      // A form that only exists in battle, such as a Mega, starts with its base form's ability.
      const forms = [species, ...[species.battleOnly ?? []].flat().map((n) => dex.species.get(n))]
      const own = forms.flatMap((form) => Object.values(form.abilities))
      const ability = dex.abilities.get(build.ability)
      if (!own.some((abilityName) => dex.abilities.get(abilityName).id === ability.id)) {
        problems.push({
          path: path('ability'),
          message: `${name} can't have ${nameOf(ability, build.ability)}.`,
        })
      }
    }

    // A species with no learnset in the data, such as a battle-only form of a species Champions
    // doesn't have, can't be judged on its moves.
    const learnset = species.exists ? learnsetOf(mod, species) : undefined
    build.moves?.forEach((moveId, moveIndex) => {
      const move = dex.moves.get(moveId)
      if (learnset && !(move.id in learnset)) {
        problems.push({
          path: ['pokemon', index, 'moves', moveIndex],
          message: `${name} can't learn ${nameOf(move, moveId)}.`,
        })
      }
    })

    if (build.item) {
      const item = dex.items.get(build.item)
      if (!item.exists || item.isNonstandard) {
        problems.push({
          path: path('item'),
          message: notAllowed(nameOf(item, build.item)),
        })
      }
    }
  })

  const allSpecies = pokemon.flatMap((build) =>
    build.species === null ? [] : [dex.species.get(build.species)],
  )
  const known = allSpecies.filter((species) => species.exists)
  for (const repeated of repeatedBy(known, (species) => species.num)) {
    problems.push({
      path: ['pokemon'],
      message: `Species Clause: more than one ${repeated.baseSpecies}.`,
    })
  }
  const items = pokemon.flatMap((build) =>
    build.species !== null && build.item ? [dex.items.get(build.item)] : [],
  )
  for (const repeated of repeatedBy(items, (item) => item.id)) {
    problems.push({
      path: ['pokemon'],
      message: `Item Clause: more than one ${nameOf(repeated, repeated.id)}.`,
    })
  }

  return { regulation, status: problems.length ? 'illegal' : 'legal', problems }
}
