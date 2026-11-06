# 21. Games are part of the Round

Date: 2026-11-06
Status: Accepted (DEV-34)

## Context
A User wants to record each Game of a Round: the Pokémon each side Brought, each side's Leads, and the Game result. A Round already has a Game score, which decides its result when given. Logging a Round must work with no signal (ADR 17), and a Round is often filled in from memory, so what's known about a Game is usually partial.

## Decision
- **Games are saved with their Round.** They are a `games` jsonb column on `round`, validated by `gameSchema` in `packages/core`, and sent inside the Round's input. They need no routes of their own, and they travel through the outbox with the Round.
- **A Game holds** each side's Brought Pokémon (up to 4) and Leads (up to 2, from that side's Brought Pokémon), a Game result (Win, Loss or Tie) and notes. Pokémon are species IDs (ADR 14), so they don't depend on a Team snapshot's slots and work when a side has no Team snapshot.
- **Every field is optional, and gaps are allowed.** Games are numbered 1 to 3: at most one in a best-of-1 Round, at most three in a best-of-3 Round, none in a Bye.
- **Game results decide once they go far enough.** In best of 3, results with no unrecorded Game before them fill in the Game score once a side has won 2, or after Game 3. That score then decides the Round result as before. In best of 1, Game 1's result is the Round's. Partial results leave the Game score or result to the User.
- **They must agree with what the User entered.** A Game score or result that contradicts the Games, a Game after the Round was decided, or a change of best-of that would leave Games beyond it, is a validation issue on that field. Games are never dropped silently.
- **The picker suggests, it doesn't restrict.** It offers a side's Team snapshot first, with any other species as a fallback. The server checks only that species are in Champions, the counts, and that Leads were Brought, in the spirit of ADR 18. Brought Pokémon never change a Team snapshot.

## Consequences
- The stored Game score and result stay what totals read, so the Record, head-to-head records and the dashboard need no changes.
- Statistics on Leads and Brought Pokémon are left for later. The jsonb can be queried with `jsonb_array_elements` when they come.
- The Opponent's side has no Team snapshot to suggest from until DEV-55 adds one, so for now it only searches species.
- Mega Evolution and replay links aren't recorded.
