// While the mode is System, follow the device when it switches between light and dark.
export default defineNuxtPlugin(() => {
  const { apply } = useTheme()
  apply()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
})
