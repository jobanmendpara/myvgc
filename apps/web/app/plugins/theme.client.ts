import { applyTheme } from '@/lib/theme'

// While the mode is System, follow the device when it switches between light and dark.
export default defineNuxtPlugin(() => {
  const { palette, mode } = useTheme()
  applyTheme(palette.value, mode.value)
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyTheme(palette.value, mode.value))
})
