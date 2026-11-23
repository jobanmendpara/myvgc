import { describe, expect, it } from 'vitest'
import { readSessionCheck, startAs } from '../app/lib/session-check'

const ash = { id: 'u1', email: 'ash@example.com', name: 'Ash' }
const misty = { id: 'u2', email: 'misty@example.com', name: 'Misty' }

describe('Reading the session check', () => {
  it('reads a session as signed in', () => {
    expect(readSessionCheck({ data: { user: ash }, error: null })).toEqual({
      kind: 'signed-in',
      user: ash,
    })
  })

  it('reads no session and no error as logged out', () => {
    expect(readSessionCheck({ data: null, error: null })).toEqual({ kind: 'logged-out' })
  })

  it('reads an error answer or a thrown call as the server not being reached', () => {
    expect(readSessionCheck({ data: null, error: { status: 502 } })).toEqual({
      kind: 'unreachable',
    })
    expect(readSessionCheck(undefined)).toEqual({ kind: 'unreachable' })
  })
})

describe('Whom the app opens as', () => {
  it('opens as the signed-in User when the server answers', () => {
    expect(startAs({ kind: 'signed-in', user: ash }, misty)).toEqual({
      kind: 'user',
      user: ash,
      offline: false,
    })
  })

  it('opens as the last known User when the server can’t be reached', () => {
    expect(startAs({ kind: 'unreachable' }, ash)).toEqual({
      kind: 'user',
      user: ash,
      offline: true,
    })
  })

  it('logs out when the server answers "logged out", even with a User saved', () => {
    expect(startAs({ kind: 'logged-out' }, ash)).toEqual({ kind: 'logged-out' })
  })

  it('can’t open when the server can’t be reached and no User was ever saved here', () => {
    expect(startAs({ kind: 'unreachable' }, undefined)).toEqual({ kind: 'unreachable' })
  })
})
