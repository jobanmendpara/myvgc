# 08: Dashboard: headline figures and filters

**What to build:** A dashboard shows Tournaments played, Round record and win rate, Championship Points per Season and Entry fees per currency. It filters by Regulation (current by default, or all), Season or date range, Event tier, and online or in person. It notes when the partial 2026 Season is included, and explains when nothing matches.

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] Core: one pure summary function. Unit tests cover win rates without Byes, Ties counting as non-wins, CP per Season (and "No Season"), fees per currency including Upcoming Tournaments, and an empty input.
- [ ] `GET /api/dashboard` applies each filter, defaults to the current Regulation, reports the filters it applied, and refuses a Season sent with a date range.
- [ ] Choosing a Season fills in the date range; editing the dates clears the Season.
