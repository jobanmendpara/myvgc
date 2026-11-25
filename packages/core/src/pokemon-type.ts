// The 18 types and a move's power and accuracy, as the names list carries them (ADR 17). Like the
// Stat Alignments they are hard-coded here, so the web app has each Type icon's name with no
// look-up and without loading Showdown's data.

/** One of the 18 types, by its lower-case Showdown ID (`fire`) and display name. */
export interface PokemonType {
  id: TypeId
  name: string
}

/**
 * The 18 types, in the games' order. Stellar is not one of them: it exists only for
 * Terastallization, which Champions doesn't have.
 */
export const TYPES = [
  { id: 'normal', name: 'Normal' },
  { id: 'fire', name: 'Fire' },
  { id: 'water', name: 'Water' },
  { id: 'electric', name: 'Electric' },
  { id: 'grass', name: 'Grass' },
  { id: 'ice', name: 'Ice' },
  { id: 'fighting', name: 'Fighting' },
  { id: 'poison', name: 'Poison' },
  { id: 'ground', name: 'Ground' },
  { id: 'flying', name: 'Flying' },
  { id: 'psychic', name: 'Psychic' },
  { id: 'bug', name: 'Bug' },
  { id: 'rock', name: 'Rock' },
  { id: 'ghost', name: 'Ghost' },
  { id: 'dragon', name: 'Dragon' },
  { id: 'dark', name: 'Dark' },
  { id: 'steel', name: 'Steel' },
  { id: 'fairy', name: 'Fairy' },
] as const satisfies readonly { id: string; name: string }[]

export type TypeId = (typeof TYPES)[number]['id']

/** A type's display name, or undefined for an ID that isn't one of the 18. */
export function typeName(id: string): string | undefined {
  return TYPES.find((type) => type.id === id)?.name
}

/**
 * A damaging move's power and accuracy. A status move has neither, so the names list leaves it
 * out. `power` is null when it varies (Low Kick) or the move deals fixed damage (Seismic Toss);
 * `accuracy` is a percentage, or null when the move never misses (Kowtow Cleave).
 */
export interface MovePowerAccuracy {
  power: number | null
  accuracy: number | null
}
