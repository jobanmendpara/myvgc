# Conventions

Agreed with the user on 2026-11-11: the wiki lives in `docs/wiki/`.

- `index.md` lists every page with a one-line summary, grouped by category.
- One page covers one thing: a decision, a recurring problem, a subsystem or a preference. Link related pages to each other.
- Write history, not the present. Date every claim, and cite the commit for any claim about code (`jobanmendpara/myvgc@<sha>`). When something changes, add a new dated claim and mark the old one superseded rather than rewriting it.
- Sources (Linear issues, PRs, ADRs, subagent reports) are cited, never copied in. ADRs in `docs/adr/` stay the source of truth for decisions. This wiki records how the work went.
- Use the glossary in `CONTEXT.md`.
- From 2026-11-12 a daily scheduled check, set up by the chief-of-staff as a cron that lasts only as long as its session, lints the wiki (see [parallel agents](parallel-agents.md)). (Superseded 2026-11-16: the lint runs as a scheduled routine that starts its own session, so it no longer depends on the chief-of-staff's session.)
- On 2026-11-17 the user decided to keep two daily lints. The user's scheduled "Wiki lint" routine lints the wiki and opens a `chore/wiki-lint-<date>` PR (as with PR #207). The chief-of-staff's daily upkeep cron then works on `chore/wiki-upkeep-<date>` and adds only what that day's routine PR missed. This adds to the 2026-11-16 line above: the routine is the main lint, and the cron is not retired. See [parallel agents](parallel-agents.md), "Daily upkeep on 2026-11-17".
