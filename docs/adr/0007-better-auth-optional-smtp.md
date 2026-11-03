# 7. Better Auth, with an optional email server

Date: 2026-11-03
Status: Accepted

## Context
ADR 5 requires real accounts in every install. Email verification and password resets need an outgoing mail (SMTP) server, which is a real obstacle for self-hosters.

## Decision
Use Better Auth for email-and-password accounts, with its Drizzle adapter. SMTP is optional. Without it, email verification is off, and the admin resets passwords from an admin screen. The hosted service always configures SMTP.

## Consequences
- Two account-recovery paths to support: by email, and by the admin.
- Self-hosting needs no mail setup.
