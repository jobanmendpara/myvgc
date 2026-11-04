<script setup lang="ts">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
} from 'reka-ui'
import { CheckIcon, ChevronDownIcon } from '@lucide/vue'
import { MODES, PALETTES } from '@/lib/theme'

const { palette, mode, resolvedMode, setPalette, setMode } = useTheme()
const current = computed(() => PALETTES.find((p) => p.value === palette.value) ?? PALETTES[0])
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="theme-picker">
    <SelectRoot :model-value="palette" @update:model-value="setPalette">
      <SelectTrigger
        aria-label="Palette"
        class="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 items-center gap-2 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
      >
        <ThemeSwatch :palette="current.value" :mode="resolvedMode" />
        <span>{{ current.label }}</span>
        <SelectIcon as-child>
          <ChevronDownIcon class="text-muted-foreground size-4 opacity-50" aria-hidden="true" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          position="popper"
          :side-offset="4"
          class="bg-popover text-popover-foreground z-50 min-w-40 overflow-hidden rounded-md border shadow-md"
        >
          <SelectViewport class="p-1">
            <SelectItem
              v-for="p in PALETTES"
              :key="p.value"
              :value="p.value"
              class="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none"
            >
              <ThemeSwatch :palette="p.value" :mode="resolvedMode" />
              <SelectItemText>{{ p.label }}</SelectItemText>
              <CheckIcon
                v-if="p.value === palette"
                class="absolute right-2 size-4"
                aria-hidden="true"
              />
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>

    <!-- A three-way toggle: native radios, so the keyboard and screen readers work as expected. -->
    <div
      role="radiogroup"
      aria-label="Mode"
      class="border-input bg-muted inline-flex h-9 items-center rounded-md border p-0.5"
    >
      <label
        v-for="m in MODES"
        :key="m.value"
        class="text-muted-foreground has-[:checked]:bg-background has-[:checked]:text-foreground has-[:focus-visible]:ring-ring/50 inline-flex h-full cursor-pointer items-center rounded-sm px-2.5 text-sm font-medium has-[:checked]:shadow-xs has-[:focus-visible]:ring-3"
      >
        <input
          type="radio"
          name="theme-mode"
          class="sr-only"
          :value="m.value"
          :checked="mode === m.value"
          @change="setMode(m.value)"
        />
        {{ m.label }}
      </label>
    </div>
  </div>
</template>
