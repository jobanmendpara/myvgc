// Which model and effort each agent step of a Run uses (Pick the model for each factory step,
// DEV-254). Every step sets its effort explicitly, which is why .sandcastle/.env may not hold
// CLAUDE_CODE_EFFORT_LEVEL: it would override them all. A Run can override one step's model with
// a flag named after the step, such as `--implementer opus-5-5`; its effort stays.
import type { Effort } from './ports.ts'

/** The agent steps, by the names their flags and logs use. */
export const STEP_NAMES = ['implementer', 'fix-round-1', 'fix-round-2', 'reviewer'] as const
export type Step = (typeof STEP_NAMES)[number]

export interface StepSettings {
  model: string
  effort: Effort
}

export type Settings = Record<Step, StepSettings>

export const STEPS: Settings = {
  implementer: { model: 'claude-sonnet-5-5', effort: 'medium' },
  // Fix rounds resume the Implementer's session, one level of effort up, then on Opus.
  'fix-round-1': { model: 'claude-sonnet-5-5', effort: 'high' },
  'fix-round-2': { model: 'claude-opus-5-5', effort: 'high' },
  // A fresh session every time.
  reviewer: { model: 'claude-opus-5-5', effort: 'high' },
}

/** A Claude model as a flag gives it: `opus-5-5` or `claude-opus-5-5`. */
const MODEL = /^(?:claude-)?(?:opus|sonnet|haiku|fable)-\d+(?:-\d+)?$/

/**
 * The settings with each flag's model in place of its step's, or null when a flag doesn't name a
 * model.
 */
export function withOverrides(overrides: Partial<Record<Step, string>>): Settings | null {
  const settings: Settings = { ...STEPS }
  for (const step of STEP_NAMES) {
    const model = overrides[step]
    if (model === undefined) continue
    if (!MODEL.test(model)) return null
    settings[step] = {
      ...STEPS[step],
      model: model.startsWith('claude-') ? model : `claude-${model}`,
    }
  }
  return settings
}

/**
 * The steps a Run takes for one ticket (How a factory Run works, DEV-253), with each agent step's
 * model, as `--dry-run` prints them.
 */
export function ticketPlan(settings: Settings): string {
  const model = (step: Step) => `${settings[step].model}, ${settings[step].effort}`
  return (
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
    `; when the push gate fails: fix round 1 (${model('fix-round-1')}), then fix round 2 ` +
    `(${model('fix-round-2')}), each back to host checks, then park; when CI fails, the next ` +
    'fix round in a new sandbox on the pushed branch, counted towards the two; when the PR ' +
    'conflicts with main, rebase and force-push, or park on conflicts or after 3 rebases; ' +
    'when it waits on `approved`, `needs-human` and move on; with no answer an hour after a ' +
    'push, park'
  )
}

/** A model's name for a Co-Authored-By line: claude-sonnet-5-5 is "Claude Sonnet 5.5". */
export function modelName(model: string): string {
  const [, family = model, version = ''] = /^claude-([a-z]+)-(.+)$/.exec(model) ?? []
  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.replace(/-/g, '.')}`.trim()
}
