import { afterEach, describe, expect, it } from 'vitest'
import { type TestApp, cookieFrom, createTestApp, me, post, signUp } from './app'

describe('accounts', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  it('makes the first account the admin, and later accounts ordinary users', async () => {
    t = await createTestApp()
    const first = await signUp(t.app, 'ash@example.com')
    const second = await signUp(t.app, 'misty@example.com')

    expect(first.res.status).toBe(200)
    expect(second.res.status).toBe(200)
    expect(await (await me(t.app, first.cookie)).json()).toMatchObject({
      email: 'ash@example.com',
      role: 'admin',
    })
    expect(await (await me(t.app, second.cookie)).json()).toMatchObject({
      email: 'misty@example.com',
      role: 'user',
    })
  })

  it('lets the first account sign up when sign-ups are turned off', async () => {
    t = await createTestApp({ allowSignups: false })
    const first = await signUp(t.app, 'ash@example.com')

    expect(first.res.status).toBe(200)
    expect(await (await me(t.app, first.cookie)).json()).toMatchObject({ role: 'admin' })
  })

  it('refuses later sign-ups when sign-ups are turned off', async () => {
    t = await createTestApp({ allowSignups: false })
    await signUp(t.app, 'ash@example.com')
    const second = await signUp(t.app, 'misty@example.com')

    expect(second.res.status).toBe(403)
    expect(await second.res.json()).toMatchObject({
      message: 'Sign-ups are turned off on this install.',
    })
    expect(second.cookie).toBe('')
  })

  it('logs out and back in', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com', 'pikachu-thunderbolt')

    const out = await post(t.app, '/api/auth/sign-out', {}, cookie)
    expect(out.status).toBe(200)
    expect((await me(t.app, cookie)).status).toBe(401)

    const wrong = await post(t.app, '/api/auth/sign-in/email', {
      email: 'ash@example.com',
      password: 'not-the-password',
    })
    expect(wrong.status).toBe(401)

    const back = await post(t.app, '/api/auth/sign-in/email', {
      email: 'ash@example.com',
      password: 'pikachu-thunderbolt',
    })
    expect(back.status).toBe(200)
    expect(await (await me(t.app, cookieFrom(back))).json()).toMatchObject({
      email: 'ash@example.com',
    })
  })
})

describe('changing a password', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  const logIn = async (password: string) =>
    post(t!.app, '/api/auth/sign-in/email', { email: 'ash@example.com', password })
  const change = (cookie: string, body: object) =>
    post(t!.app, '/api/auth/change-password', body, cookie)

  it('changes it, keeping other devices logged in unless asked', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com', 'pikachu-thunderbolt')
    const otherDevice = cookieFrom(await logIn('pikachu-thunderbolt'))

    const res = await change(cookie, {
      currentPassword: 'pikachu-thunderbolt',
      newPassword: 'raichu-thunderbolt',
    })
    expect(res.status).toBe(200)
    expect((await logIn('pikachu-thunderbolt')).status).toBe(401)
    expect((await logIn('raichu-thunderbolt')).status).toBe(200)
    expect((await me(t.app, otherDevice)).status).toBe(200)
  })

  it('logs out other devices when asked, but not this one', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com', 'pikachu-thunderbolt')
    const otherDevice = cookieFrom(await logIn('pikachu-thunderbolt'))

    const res = await change(cookie, {
      currentPassword: 'pikachu-thunderbolt',
      newPassword: 'raichu-thunderbolt',
      revokeOtherSessions: true,
    })
    expect(res.status).toBe(200)
    expect((await me(t.app, otherDevice)).status).toBe(401)
    // This device is handed a new session in place of the one revoked with the rest.
    expect((await me(t.app, cookie)).status).toBe(401)
    expect((await me(t.app, cookieFrom(res))).status).toBe(200)
  })

  it('refuses a wrong current password', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com', 'pikachu-thunderbolt')
    const res = await change(cookie, {
      currentPassword: 'not-the-password',
      newPassword: 'raichu-thunderbolt',
    })
    expect(res.status).toBe(400)
    expect((await logIn('pikachu-thunderbolt')).status).toBe(200)
  })
})

describe('sessions', () => {
  let t: TestApp | undefined
  afterEach(async () => {
    await t?.client.close()
    t = undefined
  })

  it.each(['/api/me', '/api/teams', '/api/anything'])(
    'answers %s with 401 without a session',
    async (path) => {
      t = await createTestApp()
      const res = await t.app.request(path)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Not logged in' })
    },
  )

  it('answers 401 for a made-up session cookie', async () => {
    t = await createTestApp()
    const res = await me(t.app, 'better-auth.session_token=forged.value')
    expect(res.status).toBe(401)
  })

  it('leaves the health check and auth routes open', async () => {
    t = await createTestApp()
    expect((await t.app.request('/api/health')).status).toBe(200)
    expect((await t.app.request('/api/auth/get-session')).status).toBe(200)
  })

  it('answers 404 for an unknown API route once logged in', async () => {
    t = await createTestApp()
    const { cookie } = await signUp(t.app, 'ash@example.com')
    const res = await t.app.request('/api/nope', { headers: { cookie } })
    expect(res.status).toBe(404)
  })
})
