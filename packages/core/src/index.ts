// Domain logic for MyVGC. No I/O, so the API and the web app can both use it.
// This entry point loads the Champions data (about 900 KB gzipped); the web app imports
// `@myvgc/core/schema` instead.
export * from './schema'
export { champions, displayName, type ChampionsKind, type Named } from './champions'
export { nameBuild } from './names'
export { readPaste, writePaste, type PasteIssue, type ReadPasteResult } from './paste'
