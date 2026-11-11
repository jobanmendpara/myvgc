/**
 * Where Cancel goes from a way of adding a Team (paste, build, read a Teamsheet): back to the
 * New Team chooser on phones, and to the empty pane beside the Teams list on wide screens.
 */
export function useNewTeamCancelTo() {
  const wide = useWideLayout()
  return computed(() => (wide.value ? '/teams' : '/teams/new'))
}
