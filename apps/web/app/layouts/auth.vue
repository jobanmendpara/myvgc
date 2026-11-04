<template>
  <div class="flex min-h-dvh flex-col">
    <header class="border-b">
      <div
        class="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
      >
        <p class="text-lg font-semibold">MyVGC</p>
        <ThemePicker />
      </div>
    </header>
    <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
      <slot />
    </main>
  </div>
</template>
