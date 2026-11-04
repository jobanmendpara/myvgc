# 01: Shared route helpers and app navigation (prefactor)

**What to build:** Make the next tickets easy. The API gets shared helpers for "find this record by ID for this owner, or answer 404" and "validate a JSON body, or answer 400 with errors per field". The Teams routes move onto them with no change in behaviour. The API test helpers gain GET, PATCH, PUT and DELETE alongside POST. The app header gets phone-friendly navigation: Teams, Tournaments, Opponents and Dashboard.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Every existing Teams test still passes, unchanged.
- [x] The Teams routes use the shared helpers; no route copies the ID check or the field-error formatting.
- [x] The header links to Teams, Tournaments, Opponents and Dashboard and fits at 375 px wide.
- [x] Typecheck, lint and format checks pass.
