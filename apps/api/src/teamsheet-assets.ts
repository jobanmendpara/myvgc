import { readFile } from 'node:fs/promises'

// The bundled team list and font (ADR 18, ADR 28). Relative to this file, which sits one folder
// below apps/api both as source (src/) and when bundled (dist/server.js).
const ASSETS = new URL('../assets/', import.meta.url)

let assets: Promise<{ template: Uint8Array; font: Uint8Array }> | undefined

/** The blank team list and DejaVu Sans, read once on first use. */
export const teamsheetAssets = () =>
  (assets ??= Promise.all([
    readFile(new URL('team-list/play-pokemon-vg-team-list.pdf', ASSETS)),
    readFile(new URL('fonts/DejaVuSans.ttf', ASSETS)),
  ]).then(([template, font]) => ({ template, font })))
