<script setup lang="ts">
import type { NuxtError } from '#app'

// Shown when navigation fails: an unknown page, or the API not answering.
const props = defineProps<{ error: NuxtError }>()

const unreachable = computed(() => props.error.statusCode === 503)
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: unreachable.value ? "Can't reach the server · MyVGC" : 'MyVGC' })

function tryAgain() {
  // A full reload, so the session check runs again from scratch.
  window.location.reload()
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
    <p class="text-center text-xl font-semibold">MyVGC</p>
    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">
          {{
            unreachable
              ? "Can't reach the server"
              : notFound
                ? 'Page not found'
                : 'Something went wrong'
          }}
        </CardTitle>
        <CardDescription>
          <template v-if="unreachable">
            The MyVGC server didn't answer. If you run it yourself, check that it's running, then
            try again.
          </template>
          <template v-else-if="notFound">There's nothing at this address.</template>
          <template v-else>{{ error.statusMessage || 'Try again in a moment.' }}</template>
        </CardDescription>
      </CardHeader>
      <CardFooter class="flex flex-col gap-3 sm:flex-row">
        <Button v-if="!notFound" size="lg" class="w-full sm:w-auto" @click="tryAgain"
          >Try again</Button
        >
        <Button
          :variant="notFound ? 'default' : 'outline'"
          size="lg"
          class="w-full sm:w-auto"
          @click="clearError({ redirect: '/dashboard' })"
        >
          Go to your Dashboard
        </Button>
      </CardFooter>
    </Card>
  </main>
</template>
