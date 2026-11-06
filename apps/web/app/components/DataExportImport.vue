<script setup lang="ts">
import { IMPORT_KINDS, IMPORT_KIND_LABELS, type ImportCounts } from '@myvgc/core/schema'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { FetchError } from 'ofetch'

/** Settings' Your data section: the Data export and its import. Online only (ADR 17, ADR 23). */
const online = useOnline()

interface Problem {
  record: string
  field: string
  message: string
}
const failure = ref<{ message: string; problems: Problem[] } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const queryClient = useQueryClient()
const importFile = useMutation({
  mutationFn: async (file: File) => {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(await file.text())
    } catch {
      throw new Error('That file isn’t a MyVGC Data export. Choose the .json file you exported.')
    }
    return $fetch<ImportCounts>('/api/import', { method: 'POST', body })
  },
  onMutate: () => {
    failure.value = null
  },
  onError: (error) => {
    if (error instanceof FetchError) {
      if (error.statusCode === 401)
        failure.value = { message: 'Your session has ended. Log in again to import.', problems: [] }
      else if (error.data?.error)
        failure.value = { message: error.data.error, problems: error.data.problems ?? [] }
      else
        failure.value = {
          message: 'Couldn’t import the file. Check your connection and try again.',
          problems: [],
        }
    } else failure.value = { message: (error as Error).message, problems: [] }
  },
  // Everything cached may now be out of date.
  onSuccess: () => queryClient.invalidateQueries(),
  onSettled: () => {
    if (fileInput.value) fileInput.value.value = ''
  },
})

function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) importFile.mutate(file)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <p v-if="!online" class="text-muted-foreground text-sm" role="status">
      Export and import need a connection.
    </p>

    <section class="flex flex-col gap-3" aria-labelledby="export-title">
      <h3 id="export-title" class="font-medium">Export</h3>
      <Alert>
        <AlertDescription>
          Changes still waiting to be sent from this device aren’t in the export. Let them sync
          first.
        </AlertDescription>
      </Alert>
      <div>
        <Button v-if="online" as-child>
          <a href="/api/export" download data-testid="export">Export your data</a>
        </Button>
        <Button v-else disabled>Export your data</Button>
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="import-title">
      <h3 id="import-title" class="font-medium">Import</h3>
      <p class="text-muted-foreground text-sm">
        Importing only adds what your account doesn’t have yet. Anything already here stays as it
        is, so importing the same file twice is harmless.
      </p>
      <div>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="sr-only"
          data-testid="import-file"
          @change="chooseFile"
        />
        <Button :disabled="!online || importFile.isPending.value" @click="fileInput?.click()">
          {{ importFile.isPending.value ? 'Importing…' : 'Import a file' }}
        </Button>
      </div>

      <Alert v-if="failure" variant="destructive" role="alert">
        <AlertTitle>Nothing was imported.</AlertTitle>
        <AlertDescription>
          <p>{{ failure.message }}</p>
          <ul v-if="failure.problems.length > 1" class="mt-2 list-disc pl-5">
            <li v-for="problem in failure.problems" :key="`${problem.field}:${problem.message}`">
              {{ problem.record }}: {{ problem.message }}
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <div v-if="importFile.data.value" role="status" data-testid="import-counts">
        <p class="mb-2 font-medium">Imported.</p>
        <table class="w-full max-w-md text-sm">
          <thead>
            <tr class="text-muted-foreground text-left">
              <th scope="col" class="py-1 font-normal"></th>
              <th scope="col" class="py-1 text-right font-normal">Added</th>
              <th scope="col" class="py-1 text-right font-normal">Already there</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="kind in IMPORT_KINDS" :key="kind" class="border-t">
              <th scope="row" class="py-1 text-left font-normal">{{ IMPORT_KIND_LABELS[kind] }}</th>
              <td class="py-1 text-right tabular-nums">{{ importFile.data.value[kind].added }}</td>
              <td class="py-1 text-right tabular-nums">
                {{ importFile.data.value[kind].alreadyThere }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
