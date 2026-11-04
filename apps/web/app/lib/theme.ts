// The site theme: a palette plus a mode. Both are kept per device in localStorage and applied
// as `data-palette` and `data-mode` on <html>. `data-mode` is always the resolved mode (light
// or dark), so the CSS never has to know about "system". The inline script in nuxt.config.ts
// repeats this logic before first paint, so keep the two in step.

export const PALETTES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'pikachu', label: 'Pikachu' },
  { value: 'lapras', label: 'Lapras' },
] as const

export const MODES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const

export type Palette = (typeof PALETTES)[number]['value']
export type Mode = (typeof MODES)[number]['value']

export const PALETTE_KEY = 'myvgc-palette'
export const MODE_KEY = 'myvgc-mode'
export const DEFAULT_PALETTE: Palette = 'neutral'
export const DEFAULT_MODE: Mode = 'system'

export function parsePalette(value: unknown): Palette {
  return PALETTES.find((p) => p.value === value)?.value ?? DEFAULT_PALETTE
}

export function parseMode(value: unknown): Mode {
  return MODES.find((m) => m.value === value)?.value ?? DEFAULT_MODE
}

export function resolveMode(mode: Mode, systemPrefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

// Storage can throw (private windows, blocked site data); the theme then just isn't kept.
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore: the choice still applies until the page is closed.
  }
}

export function applyTheme(palette: Palette, mode: Mode): 'light' | 'dark' {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const root = document.documentElement
  root.dataset.palette = palette
  const resolved = resolveMode(mode, dark)
  root.dataset.mode = resolved
  return resolved
}
