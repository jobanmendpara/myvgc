# 26. Date of Birth is a Player detail

Date: 2026-11-09
Status: Accepted (DEV-69, DEV-70). Replaces ADR 20's decision that Date of Birth is never stored.

## Context
ADR 20 kept Date of Birth out of MyVGC because it is sensitive, so every Teamsheet needed it written by hand, and the stored Age Division went stale each Season. With Teamsheet export filling form fields (ADR 25), the User wants Date of Birth filled in too. Play! Pokémon decides Age Division by birth year for each Season.

## Decision
- **Date of Birth is an optional Player detail**, an Account setting kept on the server and edited on the Settings page. It is not a Device setting: it follows the User to every device.
- **Export fills it in.** The export dialog pre-fills it, and a change there applies to that export only, like the other Player details.
- **Age Division is worked out from Date of Birth** in `packages/core`, from the birth-year cut-offs for a Season (ADR 16). An export from a Team's page uses today's Season; an export from a Tournament's Team snapshot uses the Season of the Tournament's start date. The stored Age Division is the fallback when there is no Date of Birth. Settings shows the worked-out division, read-only, and offers the manual picker only without a Date of Birth.
- **Player details, Date of Birth included, are in the Data export**, as ADR 23 already says for Player details. Import takes each field from the file only when the User's own is empty.

## Consequences
- MyVGC holds the User's date of birth alongside Player ID and Support ID. The hosted service must treat it as personal data (`docs/risks.md`, DEV-41).
- A Data export file now holds a date of birth, so sharing one shares it.
- The birth-year cut-offs ship with the Season calendar and change with it.
