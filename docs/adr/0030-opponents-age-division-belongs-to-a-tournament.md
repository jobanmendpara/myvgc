# 30. An Opponent's Age Division belongs to a Tournament

Date: 2026-11-23
Status: Accepted (DEV-174).

## Context
At small Local Tournaments, Juniors, Seniors and Masters play together, so a User's Opponents can be in any Age Division. The User wants to record which one each Opponent played in. Their own Placement is already within their own division, so it doesn't change. An Age Division can change from one Season to the next, and the User rarely knows an Opponent's date of birth.

## Decision
- **One Opponent's Age Division per Opponent per Tournament**, shared by every Round against them there, like an Opponent's Team (ADR 22). It is not stored on the Opponent, which would go stale when they move up, and it is not stored on each Round, which would repeat it. MyVGC never stores an Opponent's date of birth or birth year.
- **It stands on its own.** It can be recorded with or without an Opponent's Team, so it is kept in its own `opponent_age_division` table rather than on `opponent_team`. That keeps ADR 22's "one to six species" rule as it is.
- **It is optional on every Tournament**, blank by default, whatever the Event tier.
- **The Round write carries it** as `opponentAgeDivision`. Left out, it is unchanged; `null` clears it. Sending one on a Bye or with no Opponent is a validation issue on that field. It travels through the outbox with the Round (ADR 17).
- **Copy offer, same Season only.** When the User chooses an Opponent with none in this Tournament, the Round form fills in theirs from the latest other Tournament in the same Season, by start date. Across Seasons it stays blank, since MyVGC can't tell a Masters player from someone who just moved up.
- **Lifecycle.** It is deleted with the last Round against that Opponent in the Tournament, or when that Round changes Opponent, in the same transaction as their Opponent's Team, after the same warning.
- **Merge.** Where both Opponents have one in a Tournament, the survivor's is kept; otherwise the duplicate's moves to the survivor.
- **Shown** as a J / S / M badge beside the Opponent's name in a Tournament's Rounds, and in full on each Tournament on the Opponent's page. It is not shown on the Opponents list, because one person can be in different divisions over time.
- **Data export** version 5 carries each Tournament's Opponent's Age Divisions, with their ids and timestamps (ADR 23). Version 4 files are upgraded with none. Import adds one only where the account has none for that Tournament and Opponent, and only where a Round there is against that Opponent.

## Consequences
- Statistics and Head-to-head records are not split by Age Division. Doing so later can read from this table.
- The Tournament view, the saved-Round answer and the Opponent's page each gain a field next to their Opponent's Team.
