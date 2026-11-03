# 9. Tournaments and Rounds keep snapshots of Teams

Date: 2026-11-03
Status: Accepted

## Context
Users tweak Teams between events, but a Tournament should remember the Team exactly as it was brought.

## Decision
Attaching a Team to a Tournament saves a frozen copy, a Team snapshot, that links back to the original Team. The same applies to an Opponent's Team on a Round. Teams have no version history.

## Consequences
- Past Tournaments stay accurate, and their Teamsheets regenerate exactly.
- Snapshot data is duplicated. That's acceptable because Teams are small.
