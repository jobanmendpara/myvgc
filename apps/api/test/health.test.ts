import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp } from './app'

describe('GET /api/health', () => {
  let closeDb: (() => Promise<void>) | undefined
  afterEach(async () => {
    await closeDb?.()
    closeDb = undefined
  })

  it('reports ok when the database answers', async () => {
    const { app, client } = await createTestApp()
    closeDb = () => client.close()
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('reports an error when the database does not answer', async () => {
    const { app, client } = await createTestApp()
    await client.close()
    const res = await app.request('/api/health')

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error' })
  })
})
