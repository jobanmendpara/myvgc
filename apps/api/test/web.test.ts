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
    writeFileSync(join(webDir, 'sw.js'), 'self.addEventListener("fetch", () => {})')
    writeFileSync(join(webDir, 'manifest.webmanifest'), '{"name":"MyVGC","display":"standalone"}')
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

  it('serves the service worker from the site root, never cached', async () => {
    const res = await app.request('/sw.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/javascript/)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(await res.text()).toContain('addEventListener')
  })

  it('serves the web manifest, never cached', async () => {
    const res = await app.request('/manifest.webmanifest')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/manifest\+json/)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(await res.json()).toEqual({ name: 'MyVGC', display: 'standalone' })
  })

  it('leaves other built files to the browser cache', async () => {
    const res = await app.request('/_nuxt/entry.js')
    expect(res.headers.get('cache-control')).toBeNull()
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
