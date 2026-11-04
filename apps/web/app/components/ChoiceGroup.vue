<script setup lang="ts" generic="T extends string | number | boolean">
// A row of large tap targets for picking one of a few options, such as best of 1 or 3.
// It is a radio group underneath, so keyboards and screen readers work as usual.
const props = defineProps<{
  options: readonly { value: T; label: string }[]
  label: string
  name: string
}>()
const model = defineModel<T | undefined>()
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-sm leading-none font-medium select-none">{{ props.label }}</legend>
    <div class="flex flex-wrap gap-2">
      <label
        v-for="option in props.options"
        :key="String(option.value)"
        class="has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-ring/50 flex min-h-11 min-w-16 flex-1 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium has-[:focus-visible]:ring-3 sm:flex-none"
      >
        <input
          v-model="model"
          type="radio"
          class="sr-only"
          :name="props.name"
          :value="option.value"
        />
        {{ option.label }}
      </label>
    </div>
  </fieldset>
</template>
