# 09: Dashboard: breakdowns

**What to build:** The dashboard adds Game win rate, Top cut rate, win rates split by Swiss and Top cut and by best-of, performance by Team (snapshots of the same Team together), most-played Opponents with Head-to-head records, and best Placements.

**Blocked by:** 04, 06, 08

**Status:** ready-for-agent

- [ ] Core unit tests cover the Game win rate using only scored Rounds, the Top cut rate out of Tournaments with Rounds, grouping by original Team with a fallback for snapshots whose Team was deleted, the top 10 Opponents, and best Placements with ties broken by the more recent Tournament.
- [ ] The dashboard shows each breakdown and works at 375 px wide.
