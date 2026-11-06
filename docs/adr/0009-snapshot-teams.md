# 9. Tournaments and Rounds keep snapshots of Teams

Date: 2026-11-03
Status: Accepted. The Opponent's Team part is superseded by ADR 22.

## Context
Users tweak Teams between events, but a Tournament should remember the Team exactly as it was brought.

## Decision
Attaching a Team to a Tournament saves a frozen copy, a Team snapshot, that links back to the original Team. ~~The same applies to an Opponent's Team on a Round.~~ Superseded by ADR 22: an Opponent's Team belongs to a Tournament and is not a snapshot. Teams have no version history.

## Consequences
- Past Tournaments stay accurate, and their Teamsheets regenerate exactly.
- Snapshot data is duplicated. That's acceptable because Teams are small.
