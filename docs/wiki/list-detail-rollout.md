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
  - ADR 13 says "one smoke test", but `smoke.spec.ts` now holds 5.
  - The `listStyle` branching is repeated in about six places.
- As of `jobanmendpara/myvgc@b398ea1` (DEV-89):
  - The search lives in `packages/core/src/search.ts`, exported from `@myvgc/core/search` (uFuzzy 1.0.19).
  - `composables/useListSearch.ts` keeps each query in `useState`.
  - `ListColumn.vue` owns the search box and the "no matches" state.
  - `docs/research/fuzzy-matching.md` is now on main.
- Open after DEV-89 (2026-11-11):
  - The Opponents list is capped at the API's limit of 1000.
  - The Round form's picker still uses server substring search, per DEV-82. The review suggested noting this in ADR 17.
- On 2026-11-11 the open items below were filed in Linear:
  - DEV-94: one shared discard dialog
  - DEV-95: gather the List style branching
  - DEV-96: smoke test for merging and deleting an Opponent
  - DEV-97: the 1000-Opponent cap
  - DEV-98: ADR 13 and ADR 17
  - DEV-99: make local typecheck agree with CI
  - The session-only offline List style was added as a comment on DEV-48. The "Team not found" back button was not filed.
- Follow-ups left open on 2026-11-11: the "Discard changes?" dialog is copied in five forms, and Opponent merge and delete aren't covered by the smoke test.

Related: [parallel agents](parallel-agents.md).
