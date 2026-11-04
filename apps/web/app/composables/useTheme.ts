import {
  applyTheme,
  MODE_KEY,
  PALETTE_KEY,
  parseMode,
  parsePalette,
  readStored,
  writeStored,
  type Mode,
  type Palette,
} from '@/lib/theme'

// Shared by every ThemePicker on the page. The state starts from what is stored on this device.
export function useTheme() {
  const palette = useState<Palette>('theme-palette', () => parsePalette(readStored(PALETTE_KEY)))
  const mode = useState<Mode>('theme-mode', () => parseMode(readStored(MODE_KEY)))

  function setPalette(value: unknown) {
    palette.value = parsePalette(value)
    writeStored(PALETTE_KEY, palette.value)
    applyTheme(palette.value, mode.value)
  }

  function setMode(value: unknown) {
    mode.value = parseMode(value)
    writeStored(MODE_KEY, mode.value)
    applyTheme(palette.value, mode.value)
  }

  return { palette, mode, setPalette, setMode }
}
