import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type { AppEnv } from '../src/app'
import { createTestApp } from './app'

describe('serving the web app', () => {
  let webDir: string
  let app: Hono<AppEnv>
  let closeDb: () => Promise<void>

  beforeAll(async () => {
    webDir = mkdtempSync(join(tmpdir(), 'myvgc-web-'))
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>MyVGC</title>')
    mkdirSync(join(webDir, '_nuxt'))
    writeFileSync(join(webDir, '_nuxt', 'entry.js'), 'console.log("hi")')
    const testApp = await createTestApp({ webDir })
    app = testApp.app
    closeDb = () => testApp.client.close()
  })

  afterAll(async () => {
    rmSync(webDir, { recursive: true, force: true })
    await closeDb()
  })

  it('serves index.html at the root', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>MyVGC</title>')
  })

  it('serves built files as they are', async () => {
    const res = await app.request('/_nuxt/entry.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
    expect(await res.text()).toBe('console.log("hi")')
  })

  it.each(['/teams', '/teams/123', '/login'])(
    'serves index.html for the front-end route %s',
    async (path) => {
      const res = await app.request(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/text\/html/)
      expect(await res.text()).toContain('<title>MyVGC</title>')
    },
  )

  it('never answers an API route with index.html', async () => {
    const res = await app.request('/api/nope')
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(await res.json()).toEqual({ error: 'Not logged in' })
  })

  it('still serves the API', async () => {
    const res = await app.request('/api/health')
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
