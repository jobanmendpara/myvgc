import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { createTestDb } from './db'

describe('GET /api/health', () => {
  let closeDb: (() => Promise<void>) | undefined
  afterEach(async () => {
    await closeDb?.()
    closeDb = undefined
  })

  it('reports ok when the database answers', async () => {
    const { db, client } = await createTestDb()
    closeDb = () => client.close()
    const res = await createApp({ db }).request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('reports an error when the database does not answer', async () => {
    const { db, client } = await createTestDb()
    await client.close()
    const res = await createApp({ db }).request('/api/health')

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error' })
  })
})
