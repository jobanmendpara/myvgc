import { describe, expect, it } from 'vitest'
import { loadConfig, teamReaderModel } from '../src/config'

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
    for (const env of [valid, blank]) expect(loadConfig(env).s3).toBeUndefined()
  })

  it('gathers the S3 settings into one group', () => {
    expect(
      loadConfig({
        ...valid,
        S3_BUCKET: 'myvgc-uploads',
        S3_REGION: 'auto',
        S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
        S3_FORCE_PATH_STYLE: 'true',
      }).s3,
    ).toEqual({
      bucket: 'myvgc-uploads',
      region: 'auto',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      forcePathStyle: true,
    })
  })

  it('fills in S3 defaults when only a bucket is set', () => {
    expect(loadConfig({ ...valid, S3_BUCKET: 'myvgc-uploads' }).s3).toEqual({
      bucket: 'myvgc-uploads',
      region: 'us-east-1',
      forcePathStyle: false,
    })
  })

  it('rejects an S3 access key without its secret', () => {
    expect(() => loadConfig({ ...valid, S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'key' })).toThrow(
      /S3_SECRET_ACCESS_KEY: set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together/,
    )
  })

  it('rejects an S3 secret without its access key', () => {
    expect(() => loadConfig({ ...valid, S3_BUCKET: 'b', S3_SECRET_ACCESS_KEY: 'secret' })).toThrow(
      /S3_ACCESS_KEY_ID: set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY together/,
    )
  })

  it.each([
    ['S3_REGION', 'us-east-1'],
    ['S3_REGION', 'auto'],
    ['S3_ENDPOINT', 'https://s3.example.com'],
    ['S3_ACCESS_KEY_ID', 'key'],
    ['S3_FORCE_PATH_STYLE', 'true'],
    ['S3_FORCE_PATH_STYLE', 'false'],
  ])('rejects %s=%s without a bucket', (name, value) => {
    const keys = name === 'S3_ACCESS_KEY_ID' ? { S3_SECRET_ACCESS_KEY: 'secret' } : {}
    expect(() => loadConfig({ ...valid, ...keys, [name]: value })).toThrow(
      /S3_BUCKET: set S3_BUCKET/,
    )
  })

  it('reports a mismatched key pair and a missing bucket together', () => {
    expect(() => loadConfig({ ...valid, S3_ACCESS_KEY_ID: 'key' })).toThrow(
      /S3_SECRET_ACCESS_KEY: set S3_ACCESS_KEY_ID[\s\S]*S3_BUCKET: set S3_BUCKET/,
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
      expect(config.TEAM_READER_MODEL).toBe('claude-haiku-5-5')
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

describe('teamReaderModel', () => {
  it.each([
    ['unset', undefined, 'claude-haiku-5-5'],
    ['blank', '  ', 'claude-haiku-5-5'],
    ['set', ' claude-opus-5-5 ', 'claude-opus-5-5'],
  ])('picks the same model as loadConfig when TEAM_READER_MODEL is %s', (_, value, expected) => {
    const env = { ...valid, TEAM_READER_MODEL: value }
    expect(teamReaderModel(env)).toBe(expected)
    expect(loadConfig(env).TEAM_READER_MODEL).toBe(expected)
  })

  it('needs only TEAM_READER_MODEL, not the rest of the configuration', () => {
    expect(teamReaderModel({})).toBe('claude-haiku-5-5')
    expect(teamReaderModel({ TEAM_READER_MODEL: 'claude-sonnet-5-5' })).toBe('claude-sonnet-5-5')
  })
})
