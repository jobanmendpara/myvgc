# 05: Log Swiss Rounds with Opponents created on the spot

**What to build:** At an event, a User logs a Swiss Round in a few taps: the round number is filled in, the best-of defaults to the Tournament's, they pick Win, Loss or Tie, and they choose an Opponent by typing part of a display name or Alias, or create a new one on the spot. A Bye is a Round with no Opponent that counts as a win. Rounds can be edited and deleted. The Tournament shows its Swiss Record as Rounds are logged.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Core works out a Record from Rounds (Byes count as wins) and applies the Round rules (a Bye has no Opponent and is always a Win; every other Round has an Opponent).
- [ ] `POST /api/tournaments/:id/rounds` takes an existing Opponent ID or a new Opponent's display name (created in the same transaction); the next free Swiss round number is the default; a duplicate round number is refused.
- [ ] `PATCH` and `DELETE` on a Round work, and answer 404 for another User's Round.
- [ ] `GET /api/opponents?q=` finds the User's Opponents by display name or Alias.
- [ ] Deleting a Tournament deletes its Rounds but keeps its Opponents.
- [ ] The smoke test creates a Tournament, logs a Round against a new Opponent and sees the Record.
