# List and detail rollout

The map is DEV-77. The decisions are DEV-78 to DEV-83. The build issues are below.

| Issue | What | Status (dated) |
| --- | --- | --- |
| DEV-84 | Split layout for Tournaments | Merged in PR #113, `jobanmendpara/myvgc@91d1ca8` (2026-11-11) |
| DEV-87 | List style Account setting on the API | Merged in PR #106 (2026-11-11) |
| DEV-85 | Split layout for Teams | Merged in PR #115 (2026-11-11), after a clean rebase onto #114 |
| DEV-86 | Split layout for Opponents | Merged in PR #114 (2026-11-11) |
| DEV-88 | List style control (Compact, Detailed, Grouped) | Merged in PR #116, `jobanmendpara/myvgc@51ef1e8` (2026-11-11). CI passed on the second run |
| DEV-89 | Fuzzy search on all three lists | Merged in PR #117, `jobanmendpara/myvgc@b398ea1` (2026-11-11). On 2026-11-11, with the user's approval, the chief-of-staff deleted the branches `prototype/dev-78-list-detail` and `research/fuzzy-matching`. The research note survives on main, identical to the branch copy |

## Notes

- As of `jobanmendpara/myvgc@91d1ca8`, DEV-84 added the shared pieces `apps/web/app/components/ListDetail.vue` and `composables/useWideLayout.ts`. DEV-85 and DEV-86 follow it.
- On 2026-11-11 the user set the order: DEV-85 and DEV-86 in parallel, then DEV-88, then DEV-89. Each is shipped the way [shipping flow](shipping-flow.md) describes.

- In PR #114 (2026-11-11), DEV-86 changed `pages/opponents/index.vue` into the parent route `pages/opponents.vue` and added `components/OpponentSummary.vue`.
- Also in PR #114, `composables/useDiscardGuard.ts` started asking on `onBeforeRouteUpdate`. Nuxt remounts `[id]` children keyed by path, so `onBeforeRouteLeave` alone misses a click from one row to another. This applies to every form that uses the guard.
- In PR #115 (2026-11-11), DEV-85 changed `pages/teams/index.vue` into the parent route `pages/teams.vue`. It added `components/TeamSummary.vue`, which the card and the row share, and `composables/useNewTeamCancelTo.ts`, which sends Cancel to the placeholder on wide screens and to the chooser on phones.
- The DEV-85 review on 2026-11-11 found the list-column shell (header, states, row classes) and the pattern of hiding back links on wide screens copied across `tournaments.vue`, `teams.vue` and `opponents.vue`. DEV-88 was asked to extract a shared shell while it reworks the rows.
- Smoke-test gotcha found in DEV-85 (2026-11-11): on wide screens a row and its detail page can show the same test ID (for example `legality-badge`). Scope assertions to a container such as `data-testid="team-header"`.
- Open choice, 2026-11-11: the "Team not found" card still shows "Back to your Teams" on wide screens. It was left in on purpose.
- As of `jobanmendpara/myvgc@51ef1e8` (DEV-88), the shared list pieces are:
  - `ListColumn.vue`, with a `#header` slot for search
  - `ListRows.vue`, whose optional `groupBy` drives the Grouped headings
  - `ListStyleControl.vue`, `useListStyle.ts` and `ListBackLink.vue`
  - `groupTournaments`, `groupTeams` and `groupOpponents` in `packages/core/src/list-style.ts`

  Each page wraps the group function in a typed arrow function, because passing the generic core function straight in broke CI's typecheck.
- Open after DEV-88 (2026-11-11):
  - The style "applies offline" only within a session, because the TanStack Query cache isn't persisted yet (ADR 17's persistence isn't built).
  - ADR 13 says "one smoke test", but `smoke.spec.ts` now holds 5. (Superseded 2026-11-11: DEV-98 amended ADR 13, see below.)
  - The `listStyle` branching is repeated in about six places. (Superseded 2026-11-11: DEV-95 gathered it, see below.)
- As of `jobanmendpara/myvgc@b398ea1` (DEV-89):
  - The search lives in `packages/core/src/search.ts`, exported from `@myvgc/core/search` (uFuzzy 1.0.19).
  - `composables/useListSearch.ts` keeps each query in `useState`.
  - `ListColumn.vue` owns the search box and the "no matches" state.
  - `docs/research/fuzzy-matching.md` is now on main.
- Open after DEV-89 (2026-11-11):
  - The Opponents list is capped at the API's limit of 1000. (Superseded 2026-11-11: DEV-97 lifted the cap, see below.)
  - The Round form's picker still uses server substring search, per DEV-82. The review suggested noting this in ADR 17. (Done 2026-11-11 in DEV-98, see below.)
- On 2026-11-11 the open items below were filed in Linear:
  - DEV-94: one shared discard dialog
  - DEV-95: gather the List style branching
  - DEV-96: smoke test for merging and deleting an Opponent
  - DEV-97: the 1000-Opponent cap
  - DEV-98: ADR 13 and ADR 17
  - DEV-99: make local typecheck agree with CI
  - The session-only offline List style was added as a comment on DEV-48. The "Team not found" back button was not filed.
- Follow-ups left open on 2026-11-11: the "Discard changes?" dialog is copied in five forms, and Opponent merge and delete aren't covered by the smoke test. (Superseded 2026-11-11: DEV-94 and DEV-96 closed both, see below.)

## Follow-ups (DEV-94 to DEV-100)

| Issue | What | Status (dated) |
| --- | --- | --- |
| DEV-94 | One shared discard dialog | Merged in PR #127, `jobanmendpara/myvgc@e837dd5` (2026-11-11). CI passed on the first run |
| DEV-96 | Smoke test for merging and deleting an Opponent | Merged in PR #126, `jobanmendpara/myvgc@c8e6b3e` (2026-11-11), after a clean rebase over #127 |
| DEV-99 | Make local typecheck agree with CI | Merged in PR #128, `jobanmendpara/myvgc@c0df2d8` (2026-11-11). See [parallel agents](parallel-agents.md) |
| DEV-98 | Bring ADR 13 and ADR 17 up to date | Merged in PR #129, `jobanmendpara/myvgc@33b9823` (2026-11-11) |
| DEV-97 | The 1000-Opponent cap | Merged in PR #130, `jobanmendpara/myvgc@3bd06b2` (2026-11-11) |
| DEV-95 | Gather the List style branching | Merged in PR #131, `jobanmendpara/myvgc@d8ef104` (2026-11-11) |
| DEV-100 | Unit tests for the web app's own logic | Filed 2026-11-11. Built in `jobanmendpara/myvgc@aff4e71` |

- As of `jobanmendpara/myvgc@e837dd5` (DEV-94), `useDiscardGuard` returns a `DiscardDialog` component built with `h()`, and forms render `<DiscardDialog />`. The markup is in `components/DiscardChangesDialog.vue`. It is the only composable that returns a component. Nuxt also auto-registers `DiscardChangesDialog`, so a form could use it and bypass the guard; on 2026-11-11 that was left as a code comment only.
- DEV-96 (PR #126, `jobanmendpara/myvgc@c8e6b3e`, 2026-11-11) added smoke coverage for merging an Opponent (wide screens) and deleting one (both widths). It found no bug.
- DEV-98 (`jobanmendpara/myvgc@33b9823`, 2026-11-11) amended ADR 13 to describe a smoke suite with no fixed count, and ADR 17 to say list search runs in the browser while the Round form's picker searches on the server. The Linear documents for ADR 13 and ADR 17 were updated to match. The chief-of-staff flagged ADR 17's "fetches its Opponents up front" for a recheck against DEV-97; after DEV-97 merged, it still holds.
- As of `jobanmendpara/myvgc@3bd06b2` (DEV-97), `GET /api/opponents` takes an `offset`, and its sort ends with the id so pages are stable. The web app's `fetchEveryOpponent` in `apps/web/app/lib/opponent-list.ts` asks for pages until one comes back short. Known gap: an Opponent added or deleted while the pages load can be missed or shown twice. The DEV-97 agent skipped the code-review step because the diff was small (see [shipping flow](shipping-flow.md)).
- On 2026-11-11 the chief-of-staff noted that `apps/web` had no unit-test runner, so `fetchEveryOpponent` was checked once with a throwaway test and could regress unseen. DEV-100 was filed for it the same day.
- As of `jobanmendpara/myvgc@d8ef104` (DEV-95):
  - `apps/web/app/lib/list-style-look.ts` holds `LIST_STYLE_LOOKS`, one entry per List style.
  - `ListRows.vue` has `#compact`, `#detailed` and `#grouped` slots, works out the selected id itself, and takes `searching`.
  - `TournamentRows.vue`, `TeamRows.vue` and `OpponentRows.vue` replace the `*Summary` components.
  - `ListColumn.vue` takes `loadFailed`.
  - The DEV-95 agent found that generic slot inference had been broken locally before DEV-99, by the same stray `~/node_modules`.
- As of `jobanmendpara/myvgc@aff4e71` (DEV-100, 2026-11-11), `apps/web` has a `test` script running plain Vitest, so `pnpm test` and CI run it. `apps/web/test/` covers `fetchEveryOpponent`, with Nuxt's global `$fetch` stubbed, and `app/lib/format.ts`. Nuxt's typecheck includes `test/` through `typescript.tsConfig` in `nuxt.config.ts`. ADR 13 now says web unit tests cover web-only logic, while domain logic stays in `packages/core`.

Related: [parallel agents](parallel-agents.md).
