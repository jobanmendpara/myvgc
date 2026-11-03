# 03: Accounts with Better Auth

Blocked by: 01

## What to build
Email-and-password accounts, end to end, as described in the spec's "Accounts" section.

- Better Auth with its Drizzle adapter, mounted at `/api/auth/*`, with its tables in a committed migration.
- The first account on an install gets the `admin` role.
- `ALLOW_SIGNUPS=false` refuses sign-up, except for the first account.
- Session middleware for the rest of `/api`: requests without a session get `401`.
- Nuxt pages `/signup` and `/login`, a log-out button, and a route guard that sends logged-out visitors to `/login`. Phone first.
- Add `BETTER_AUTH_SECRET`, `APP_URL` and `ALLOW_SIGNUPS` to `.env.example` and Compose.

## Acceptance criteria
- [ ] A visitor can sign up, log out and log back in, in the browser and inside Docker Compose.
- [ ] API tests (`app.request()` + PGlite) cover: the first user becomes admin and the second doesn't; sign-ups refused when disabled, except for the first; `401` without a session.
- [ ] The pages work at 375 px wide.
