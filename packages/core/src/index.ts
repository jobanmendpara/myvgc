// Domain logic for MyVGC. No I/O, so the API and the web app can both use it.
// This entry point loads the Champions data (about 900 KB gzipped); the web app imports
// `@myvgc/core/schema` instead.
export * from './schema'
export { champions, championsNames, displayName, type ChampionsKind } from './champions'
export { checkGames, checkPokemon, type PokemonIssue } from './check-pokemon'
export { judgeTeam } from './legality'
export { nameBuild } from './names'
export { readTeamsheet, type ReadTeamsheetResult } from './teamsheet'
export { readSeenTeam, seenTeamSchema, UNSURE_FIELDS, type SeenTeam } from './seen-team'
export { readPaste, writePaste, type PasteIssue, type ReadPasteResult } from './paste'
export {
  checkDataExport,
  importedPlayerDetails,
  settleImportedRound,
  type ImportAccount,
} from './data-import'
export {
  TEAM_LIST_SHA256,
  writeTeamsheet,
  type WriteTeamsheetInput,
  type WriteTeamsheetResult,
} from './teamsheet-writer'
