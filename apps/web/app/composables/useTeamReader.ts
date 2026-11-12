import { MAX_TEAMSHEET_BYTES, type ReadTeamView, TEAMSHEET_TOO_LARGE } from '@myvgc/core/schema'
import { useMutation } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { FetchError } from 'ofetch'

/** The files the reader takes: Teamsheet PDFs. Images join them once they can be read (ADR 24). */
export const TEAM_FILE_TYPES = 'application/pdf,.pdf'

/**
 * Reads a Team from a file the User chooses into a draft, through the API (ADR 24). Nothing is
 * saved and the file isn't kept. Reading needs the API, so it's online only (ADR 17).
 *
 * Bind `fileInput` to a hidden file input whose change calls `choose`. With `tournamentId`,
 * `readStored` reads that Tournament's Teamsheet attachment instead (ADR 27), which stays stored.
 */
export function useTeamReader(
  onRead?: (draft: ReadTeamView) => void,
  { tournamentId }: { tournamentId?: string } = {},
) {
  const online = useOnline()
  const fileInput = ref<HTMLInputElement | null>(null)

  const read = useMutation({
    // No file means the Tournament's stored Teamsheet, already on the server.
    mutationFn: (file?: File) => {
      if (!file) {
        const url: string = `/api/tournaments/${tournamentId}/teamsheet/read`
        return $fetch<ReadTeamView>(url, { method: 'POST' })
      }
      if (file.size > MAX_TEAMSHEET_BYTES) throw new Error(TEAMSHEET_TOO_LARGE)
      const body = new FormData()
      body.append('file', file)
      return $fetch<ReadTeamView>('/api/teams/read', { method: 'POST', body })
    },
    networkMode: 'always',
    onSuccess: (draft) => onRead?.(draft),
    onSettled: () => {
      // So choosing the same file again reads it again.
      if (fileInput.value) fileInput.value.value = ''
    },
  })

  const failure = computed(() => {
    const error = read.error.value
    if (!error) return ''
    if (error instanceof FetchError) {
      if (error.statusCode === 401)
        return 'Your session has ended. Log in again to read a Teamsheet.'
      if (tournamentId && error.statusCode === 404)
        return "Couldn't find a Teamsheet PDF on this Tournament."
      if (error.data?.error) return error.data.error as string
      return "Couldn't read the file. Check your connection and try again."
    }
    return error.message
  })

  function choose(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) read.mutate(file)
  }

  function readStored() {
    if (tournamentId) read.mutate(undefined)
  }

  return { online, fileInput, read, failure, choose, readStored }
}
