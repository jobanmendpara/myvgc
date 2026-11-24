<script setup lang="ts">
import { MAX_PASTE_LENGTH, type TeamFields, pickTeamFields } from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { type CreatedTeam, type CreateTeamError, toCreateTeamError } from '@/lib/api'
import { teamPath } from '@/lib/paths'
import { newTeamFields } from '@/lib/team-form'

useHead({ title: 'Import a Team · MyVGC' })
const cancelTo = useNewTeamCancelTo()

const fields = reactive<TeamFields>(newTeamFields())
// The paste isn't one of the Team's fields: it becomes its Pokémon builds.
const paste = ref('')

// The paste as it was sent, so line errors still point at the right text after edits.
const sentLines = ref<string[]>([])
const problem = ref<CreateTeamError | null>(null)

// Reading a paste needs the server's Champions data, so importing stays online-only (ADR 17).
const online = useOnline()
const queryClient = useQueryClient()
const save = useMutation({
  // Says at once that it couldn't be saved, rather than saving whenever a signal returns.
  networkMode: 'always',
  mutationFn: () => {
    sentLines.value = paste.value.split(/\r?\n/)
    return $fetch<CreatedTeam>('/api/teams', {
      method: 'POST',
      body: { ...pickTeamFields(fields), paste: paste.value },
    })
  },
  onMutate: () => {
    problem.value = null
  },
  onError: (error) => {
    problem.value = toCreateTeamError(error)
    if (problem.value.kind === 'paste')
      nextTick(() => document.getElementById('paste-problems')?.focus())
  },
  onSuccess: async ({ team, warnings }) => {
    queryClient.setQueryData(['team', team.id], team)
    await queryClient.invalidateQueries({ queryKey: ['teams'] })
    useImportWarnings(team.id).value = warnings
    await navigateTo(teamPath(team.id))
  },
})

const fieldErrors = computed(() => (problem.value?.kind === 'fields' ? problem.value.fields : {}))

/** Selects a line in the paste box, so the User can fix it there. */
function showLine(line: number) {
  const box = document.getElementById('paste') as HTMLTextAreaElement | null
  if (!box) return
  const lines = box.value.split('\n')
  const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0)
  box.focus()
  box.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0))
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">Import a Team</h1>
      <p class="text-muted-foreground text-sm">
        Paste a Pokémon Champions Team exported from Showdown. The EVs line holds Stat Points.
      </p>
    </div>

    <form class="flex flex-col gap-5" novalidate @submit.prevent="save.mutate()">
      <TeamFieldsSection v-model:fields="fields" :errors="fieldErrors">
        <div class="flex flex-col gap-2">
          <Label for="paste">Paste</Label>
          <Textarea
            id="paste"
            v-model="paste"
            rows="14"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            :maxlength="MAX_PASTE_LENGTH"
            class="font-mono text-sm"
            :placeholder="'Incineroar @ Sitrus Berry\nAbility: Intimidate\nEVs: 32 HP / 2 Atk / 32 SpD\nCareful Nature\n- Fake Out\n- Parting Shot'"
            :aria-invalid="problem?.kind === 'paste' || fieldErrors.paste ? true : undefined"
            aria-describedby="paste-problems paste-error"
          />
          <p v-if="fieldErrors.paste" id="paste-error" class="text-destructive text-sm">
            {{ fieldErrors.paste }}
          </p>
        </div>

        <section
          v-if="problem?.kind === 'paste'"
          id="paste-problems"
          tabindex="-1"
          class="border-destructive/50 flex flex-col gap-3 rounded-lg border p-3 outline-none"
          aria-labelledby="paste-problems-title"
        >
          <h2 id="paste-problems-title" class="text-destructive font-medium">
            {{ problem.errors.length === 1 ? '1 problem' : `${problem.errors.length} problems` }} in
            the paste. Nothing was saved.
          </h2>
          <ol class="flex flex-col gap-3" data-testid="paste-errors">
            <li
              v-for="error in problem.errors"
              :key="`${error.line}:${error.message}`"
              class="flex flex-col gap-1"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">Line {{ error.line }}</span>
                <Button type="button" variant="ghost" size="sm" @click="showLine(error.line)">
                  Show in paste
                </Button>
              </div>
              <code
                v-if="sentLines[error.line - 1]"
                class="bg-muted overflow-x-auto rounded px-2 py-1 font-mono text-sm whitespace-pre"
                >{{ sentLines[error.line - 1] }}</code
              >
              <p class="text-destructive text-sm">{{ error.message }}</p>
            </li>
          </ol>
        </section>
      </TeamFieldsSection>

      <Alert v-if="problem?.kind === 'other'" variant="destructive" role="alert">
        <AlertDescription>{{ problem.message }}</AlertDescription>
      </Alert>
      <p v-if="!online" class="text-muted-foreground text-sm" role="status">
        Importing a paste needs a connection. With no signal, build the Team instead.
      </p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button as-child variant="outline" size="lg"
          ><NuxtLink :to="cancelTo">Cancel</NuxtLink></Button
        >
        <Button type="submit" size="lg" :disabled="!online || save.isPending.value">
          {{ save.isPending.value ? 'Saving…' : 'Save Team' }}
        </Button>
      </div>
    </form>
  </div>
</template>
