import { describe, expect, it } from 'vitest'
import { newNoteEntrySchema, noteEntryChangesSchema } from '../src/schema'

const fieldsWithErrors = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}) => result.error?.issues.map((issue) => issue.path.join('.')) ?? []

describe('A new Note entry', () => {
  it('takes a date and trimmed text', () => {
    expect(newNoteEntrySchema.parse({ date: '2026-09-19', text: '  Leads Incineroar \n' })).toEqual(
      { date: '2026-09-19', text: 'Leads Incineroar' },
    )
  })

  it('needs some text', () => {
    expect(
      fieldsWithErrors(newNoteEntrySchema.safeParse({ date: '2026-09-19', text: ' \n ' })),
    ).toEqual(['text'])
  })

  it.each(['19/09/2026', '2026-02-30', ''])('refuses the date %j', (date) => {
    expect(fieldsWithErrors(newNoteEntrySchema.safeParse({ date, text: 'Scouted' }))).toEqual([
      'date',
    ])
  })

  it('accepts a date in the future, since only the device knows what today is', () => {
    expect(newNoteEntrySchema.safeParse({ date: '2099-01-01', text: 'Scouted' }).success).toBe(true)
  })
})

describe('Changes to a Note entry', () => {
  it('can change just the date or just the text, but not empty the text', () => {
    expect(noteEntryChangesSchema.parse({ date: '2026-09-20' })).toEqual({ date: '2026-09-20' })
    expect(noteEntryChangesSchema.parse({ text: ' Swapped to Rain ' })).toEqual({
      text: 'Swapped to Rain',
    })
    expect(fieldsWithErrors(noteEntryChangesSchema.safeParse({ text: '' }))).toEqual(['text'])
  })
})
