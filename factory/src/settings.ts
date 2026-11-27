// Which model and effort each agent step of a Run uses (Pick the model for each factory step,
// DEV-254). Every step sets its effort explicitly, which is why .sandcastle/.env may not hold
// CLAUDE_CODE_EFFORT_LEVEL: it would override them all. A Run can override one step with a flag
// such as `--implementer opus-5-5` (DEV-283).

export type Step = 'implementer' | 'fixRound1' | 'fixRound2' | 'reviewer'

export interface StepSettings {
  model: string
  effort: 'low' | 'medium' | 'high' | 'xhigh'
}

export const STEPS: Record<Step, StepSettings> = {
  implementer: { model: 'claude-sonnet-5-5', effort: 'medium' },
  // Fix rounds resume the Implementer's session.
  fixRound1: { model: 'claude-sonnet-5-5', effort: 'high' },
  fixRound2: { model: 'claude-opus-5-5', effort: 'high' },
  // A fresh session every time.
  reviewer: { model: 'claude-opus-5-5', effort: 'high' },
}
