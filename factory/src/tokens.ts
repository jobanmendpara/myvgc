// The GitHub App's installation token for a Run (DEV-269, AC-32.1). GitHub gives one for an hour,
// so the Forge asks for it before every GitHub call, and a new one is minted once the current one
// is within 10 minutes of its expiry: a long Run never makes a call with a token about to lapse.
import type { Clock, InstallationToken } from './ports.ts'

/** How long before its expiry a token is replaced. */
export const REFRESH_BEFORE_MS = 10 * 60_000

/** The current token, minting a new one when there is none or it is about to expire. */
export function installationTokens(
  mint: () => Promise<InstallationToken>,
  clock: Clock,
): () => Promise<string> {
  let current: InstallationToken | undefined
  // Shared, so two GitHub calls at once mint one token, not two.
  let minting: Promise<InstallationToken> | undefined
  return async () => {
    if (current && clock.now().getTime() < current.expiresAt.getTime() - REFRESH_BEFORE_MS) {
      return current.token
    }
    minting ??= mint().finally(() => {
      minting = undefined
    })
    current = await minting
    return current.token
  }
}
