import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

const valid = {
  DATABASE_URL: 'postgres://myvgc:pw@db:5432/myvgc',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  APP_URL: 'http://localhost:3000',
}

describe('loadConfig', () => {
  it('fills in defaults', () => {
    expect(loadConfig(valid)).toMatchObject({
      PORT: 3000,
      ALLOW_SIGNUPS: true,
      UPLOADS_DIR: '.data/uploads',
    })
  })

  it('reads UPLOADS_DIR', () => {
    expect(loadConfig({ ...valid, UPLOADS_DIR: '/data/uploads' }).UPLOADS_DIR).toBe('/data/uploads')
  })

  it.each([
    ['false', false],
    ['FALSE', false],
    ['0', false],
    ['true', true],
    ['1', true],
  ])('reads ALLOW_SIGNUPS=%s', (value, expected) => {
    expect(loadConfig({ ...valid, ALLOW_SIGNUPS: value }).ALLOW_SIGNUPS).toBe(expected)
  })

  it('rejects an ALLOW_SIGNUPS it cannot read', () => {
    expect(() => loadConfig({ ...valid, ALLOW_SIGNUPS: 'nope' })).toThrow(/ALLOW_SIGNUPS/)
  })

  it.each([
    ['the example value', 'change-me', /replace the example value/],
    ['a short secret', 'short', /at least 32 characters/],
  ])('rejects %s for BETTER_AUTH_SECRET', (_, secret, message) => {
    expect(() => loadConfig({ ...valid, BETTER_AUTH_SECRET: secret })).toThrow(message)
  })

  it('rejects an APP_URL that is not a URL', () => {
    expect(() => loadConfig({ ...valid, APP_URL: 'localhost' })).toThrow(/APP_URL/)
  })
})
