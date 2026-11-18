// The paths to the web app's Tournament and Round pages, built in one place.

/** The path to a Tournament's page, such as "/tournaments/abc". */
export const tournamentPath = (tournamentId: string) => `/tournaments/${tournamentId}`

/** The path to the page that edits a Tournament's details, such as "/tournaments/abc/edit". */
export const editTournamentPath = (tournamentId: string) => `${tournamentPath(tournamentId)}/edit`

/** The path to the page that logs a new Round in a Tournament, such as "/tournaments/abc/rounds/new". */
export const newRoundPath = (tournamentId: string) => `${tournamentPath(tournamentId)}/rounds/new`

/** The path to a Round's page, such as "/tournaments/abc/rounds/def". */
export const roundPath = (tournamentId: string, roundId: string) =>
  `${tournamentPath(tournamentId)}/rounds/${roundId}`
