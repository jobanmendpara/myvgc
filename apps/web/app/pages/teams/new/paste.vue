<script setup lang="ts">
import {
  DEFAULT_REGULATION,
  MAX_PASTE_LENGTH,
  REGULATIONS,
  type Regulation,
} from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { type CreatedTeam, type CreateTeamError, toCreateTeamError } from '@/lib/api'

useHead({ title: 'Import a Team · MyVGC' })
const cancelTo = useNewTeamCancelTo()

const name = ref('')
const regulation = ref<Regulation>(DEFAULT_REGULATION)
const paste = ref('')
const notes = ref('')

// The paste as it was sent, so line errors still point at the right text after edits.
const sentLines = ref<string[]>([])
const problem = ref<CreateTeamError | null>(null)

const queryClient = useQueryClient()
const save = useMutation({
  mutationFn: () => {
    sentLines.value = paste.value.split(/\r?\n/)
    return $fetch<CreatedTeam>('/api/teams', {
      method: 'POST',
      body: {
        name: name.value,
        regulation: regulation.value,
        paste: paste.value,
        notes: notes.value,
      },
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
    await navigateTo(`/teams/${team.id}`)
  },
})

const fieldError = (field: string) =>
  problem.value?.kind === 'fields' ? problem.value.fields[field] : undefined

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
      <div class="flex flex-col gap-2">
        <Label for="name">Name</Label>
        <Input
          id="name"
          v-model="name"
          autocomplete="off"
          required
          :aria-invalid="fieldError('name') ? true : undefined"
          aria-describedby="name-error"
        />
        <p v-if="fieldError('name')" id="name-error" class="text-destructive text-sm">
          {{ fieldError('name') }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="regulation">Regulation</Label>
        <NativeSelect id="regulation" v-model="regulation" class="w-40">
          <NativeSelectOption v-for="reg in REGULATIONS" :key="reg" :value="reg">
            Reg {{ reg }}
          </NativeSelectOption>
        </NativeSelect>
      </div>

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
          :aria-invalid="problem?.kind === 'paste' || fieldError('paste') ? true : undefined"
          aria-describedby="paste-problems paste-error"
        />
        <p v-if="fieldError('paste')" id="paste-error" class="text-destructive text-sm">
          {{ fieldError('paste') }}
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

      <div class="flex flex-col gap-2">
        <Label for="notes"
          >Notes <span class="text-muted-foreground font-normal">(optional)</span></Label
        >
        <Textarea
          id="notes"
          v-model="notes"
          rows="4"
          placeholder="Leads, game plans, things to remember…"
        />
      </div>

      <Alert v-if="problem?.kind === 'other'" variant="destructive" role="alert">
        <AlertDescription>{{ problem.message }}</AlertDescription>
      </Alert>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button as-child variant="outline" size="lg"
          ><NuxtLink :to="cancelTo">Cancel</NuxtLink></Button
        >
        <Button type="submit" size="lg" :disabled="save.isPending.value">
          {{ save.isPending.value ? 'Saving…' : 'Save Team' }}
        </Button>
      </div>
    </form>
  </div>
</template>
