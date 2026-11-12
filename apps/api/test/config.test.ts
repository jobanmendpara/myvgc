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

  it('keeps uploads on disk unless S3_BUCKET is set, treating blank S3 settings as unset', () => {
    const blank = {
      ...valid,
      S3_BUCKET: ' ',
      S3_REGION: '',
      S3_ENDPOINT: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
      S3_FORCE_PATH_STYLE: '',
    }
    for (const env of [valid, blank]) {
      const config = loadConfig(env)
      expect(config.S3_BUCKET).toBeUndefined()
      expect(config.S3_ENDPOINT).toBeUndefined()
      expect(config.S3_REGION).toBe('us-east-1')
      expect(config.S3_FORCE_PATH_STYLE).toBe(false)
    }
  })

  it('reads the S3 settings', () => {
    expect(
      loadConfig({
        ...valid,
        S3_BUCKET: 'myvgc-uploads',
        S3_REGION: 'auto',
        S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
        S3_FORCE_PATH_STYLE: 'true',
      }),
    ).toMatchObject({
      S3_BUCKET: 'myvgc-uploads',
      S3_REGION: 'auto',
      S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: true,
    })
  })

  it('rejects an S3 access key without its secret', () => {
    expect(() => loadConfig({ ...valid, S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'key' })).toThrow(
      /S3_SECRET_ACCESS_KEY: set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together/,
    )
  })

  it('rejects S3 settings without a bucket', () => {
    expect(() => loadConfig({ ...valid, S3_ENDPOINT: 'https://s3.example.com' })).toThrow(
      /S3_BUCKET: set S3_BUCKET/,
    )
  })

  it('rejects an S3_ENDPOINT that is not a URL', () => {
    expect(() => loadConfig({ ...valid, S3_BUCKET: 'b', S3_ENDPOINT: 's3.example.com' })).toThrow(
      /S3_ENDPOINT/,
    )
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

  it('leaves image reading off with no key, and treats blank values as unset', () => {
    const blank = {
      ...valid,
      ANTHROPIC_API_KEY: ' ',
      TEAM_READER_MODEL: '',
      TEAM_READER_DAILY_LIMIT: '',
    }
    for (const env of [valid, blank]) {
      const config = loadConfig(env)
      expect(config.ANTHROPIC_API_KEY).toBeUndefined()
      expect(config.TEAM_READER_MODEL).toBe('claude-sonnet-5-5')
      expect(config.TEAM_READER_DAILY_LIMIT).toBeUndefined()
    }
  })

  it('reads the image reader settings', () => {
    expect(
      loadConfig({
        ...valid,
        ANTHROPIC_API_KEY: 'sk-ant-test',
        TEAM_READER_MODEL: 'claude-opus-5-5',
        TEAM_READER_DAILY_LIMIT: '20',
      }),
    ).toMatchObject({
      ANTHROPIC_API_KEY: 'sk-ant-test',
      TEAM_READER_MODEL: 'claude-opus-5-5',
      TEAM_READER_DAILY_LIMIT: 20,
    })
  })

  it.each(['0', '2.5', 'lots'])('rejects TEAM_READER_DAILY_LIMIT=%s', (limit) => {
    expect(() => loadConfig({ ...valid, TEAM_READER_DAILY_LIMIT: limit })).toThrow(
      /TEAM_READER_DAILY_LIMIT/,
    )
  })

  it('rejects an APP_URL that is not a URL', () => {
    expect(() => loadConfig({ ...valid, APP_URL: 'localhost' })).toThrow(/APP_URL/)
  })
})
