import { describe, expect, it } from 'vitest'
import { champions, championsNames } from '../src'

const BATTLE_ONLY_FORMS = [
  'Meloetta-Pirouette',
  'Minior-Meteor',
  'Cramorant-Gulping',
  'Cramorant-Gorging',
  'Eiscue-Noice',
  'Ogerpon-Teal-Tera',
  'Ogerpon-Wellspring-Tera',
  'Ogerpon-Hearthflame-Tera',
  'Ogerpon-Cornerstone-Tera',
  'Terapagos-Terastal',
]

describe('battle-only forms whose base species is not in Champions', () => {
  it.each(BATTLE_ONLY_FORMS)('%s is not found as a species', (form) => {
    expect(champions.species(form)).toBeUndefined()
  })

  it('keeps a form whose base species is in Champions', () => {
    expect(champions.species('Rotom-Wash')?.id).toBe('rotomwash')
  })

  it('leaves them out of the names table', () => {
    const ids = Object.keys(championsNames().species)
    for (const form of BATTLE_ONLY_FORMS) {
      expect(ids).not.toContain(form.toLowerCase().replace(/[^a-z0-9]/g, ''))
    }
  })
})
