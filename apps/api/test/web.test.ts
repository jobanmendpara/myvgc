import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import type { Database } from '../src/db/types'
import { createTestDb } from './db'

describe('serving the web app', () => {
  let webDir: string
  let db: Database
  let closeDb: () => Promise<void>

  beforeAll(async () => {
    webDir = mkdtempSync(join(tmpdir(), 'myvgc-web-'))
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>MyVGC</title>')
    mkdirSync(join(webDir, '_nuxt'))
    writeFileSync(join(webDir, '_nuxt', 'entry.js'), 'console.log("hi")')
    const testDb = await createTestDb()
    db = testDb.db
    closeDb = () => testDb.client.close()
  })

  afterAll(async () => {
    rmSync(webDir, { recursive: true, force: true })
    await closeDb()
  })

  it('serves index.html at the root', async () => {
    const res = await createApp({ db, webDir }).request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>MyVGC</title>')
  })

  it('serves built files as they are', async () => {
    const res = await createApp({ db, webDir }).request('/_nuxt/entry.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
    expect(await res.text()).toBe('console.log("hi")')
  })

  it.each(['/teams', '/teams/123', '/login'])(
    'serves index.html for the front-end route %s',
    async (path) => {
      const res = await createApp({ db, webDir }).request(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/text\/html/)
      expect(await res.text()).toContain('<title>MyVGC</title>')
    },
  )

  it('still answers unknown API routes with a JSON 404', async () => {
    const res = await createApp({ db, webDir }).request('/api/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('still serves the API', async () => {
    const res = await createApp({ db, webDir }).request('/api/health')
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
