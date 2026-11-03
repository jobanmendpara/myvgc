// @pkmn/mods ships types for its subpaths, but its package.json "exports" doesn't point at
// them, so TypeScript can't find them. The data is cast to ModData where it's used.
declare module '@pkmn/mods/champions' {
  export const Abilities: unknown
  export const Conditions: unknown
  export const Formats: unknown
  export const FormatsData: unknown
  export const Items: unknown
  export const Learnsets: unknown
  export const Moves: unknown
  export const Rulesets: unknown
  export const Scripts: unknown
}
