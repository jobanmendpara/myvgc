import { afterEach, describe, expect, it } from 'vitest'
import { APP_URL, type TestApp, createTestApp } from './app'

describe('rate limiting of log-ins', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  /**
   * A wrong-password log-in, as if from a client at `address` connecting straight to the app,
   * the way the Node server passes the socket to Hono.
   */
  function logIn(address: string, headers: Record<string, string> = {}) {
    return t!.app.request(
      '/api/auth/sign-in/email',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: APP_URL, ...headers },
        body: JSON.stringify({ email: 'ash@example.com', password: 'wrong password!' }),
      },
      { incoming: { socket: { remoteAddress: address } } },
    )
  }

  // Better Auth allows 3 log-in attempts per 10 seconds from one client. Its counts outlive
  // each test's app, so every test uses addresses of its own.
  async function useUpLimit(address: string, headers?: Record<string, string>) {
    for (let attempt = 0; attempt < 3; attempt++)
      expect((await logIn(address, headers)).status).toBe(401)
    expect((await logIn(address, headers)).status).toBe(429)
  }

  it('limits each client by its own address, so one client never locks out another', async () => {
    t = await createTestApp({ rateLimit: true })
    await useUpLimit('203.0.113.1')

    expect((await logIn('203.0.113.2')).status).toBe(401)
  })

  it("ignores a client's own claim to be another address", async () => {
    t = await createTestApp({ rateLimit: true })
    await useUpLimit('203.0.113.11')

    expect((await logIn('203.0.113.11', { 'x-myvgc-client-address': '203.0.113.19' })).status).toBe(
      429,
    )
  })

  it('still tells clients apart by X-Forwarded-For behind a reverse proxy', async () => {
    t = await createTestApp({ rateLimit: true })
    await useUpLimit('10.0.0.2', { 'x-forwarded-for': '198.51.100.1' })

    expect((await logIn('10.0.0.2', { 'x-forwarded-for': '198.51.100.2' })).status).toBe(401)
  })
})
