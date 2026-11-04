# 16. Seasons and Regulation dates ship with the app

Date: 2026-11-04
Status: Accepted

## Context
The dashboard filters by current Regulation and by Season (the period between one Worlds and the next), and a new Tournament's Regulation defaults to the one in force on its date. Both need dates. We could work Seasons out from the Worlds Tournaments a User has logged, let each User define their own, or ship a fixed calendar.

## Decision
`packages/core` holds a fixed list of Seasons and Regulations with their start and end dates, next to `REGULATIONS`. The current Regulation is the one whose dates cover today. A Tournament belongs to the Season its start date falls in. Users can't edit either list.

## Consequences
- Filters are correct whether or not the User went to Worlds, and every User sees the same boundaries.
- A new Regulation or Season needs a release. Regulations change every one to three months and are announced at least 30 days ahead, so this is routine upkeep. Self-hosters only get the new dates when they upgrade.
- If a Regulation's end date is unknown, it stays open-ended until a release sets it.
