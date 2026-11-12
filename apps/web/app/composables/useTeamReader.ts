import {
  MAX_TEAMSHEET_BYTES,
  MAX_TEAM_IMAGES,
  MAX_TEAM_IMAGE_BYTES,
  type ReadTeamView,
  TEAM_IMAGE_TOO_LARGE,
  TEAM_IMAGE_TYPES,
  TEAMSHEET_TOO_LARGE,
  TOO_MANY_TEAM_IMAGES,
} from '@myvgc/core/schema'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { useOnline } from '@vueuse/core'
import { FetchError } from 'ofetch'

/** The files the Teamsheet reader takes: Teamsheet PDFs. */
export const TEAM_FILE_TYPES = 'application/pdf,.pdf'
/** The files the image reader takes (ADR 24). No HEIC. */
export const TEAM_IMAGE_FILE_TYPES = [...TEAM_IMAGE_TYPES, '.png', '.jpg', '.jpeg', '.webp'].join(
  ',',
)

/**
 * Whether this install reads Teams from images (ADR 24). It's off unless the operator set a key,
 * and the image upload is hidden while it's off or not yet known.
 */
export function useImageReading() {
  const query = useQuery({
    queryKey: ['team-reading'],
    queryFn: () => $fetch<{ images: boolean }>('/api/teams/read'),
    staleTime: 60 * 60 * 1000,
  })
  return computed(() => query.data.value?.images === true)
}

/**
 * Reads a Team from files the User chooses into a draft, through the API (ADR 24). Nothing is
 * saved and the files aren't kept. Reading needs the API, so it's online only (ADR 17).
 *
 * Bind `fileInput` to a hidden file input whose change calls `choose` (one Teamsheet PDF) or
 * `chooseImages` (1 to 6 screenshots or photos). With `tournamentId`, `readStored` reads that
 * Tournament's Teamsheet attachment instead (ADR 27), which stays stored.
 */
export function useTeamReader(
  onRead?: (draft: ReadTeamView) => void,
  { tournamentId }: { tournamentId?: string } = {},
) {
  const online = useOnline()
  const fileInput = ref<HTMLInputElement | null>(null)

  const read = useMutation({
    // No file means the Tournament's stored Teamsheet, already on the server.
    mutationFn: (file?: File | File[]) => {
      if (Array.isArray(file)) {
        if (file.length > MAX_TEAM_IMAGES) throw new Error(TOO_MANY_TEAM_IMAGES)
        if (file.some((image) => image.size > MAX_TEAM_IMAGE_BYTES))
          throw new Error(TEAM_IMAGE_TOO_LARGE)
        const body = new FormData()
        for (const image of file) body.append('image', image)
        return $fetch<ReadTeamView>('/api/teams/read/images', { method: 'POST', body })
      }
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
      if (error.statusCode === 401) return 'Your session has ended. Log in again to read a Team.'
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

  function chooseImages(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? [])
    if (files.length > 0) read.mutate(files)
  }

  function readStored() {
    if (tournamentId) read.mutate(undefined)
  }

  return { online, fileInput, read, failure, choose, chooseImages, readStored }
}
