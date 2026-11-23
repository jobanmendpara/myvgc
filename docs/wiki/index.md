# Wiki

The chief-of-staff's record of decisions, recurring problems and preferences. It is a history: every claim is dated, and claims about code cite a commit. See [conventions](conventions.md).

## Workstreams

- [List and detail rollout](list-detail-rollout.md): DEV-84 to DEV-89, the split layout, List styles and fuzzy search, and the follow-ups DEV-94 to DEV-100.
- [Team reading rollout](team-reading-rollout.md): DEV-38 (closed 2026-11-12) and DEV-62 to DEV-66, reading Teamsheets and images into Teams; DEV-102 checks image reading against the real model; the DEV-118 map for real screenshots (grilled 2026-11-14 to 15), and its build issues DEV-129, DEV-131, DEV-130 and DEV-106, merged by 2026-11-18 (DEV-145 closed with DEV-106, and the maintainer let it stay Done); DEV-132 (JPEG uploads), DEV-133 (only Replica Team tabs and Pokémon detail screens), DEV-134 (nicknames and gender, signed off by the maintainer after one case read worse), DEV-135 (Stat Alignment from the arrows, checked against the numbers; JPEG reads the arrows as well as PNG), DEV-136 (a species flagged when the stats fit the nickname) and DEV-137 (flags for fields the images didn't show; DEV-137 rebased onto DEV-136) merged on 2026-11-19, leaving every DEV-118 sub-issue Done, and the maintainer moved DEV-118 to Done the same day; DEV-163 (Basculegion's form) and DEV-164 (the Replica Team ID flag) merged on 2026-11-21.
- [Statistics rollout](statistics-rollout.md): DEV-56, DEV-60 and DEV-61, the Statistics page and its Opponent's side, and the follow-ups DEV-113 to DEV-116.
- [Todo round, 2026-11-12](todo-round-2026-11-12.md): DEV-67, DEV-71, DEV-60 and DEV-61, how they ran, and the follow-ups DEV-105 to DEV-116.
- [Refactor round, 2026-11-15](refactor-round-2026-11-15.md): DEV-127, DEV-116, DEV-109, DEV-110 and DEV-113, five implementers at once, the DEV-113 retro and the new rebase rule, and the follow-ups DEV-139 to DEV-144 and DEV-146.
- [Refactor round, 2026-11-17](refactor-round-2026-11-17.md): DEV-139, DEV-142 and DEV-140, the first round under the rebase rule and auto-merge, all merged on their first CI run, and the follow-ups DEV-148 to DEV-151 (DEV-151 Done with v0.2.0 on 2026-11-19).
- [Refactor round, 2026-11-18](refactor-round-2026-11-18.md): DEV-153, DEV-148 and DEV-149, three agents in parallel, all merged on their first CI run, the untested combination of DEV-148 and DEV-149 under `strict: false`, and the follow-ups DEV-154 and DEV-155.

## Preferences

- [Shipping flow](shipping-flow.md): how the user wants agent work committed, reviewed and merged, and from 2026-11-15 branch protection with auto-merge on `main`, and from 2026-11-17 GitHub deleting merged branches; releases, from v0.2.0 on 2026-11-19.

## Recurring problems

- [Parallel agents](parallel-agents.md): running several implementers at once without them colliding, plus the session limit, SSH refusal, worktree locks and, from 2026-11-16, the daily upkeep rules (and from 2026-11-17, how the upkeep and the "Wiki lint" routine split the work; the 2026-11-18 upkeep is there too; from 2026-11-19, `git grep` instead of zsh-broken `--include` globs, and DEV-137 rebasing onto DEV-136 after both ran in parallel; from 2026-11-20, `gh` failing TLS in the sandbox).
- [up:local shares the dev DB](up-local-shares-dev-db.md): a stale container breaks dev migrations.
- [Flaky tests](flaky-tests.md): tests that failed once and passed on a rerun.

## About this wiki

- [Conventions](conventions.md): how pages are written and kept.
