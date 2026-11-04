# 04: Link a Team snapshot

**What to build:** A User links one of their Teams to a Tournament, which saves a Team snapshot (ADR 9). They can replace or unlink it, and re-snapshot it until the Tournament's end date has passed. The Tournament page shows the snapshot's Pokémon builds, and warns when the Team's Regulation differs from the Tournament's.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `PUT /api/tournaments/:id/team` saves a snapshot of the User's Team; another User's Team is a 404; once the end date (or the start date, if there is no end date) has passed it answers 409.
- [ ] Editing the original Team afterwards doesn't change the snapshot; deleting it keeps the snapshot with no source.
- [ ] `DELETE /api/tournaments/:id/team` unlinks it.
- [ ] The response and the Tournament page carry a Regulation mismatch warning when the Regulations differ.
