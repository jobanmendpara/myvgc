<script setup lang="ts">
import { type TeamView, buildProblems, teamProblems, today } from '@myvgc/core/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { FetchError } from 'ofetch'

const route = useRoute()
const id = computed(() => String(route.params.id))
const queryClient = useQueryClient()

const teamQuery = useQuery({
  queryKey: computed(() => ['team', id.value]),
  queryFn: () => $fetch<TeamView>(`/api/teams/${id.value}`),
  retry: (count, error) => !(error instanceof FetchError && error.statusCode === 404) && count < 1,
})
const team = teamQuery.data
const notFound = computed(
  () => teamQuery.error.value instanceof FetchError && teamQuery.error.value.statusCode === 404,
)
const warnings = useImportWarnings(id.value)

useHead({ title: computed(() => (team.value ? `${team.value.name} · MyVGC` : 'Team · MyVGC')) })

// Copying. Safari only lets a page write to the clipboard during the tap itself, so the paste
// is fetched as soon as the Team loads and the tap copies it straight away. If it hasn't
// arrived yet, a ClipboardItem holding the pending fetch still counts as part of the tap.
// The clipboard API also needs a secure origin (https or localhost), so a self-hosted install
// on a LAN address falls back to showing the paste to copy by hand.
const fetchPaste = () => $fetch<string>(`/api/teams/${id.value}/paste`, { responseType: 'text' })
const pasteQuery = useQuery({
  queryKey: computed(() => ['team', id.value, 'paste']),
  queryFn: fetchPaste,
  enabled: computed(() => Boolean(team.value)),
})

type CopyState = 'idle' | 'copying' | 'copied' | 'manual' | 'failed'
const copyState = ref<CopyState>('idle')
const manualPaste = ref('')

async function writeToClipboard(): Promise<void> {
  const ready = pasteQuery.data.value
  if (ready !== undefined) return navigator.clipboard.writeText(ready)
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = fetchPaste().then((text) => new Blob([text], { type: 'text/plain' }))
    return navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
  }
  return navigator.clipboard.writeText(await fetchPaste())
}

async function copyPaste() {
  copyState.value = 'copying'
  try {
    await writeToClipboard()
    copyState.value = 'copied'
    setTimeout(() => {
      if (copyState.value === 'copied') copyState.value = 'idle'
    }, 2500)
    return
  } catch {
    // Fall through: show the paste to copy by hand, if it can be fetched.
  }
  try {
    manualPaste.value = pasteQuery.data.value ?? (await fetchPaste())
  } catch {
    copyState.value = 'failed'
    return
  }
  copyState.value = 'manual'
  await nextTick()
  const box = document.getElementById('manual-paste') as HTMLTextAreaElement | null
  box?.focus()
  box?.select()
}

const confirmingDelete = ref(false)
const remove = useMutation({
  mutationFn: () => {
    // A plain string URL keeps Nuxt's route-typed $fetch from recursing through every route.
    const url: string = `/api/teams/${id.value}`
    return $fetch<null>(url, { method: 'DELETE' })
  },
  onSuccess: async () => {
    const deletedId = id.value
    confirmingDelete.value = false
    await queryClient.invalidateQueries({ queryKey: ['teams'] })
    // Leave first, so this page never shows "Team not found" for the Team just deleted.
    await navigateTo('/teams')
    queryClient.removeQueries({ queryKey: ['team', deletedId] })
  },
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <ListBackLink to="/teams">Your Teams</ListBackLink>

    <p v-if="teamQuery.isPending.value" class="text-muted-foreground">Loading…</p>

    <Card v-else-if="notFound">
      <CardHeader>
        <CardTitle>Team not found</CardTitle>
        <CardDescription>It may have been deleted, or the link is wrong.</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button as-child variant="outline"
          ><NuxtLink to="/teams">Back to your Teams</NuxtLink></Button
        >
      </CardFooter>
    </Card>

    <Alert v-else-if="teamQuery.isError.value" variant="destructive" role="alert">
      <AlertDescription
        >Couldn't load this Team. Check your connection and try again.</AlertDescription
      >
    </Alert>

    <template v-else-if="team">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2" data-testid="team-header">
          <h1 class="min-w-0 text-2xl font-semibold break-words" data-testid="team-name">
            {{ team.name }}
          </h1>
          <Badge variant="secondary">Reg {{ team.regulation }}</Badge>
          <LegalityBadge :legality="team.legality" />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button :disabled="copyState === 'copying'" data-testid="copy-paste" @click="copyPaste">
            {{ copyState === 'copied' ? 'Copied' : 'Copy paste' }}
          </Button>
          <Button as-child variant="outline"
            ><NuxtLink :to="`/teams/${id}/edit`">Edit</NuxtLink></Button
          >
          <TeamsheetExport
            :url="`/api/teams/${id}/teamsheet`"
            :team-name="team.name"
            :legality="team.legality"
            :season-date="today()"
          />
          <Button variant="outline" class="text-destructive" @click="confirmingDelete = true"
            >Delete</Button
          >
        </div>
        <p class="sr-only" aria-live="polite">
          {{ copyState === 'copied' ? 'Paste copied to the clipboard.' : '' }}
        </p>
        <Alert v-if="copyState === 'failed'" variant="destructive" role="alert">
          <AlertDescription
            >Couldn't get the paste. Check your connection and try again.</AlertDescription
          >
        </Alert>
        <div v-if="copyState === 'manual'" class="flex flex-col gap-2">
          <Label for="manual-paste"
            >This browser blocked copying. Select the paste and copy it.</Label
          >
          <Textarea
            id="manual-paste"
            :model-value="manualPaste"
            readonly
            rows="10"
            class="font-mono text-sm"
          />
        </div>
      </div>

      <Alert v-if="warnings.length" role="status" data-testid="import-warnings">
        <AlertTitle>
          Saved, with {{ warnings.length === 1 ? '1 line' : `${warnings.length} lines` }} ignored
        </AlertTitle>
        <AlertDescription>
          <ul class="flex flex-col gap-1">
            <li v-for="warning in warnings" :key="`${warning.line}:${warning.message}`">
              Line {{ warning.line }}: {{ warning.message }}
            </li>
          </ul>
          <Button variant="outline" size="sm" class="mt-2" @click="warnings = []">Dismiss</Button>
        </AlertDescription>
      </Alert>

      <Alert v-if="teamProblems(team.legality).length" data-testid="team-problems">
        <AlertDescription>
          <LegalityWarnings :problems="teamProblems(team.legality)" />
        </AlertDescription>
      </Alert>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="team-pokemon">
        <PokemonBuildCard
          v-for="(build, index) in team.pokemon"
          :key="index"
          :build="build"
          :problems="buildProblems(team.legality, index)"
        />
      </div>

      <section class="flex flex-col gap-1">
        <h2 class="font-medium">Notes</h2>
        <p
          v-if="team.notes"
          class="max-w-prose text-sm whitespace-pre-wrap break-words"
          data-testid="team-notes"
        >
          {{ team.notes }}
        </p>
        <p v-else class="text-muted-foreground text-sm">No notes.</p>
      </section>

      <AlertDialog v-model:open="confirmingDelete">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {{ team.name }}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the Team and its notes. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert v-if="remove.isError.value" variant="destructive" role="alert">
            <AlertDescription>Couldn't delete the Team. Try again.</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="remove.isPending.value">Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              :disabled="remove.isPending.value"
              @click="remove.mutate()"
            >
              {{ remove.isPending.value ? 'Deleting…' : 'Delete Team' }}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>
