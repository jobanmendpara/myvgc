<script setup lang="ts">
import { MODES, PALETTES } from '@/lib/theme'

const { palette, mode, setPalette, setMode } = useTheme()

// The setters validate the value, so a select can never store anything unknown.
const paletteModel = computed({ get: () => palette.value, set: setPalette })
const modeModel = computed({ get: () => mode.value, set: setMode })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="theme-picker">
    <NativeSelect v-model="paletteModel" aria-label="Palette">
      <NativeSelectOption v-for="p in PALETTES" :key="p.value" :value="p.value">
        {{ p.label }}
      </NativeSelectOption>
    </NativeSelect>
    <NativeSelect v-model="modeModel" aria-label="Mode">
      <NativeSelectOption v-for="m in MODES" :key="m.value" :value="m.value">
        {{ m.label }}
      </NativeSelectOption>
    </NativeSelect>
  </div>
</template>
