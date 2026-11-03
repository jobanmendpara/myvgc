# 5. Real user accounts in every install

Date: 2026-11-03
Status: Accepted

## Context
Self-hosted installs could skip logins, but the hosted service needs accounts, and ADR 2 requires data to belong to an account from day one.

## Decision
Every install has real accounts with email and password. On a self-hosted install the first account to sign up becomes the admin, and a setting can turn off public sign-ups.

## Consequences
- The same code runs hosted and self-hosted, with no "is there a user?" branches.
- Every record that holds user data is owned by a User.
