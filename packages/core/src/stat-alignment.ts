import { STAT_LABELS, type StatId } from './build'

/** A Stat Alignment: what it raises and lowers, if anything. Its ID is the stored value (ADR 14). */
export interface StatAlignment {
  id: string
  name: string
  raises?: StatId
  lowers?: StatId
}

/** The 25 Stat Alignments, by name. Hard-coded so the web app needn't load Showdown's data. */
export const STAT_ALIGNMENTS: readonly StatAlignment[] = [
  { id: 'adamant', name: 'Adamant', raises: 'atk', lowers: 'spa' },
  { id: 'bashful', name: 'Bashful' },
  { id: 'bold', name: 'Bold', raises: 'def', lowers: 'atk' },
  { id: 'brave', name: 'Brave', raises: 'atk', lowers: 'spe' },
  { id: 'calm', name: 'Calm', raises: 'spd', lowers: 'atk' },
  { id: 'careful', name: 'Careful', raises: 'spd', lowers: 'spa' },
  { id: 'docile', name: 'Docile' },
  { id: 'gentle', name: 'Gentle', raises: 'spd', lowers: 'def' },
  { id: 'hardy', name: 'Hardy' },
  { id: 'hasty', name: 'Hasty', raises: 'spe', lowers: 'def' },
  { id: 'impish', name: 'Impish', raises: 'def', lowers: 'spa' },
  { id: 'jolly', name: 'Jolly', raises: 'spe', lowers: 'spa' },
  { id: 'lax', name: 'Lax', raises: 'def', lowers: 'spd' },
  { id: 'lonely', name: 'Lonely', raises: 'atk', lowers: 'def' },
  { id: 'mild', name: 'Mild', raises: 'spa', lowers: 'def' },
  { id: 'modest', name: 'Modest', raises: 'spa', lowers: 'atk' },
  { id: 'naive', name: 'Naive', raises: 'spe', lowers: 'spd' },
  { id: 'naughty', name: 'Naughty', raises: 'atk', lowers: 'spd' },
  { id: 'quiet', name: 'Quiet', raises: 'spa', lowers: 'spe' },
  { id: 'quirky', name: 'Quirky' },
  { id: 'rash', name: 'Rash', raises: 'spa', lowers: 'spd' },
  { id: 'relaxed', name: 'Relaxed', raises: 'def', lowers: 'spe' },
  { id: 'sassy', name: 'Sassy', raises: 'spd', lowers: 'spe' },
  { id: 'serious', name: 'Serious' },
  { id: 'timid', name: 'Timid', raises: 'spe', lowers: 'atk' },
]

/** A Stat Alignment with its effect, such as "Adamant (+Atk −SpA)". */
export function statAlignmentLabel({ name, raises, lowers }: StatAlignment): string {
  if (!raises || !lowers) return `${name} (no effect)`
  return `${name} (+${STAT_LABELS[raises]} −${STAT_LABELS[lowers]})`
}
