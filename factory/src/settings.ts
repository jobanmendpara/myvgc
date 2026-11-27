// Which model and effort each agent step of a Run uses (Pick the model for each factory step,
// DEV-254). Every step sets its effort explicitly, which is why .sandcastle/.env may not hold
// CLAUDE_CODE_EFFORT_LEVEL: it would override them all. A Run can override one step with a flag
// such as `--implementer opus-5-5` (DEV-283).
import type { Effort } from './ports.ts'

export type Step = 'implementer' | 'fixRound1' | 'fixRound2' | 'reviewer'

export interface StepSettings {
  model: string
  effort: Effort
}

export const STEPS: Record<Step, StepSettings> = {
  implementer: { model: 'claude-sonnet-5-5', effort: 'medium' },
  // Fix rounds resume the Implementer's session.
  fixRound1: { model: 'claude-sonnet-5-5', effort: 'high' },
  fixRound2: { model: 'claude-opus-5-5', effort: 'high' },
  // A fresh session every time.
  reviewer: { model: 'claude-opus-5-5', effort: 'high' },
}

const model = (step: Step) => `${STEPS[step].model}, ${STEPS[step].effort}`

/**
 * The steps a Run takes for one ticket (How a factory Run works, DEV-253), with each agent step's
 * model, as `--dry-run` prints them.
 */
export const TICKET_PLAN =
  [
    'claim',
    'worktree and install',
    `Implementer (${model('implementer')})`,
    'host checks',
    `Reviewer (${model('reviewer')})`,
    'replay',
    'push gate',
    'pnpm accuracy before and after if an ADR 24 path changed',
    'push, PR, Reviewer comment and auto-merge',
    'close sandbox',
    'wait for checks',
  ].join(' → ') +
  `; when the push gate fails: fix round 1 (${model('fixRound1')}), then fix round 2 ` +
  `(${model('fixRound2')}), each back to host checks, then park`

/** A model's name for a Co-Authored-By line: claude-sonnet-5-5 is "Claude Sonnet 5.5". */
export function modelName(model: string): string {
  const [, family = model, version = ''] = /^claude-([a-z]+)-(.+)$/.exec(model) ?? []
  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.replace(/-/g, '.')}`.trim()
}
