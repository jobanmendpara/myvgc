// Domain logic for MyVGC. No I/O, so the API and the web app can both use it.
export * from './build'
export { champions, displayName, type ChampionsKind, type Named } from './champions'
export { readPaste, writePaste, type PasteIssue, type ReadPasteResult } from './paste'
