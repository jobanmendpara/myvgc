<script setup lang="ts">
import {
  MAX_NOTES_LENGTH,
  MAX_REPLICA_TEAM_ID_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAM_SIZE,
  REGULATIONS,
  type ReadTeamView,
  type TeamBody,
  type TeamView,
  buildProblems,
  teamProblems,
  teamSchema,
} from '@myvgc/core/schema'
import { useMediaQuery } from '@vueuse/core'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { fieldErrorsOf, saveFailureMessage } from '@/lib/api'
import { blankBuild, draftErrors, draftToBody, readTeamToDraft, teamToDraft } from '@/lib/team-form'

/** The one form that creates and edits a Team. `save` sends it; this form does the rest. */
const props = defineProps<{
  initial?: TeamView
  /** A draft read from a file (ADR 24), to review before it's saved. */
  read?: ReadTeamView
  save: (body: TeamBody) => Promise<TeamView>
  cancelTo: string
}>()

const draft = reactive(props.read ? readTeamToDraft(props.read) : teamToDraft(props.initial))
// A draft read from a file isn't saved anywhere yet, so leaving it always asks.
const savedBody = props.read ? '' : JSON.stringify(draftToBody(draft))
const flagged = computed(() => draft.pokemon.some((build) => build.readFlags.length > 0))

const editing = ref<number | null>(null)
const editorOpen = computed({
  get: () => editing.value !== null,
  set: (open) => {
    if (!open) editing.value = null
  },
})

function add() {
  draft.pokemon.push(blankBuild())
  editing.value = draft.pokemon.length - 1
}

function reorder(from: number, to: number) {
  if (to < 0 || to >= draft.pokemon.length || from === to) return
  draft.pokemon.splice(to, 0, ...draft.pokemon.splice(from, 1))
}

// Dragging a slot onto another, with a mouse or trackpad.
const finePointer = useMediaQuery('(pointer: fine)')
const dragging = ref<number | null>(null)
function startDrag(event: DragEvent, index: number) {
  dragging.value = index
  // Firefox only starts a drag that carries data.
  event.dataTransfer?.setData('text/plain', String(index))
}
function drop(to: number) {
  if (dragging.value !== null) reorder(dragging.value, to)
  dragging.value = null
}

// Warnings only: nothing here stops a save (ADR 18).
const legality = useTeamLegality(draft)
const problemsOf = (index: number) => (legality.value ? buildProblems(legality.value, index) : [])

const queryClient = useQueryClient()
const saved = ref(false)
const save = useMutation({
  mutationFn: props.save,
  // Teams are online only (ADR 17): say so now, rather than saving whenever a signal returns.
  networkMode: 'always',
  onSuccess: async (team) => {
    saved.value = true
    queryClient.setQueryData(['team', team.id], team)
    await queryClient.invalidateQueries({ queryKey: ['teams'] })
    await queryClient.invalidateQueries({ queryKey: ['team', team.id, 'paste'] })
    useImportWarnings(team.id).value = []
    await navigateTo(`/teams/${team.id}`)
  },
})

const attempted = ref(false)
const localErrors = computed(() => draftErrors(draft))
// Stat Points and moves say what's wrong as soon as it's wrong; a field left empty waits for Save.
const errors = computed<Record<string, string>>(() => ({
  ...(attempted.value
    ? localErrors.value
    : Object.fromEntries(
        Object.entries(localErrors.value).filter(([field]) => /\.(statPoints|moves)/.test(field)),
      )),
  ...fieldErrorsOf(save.error.value),
}))
const slotError = (index: number) =>
  Object.entries(errors.value).find(
    ([field]) => field === `pokemon.${index}` || field.startsWith(`pokemon.${index}.`),
  )?.[1]
const failure = computed(() =>
  save.error.value && !fieldErrorsOf(save.error.value)
    ? saveFailureMessage(save.error.value, 'Team')
    : '',
)
const blocked = computed(() => attempted.value && Object.keys(localErrors.value).length > 0)

// What the API said was about the form as it was sent.
watch(draft, () => {
  if (save.error.value) save.reset()
})

function submit() {
  attempted.value = true
  const body = teamSchema.safeParse(draftToBody(draft))
  if (body.success) save.mutate(body.data)
}

// Leaving with unsaved edits asks first. On a phone the editor is a step inside this page, so
// the back button closes it rather than leaving.
const dirty = computed(() => !saved.value && JSON.stringify(draftToBody(draft)) !== savedBody)

onBeforeRouteLeave(() => {
  if (editing.value === null) return true
  editing.value = null
  return false
})
const { DiscardDialog } = useDiscardGuard(dirty, 'this Team')
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <div class="flex flex-col gap-2">
      <Label for="name">Name</Label>
      <Input
        id="name"
        v-model="draft.name"
        autocomplete="off"
        required
        :maxlength="MAX_TEAM_NAME_LENGTH"
        :aria-invalid="errors.name ? true : undefined"
        aria-describedby="name-error"
      />
      <p v-if="errors.name" id="name-error" class="text-destructive text-sm">{{ errors.name }}</p>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="regulation">Regulation</Label>
      <NativeSelect id="regulation" v-model="draft.regulation" class="w-40">
        <NativeSelectOption v-for="reg in REGULATIONS" :key="reg" :value="reg">
          Reg {{ reg }}
        </NativeSelectOption>
      </NativeSelect>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="replica-team-id"
        >Replica Team ID <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Input
        id="replica-team-id"
        v-model="draft.replicaTeamId"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        class="w-60 font-mono uppercase"
        placeholder="9TCG84KWXK"
        :maxlength="MAX_REPLICA_TEAM_ID_LENGTH"
        :aria-invalid="errors.replicaTeamId ? true : undefined"
        aria-describedby="replica-team-id-hint replica-team-id-error"
      />
      <p id="replica-team-id-hint" class="text-muted-foreground text-sm">
        The code Champions gives this Battle Team as a Replica Team, for when a judge asks.
      </p>
      <p v-if="errors.replicaTeamId" id="replica-team-id-error" class="text-destructive text-sm">
        {{ errors.replicaTeamId }}
      </p>
    </div>

    <section class="flex flex-col gap-2" aria-labelledby="slots-title">
      <h2 id="slots-title" class="text-sm leading-none font-medium">Pokémon</h2>
      <Alert v-if="flagged" data-testid="read-flags-note">
        <AlertDescription
          >MyVGC wasn't sure of everything on the file. Check the Pokémon marked below before
          saving.</AlertDescription
        >
      </Alert>
      <ol class="flex flex-col gap-2" data-testid="build-slots">
        <BuildSlot
          v-for="(build, index) in draft.pokemon"
          :key="build.key"
          :build="build"
          :index="index"
          :count="draft.pokemon.length"
          :error="slotError(index)"
          :problems="problemsOf(index)"
          :flags="build.readFlags"
          :draggable="finePointer"
          @dragstart="startDrag($event, index)"
          @dragend="dragging = null"
          @dragover.prevent
          @drop.prevent="drop(index)"
          @edit="editing = index"
          @remove="draft.pokemon.splice(index, 1)"
          @reorder="(to: number) => reorder(index, to)"
        />
        <li
          v-for="empty in MAX_TEAM_SIZE - draft.pokemon.length"
          :key="`empty-${empty}`"
          data-testid="empty-slot"
        >
          <button
            type="button"
            class="text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 min-h-14 w-full rounded-lg border border-dashed px-4 text-left text-sm outline-none focus-visible:ring-3"
            @click="add"
          >
            Add a Pokémon
          </button>
        </li>
      </ol>
      <p v-if="errors.pokemon" class="text-destructive text-sm">{{ errors.pokemon }}</p>
      <LegalityWarnings
        v-if="legality && teamProblems(legality).length"
        :problems="teamProblems(legality)"
        data-testid="team-problems"
      />
    </section>

    <div class="flex flex-col gap-2">
      <Label for="notes"
        >Notes <span class="text-muted-foreground font-normal">(optional)</span></Label
      >
      <Textarea
        id="notes"
        v-model="draft.notes"
        rows="4"
        :maxlength="MAX_NOTES_LENGTH"
        placeholder="Leads, game plans, things to remember…"
        :aria-invalid="errors.notes ? true : undefined"
        aria-describedby="notes-error"
      />
      <p v-if="errors.notes" id="notes-error" class="text-destructive text-sm">
        {{ errors.notes }}
      </p>
    </div>

    <Alert v-if="blocked" variant="destructive" role="alert">
      <AlertDescription>Fix the problems marked above. Nothing was saved.</AlertDescription>
    </Alert>
    <Alert v-else-if="failure" variant="destructive" role="alert">
      <AlertDescription>{{ failure }}</AlertDescription>
    </Alert>

    <p class="text-sm empty:hidden sm:text-right" role="status" data-testid="legality-note">
      <template v-if="legality?.status === 'illegal'"
        >This Team isn't legal in {{ legality.regulation }}.</template
      >
      <template v-else-if="legality?.status === 'unchecked'"
        >MyVGC has no rules for {{ legality.regulation }}, so this Team isn't checked.</template
      >
    </p>

    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button as-child variant="outline" size="lg"
        ><NuxtLink :to="props.cancelTo">Cancel</NuxtLink></Button
      >
      <Button type="submit" size="lg" :disabled="save.isPending.value">
        {{ save.isPending.value ? 'Saving…' : 'Save Team' }}
      </Button>
    </div>

    <BuildEditor
      v-if="editing !== null && draft.pokemon[editing]"
      v-model:open="editorOpen"
      v-model:build="draft.pokemon[editing]!"
      :index="editing"
      :errors="errors"
      :problems="problemsOf(editing)"
    />

    <DiscardDialog />
  </form>
</template>
