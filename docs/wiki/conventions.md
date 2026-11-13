# Conventions

Agreed with the user on 2026-11-11: the wiki lives in `docs/wiki/`.

- `index.md` lists every page with a one-line summary, grouped by category.
- One page covers one thing: a decision, a recurring problem, a subsystem or a preference. Link related pages to each other.
- Write history, not the present. Date every claim, and cite the commit for any claim about code (`jobanmendpara/myvgc@<sha>`). When something changes, add a new dated claim and mark the old one superseded rather than rewriting it.
- Sources (Linear issues, PRs, ADRs, subagent reports) are cited, never copied in. ADRs in `docs/adr/` stay the source of truth for decisions. This wiki records how the work went.
- Use the glossary in `CONTEXT.md`.
- From 2026-11-12 a daily scheduled check, set up by the chief-of-staff as a cron that lasts only as long as its session, lints the wiki (see [parallel agents](parallel-agents.md)).
