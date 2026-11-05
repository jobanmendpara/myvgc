import {
  applyTheme,
  MODE_KEY,
  PALETTE_KEY,
  parseMode,
  parsePalette,
  type Mode,
  type Palette,
} from '@/lib/theme'
import { readStored, writeStored } from '@/lib/storage'

// Shared by every ThemePicker on the page. The state starts from what is stored on this device.
export function useTheme() {
  const palette = useState<Palette>('theme-palette', () => parsePalette(readStored(PALETTE_KEY)))
  const mode = useState<Mode>('theme-mode', () => parseMode(readStored(MODE_KEY)))
  // The mode actually showing (light or dark), which differs from `mode` while it is System.
  const resolvedMode = useState<'light' | 'dark'>('theme-resolved-mode', () => 'light')

  function apply() {
    resolvedMode.value = applyTheme(palette.value, mode.value)
  }

  function setPalette(value: unknown) {
    palette.value = parsePalette(value)
    writeStored(PALETTE_KEY, palette.value)
    apply()
  }

  function setMode(value: unknown) {
    mode.value = parseMode(value)
    writeStored(MODE_KEY, mode.value)
    apply()
  }

  return { palette, mode, resolvedMode, apply, setPalette, setMode }
}
