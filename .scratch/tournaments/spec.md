# Spec: Tournament tracker

Labels: ready-for-agent

Source: the Tournament tracker design interview (2026-11-04), the terms in `CONTEXT.md`, and ADRs 9, 10, 12, 13, 14 and 16. Follows roadmap step 3, except that Opponent Teams on Rounds are left for the next slice.

## Problem Statement

A Pokémon Champions player has no single record of their competitive results. They want to know which Tournaments they went to, what they brought, who they played each Round, how they did, what it cost and how many Championship Points it earned. That information is spread across RK9 standings, Discord messages, notes apps and memory. Because of that, they can't answer simple questions: "How am I doing this Regulation?", "How has my Season gone?", "What's my record against this player?" or "Which of my Teams actually performed?". Logging a Round at an event also has to be quick, on a phone, between Rounds.

## Solution

Tournaments in MyVGC. A User creates a Tournament with its details (name, dates, location, online or in person, Event tier, Regulation, Organizer, Entry fee, Championship Points, player count, an optional external link and notes), and links one of their Teams to it, which saves a Team snapshot. During the event they log each Round in a few taps: the phase (Swiss Round number or Top cut stage), best of 1 or 3, the result or Game score, the Opponent and notes. They can pick the Opponent by name or Alias, or create a new one on the spot. The Tournament shows its Record, worked out from its Rounds, plus the Placement and Dropped flag the User enters.

An Opponents area lists everyone the User has played. Each Opponent's page shows their Aliases, notes, Head-to-head record and every Round against them.

A dashboard sums up performance:
- Tournaments played
- Round record and win rate
- Game win rate
- Top cut rate
- Championship Points per Season
- Entry fees per currency
- win rate by phase and by best-of
- performance by Team
- most-played Opponents
- best Placements

It can be filtered by Regulation (defaulting to the current one), Season or date range, Event tier, and online or in person. Seasons and Regulation dates ship with the app (ADR 16).

## User Stories

### Tournaments
1. As a User, I want to create a Tournament with a name and start date, so that I can start logging an event with the minimum of typing.
2. As a User, I want to give a Tournament an end date when it runs over several days, so that multi-day Regionals and Internationals are recorded properly.
3. As a User, I want a new Tournament's Regulation to default to the one in force on its start date, so that I rarely have to choose it.
4. As a User, I want to change a Tournament's Regulation by hand, so that unusual events, such as a grassroots event running an old format, are recorded correctly.
5. As a User, I want to choose an Event tier (Premier Challenge, Regional, International, Worlds, Grassroots, Online, Other), so that I can compare like with like.
6. As a User, I want to mark a Tournament as online or in person, so that I can filter my results by setting.
7. As a User, I want to record a Tournament's location, so that I remember where it was.
8. As a User, I want to record the Organizer, with suggestions from Organizers I've entered before, so that repeat locals take one tap and are spelled the same way every time.
9. As a User, I want to record the Entry fee as an amount and a currency, so that I know what competing costs me.
10. As a User, I want the Entry fee currency to default to the one on my last Tournament, so that I don't have to pick it every time.
11. As a User who travels, I want to record fees in different currencies, so that a Regional abroad is recorded accurately.
12. As a User, I want to record the Championship Points I earned at a Tournament, so that I can track my progress toward a Worlds invite.
13. As a User, I want to record the player count, so that my Placement reads as "9th of 128".
14. As a User, I want to add an optional external link (RK9, Limitless, start.gg), so that I can jump back to the official standings. Many locals have none.
15. As a User, I want to set a default best-of (1 or 3) for a Tournament, so that every Round I log starts with the right setting.
16. As a User, I want Markdown notes on a Tournament, so that I can write down travel, metagame reads and lessons.
17. As a User, I want to enter my Placement, so that I remember how far I got.
18. As a User, I want a Placement suggested when I log a Top cut loss (for example 3rd after losing in Top 4), so that I usually only have to confirm it.
19. As a User, I want to mark that I Dropped, so that an early exit isn't mistaken for missing data.
20. As a User, I want to create a Tournament before it happens, so that I can log the Entry fee when I register.
21. As a User, I want Tournaments whose start date is still in the future to show as Upcoming, so that I can tell them apart from past events.
22. As a User, I want to see a list of my Tournaments, newest first, showing name, date, Event tier, Regulation, Record and Placement, so that I can find one quickly.
23. As a User, I want to edit any detail of a Tournament, so that I can fix mistakes.
24. As a User, I want to delete a Tournament after a confirmation that tells me how many Rounds it will delete, so that I don't lose data by accident.
25. As a User, I want the Opponents I created while logging a deleted Tournament to remain, so that my Opponent records aren't lost with it.
26. As a User, I never want to see another User's Tournaments, Rounds or Opponents.

### Team on a Tournament
27. As a User, I want to link one of my Teams to a Tournament, so that I remember what I brought.
28. As a User, I want linking to save a Team snapshot, so that later edits to the Team don't rewrite history (ADR 9).
29. As a User, I want to log a Tournament with no Team linked, so that I can record events for Teams I never imported.
30. As a User, I want a warning, though not a block, when the Team's Regulation differs from the Tournament's, so that I catch mistakes without being stopped.
31. As a User, I want to re-snapshot the Team until the Tournament's end date has passed, so that last-minute changes I made after linking it are captured.
32. As a User, I want to unlink or replace the Team on a Tournament, so that I can fix a wrong choice.
33. As a User, I want a Tournament's snapshot to survive when I delete the original Team, so that past Tournaments stay complete.
34. As a User, I want to see the snapshot's Pokémon builds on the Tournament page, so that I can review exactly what I brought.

### Rounds
35. As a User at an event, I want to log a Round in a few taps on my phone, so that I can do it between Rounds.
36. As a User, I want the next Swiss Round number filled in for me, so that I don't have to count.
37. As a User, I want to log a Top cut Round by stage (Top 64, Top 32, Top 16, Top 8, Top 4, Finals), so that it matches how the event was announced.
38. As a User, I want a Round's best-of to default to the Tournament's setting and to be changeable, so that events with best-of-3 Top cuts after best-of-1 Swiss are recorded correctly.
39. As a User, I want to record a Round result of Win, Loss or Tie, so that my Record is right. Intentional draws and time-outs count as Ties.
40. As a User, I want to record the Game score of a best-of-3 Round (for example 2-1), so that I keep that detail.
41. As a User, I want a Game score to decide the Round result, so that the two can never disagree.
42. As a User, I want to log a Bye, a Round with no Opponent that counts as a win, so that my Record matches the official standings.
43. As a User, I want to pick the Opponent by typing part of their display name or any Alias, so that I find them however I remember them.
44. As a User, I want to create a new Opponent on the spot from what I typed, when there's no match, so that I never have to leave the Round form.
45. As a User, I want Round notes (leads, what they brought, key turns) in Markdown, so that I can study the Round later.
46. As a User, I want to edit or delete a Round, so that I can fix logging mistakes.
47. As a User, I want to see a Tournament's Rounds in order, Swiss first and then Top cut stages, with the Opponent, result and Game score, so that I can replay the event at a glance.
48. As a User, I want the Tournament's Record to update as I log Rounds, shown as Swiss and Top cut separately (for example "6-2-0, 0-1 in Top cut"), so that I always see where I stand.

### Opponents
49. As a User, I want a list of my Opponents with my Head-to-head record against each, so that I can see who I play most.
50. As a User, I want to search my Opponents by display name or Alias, so that I can find one quickly.
51. As a User, I want an Opponent page showing their display name, Aliases, notes, Head-to-head record and every Round against them, along with each Round's notes, so that I can prepare before I play them again.
52. As a User, I want to rename an Opponent, so that I can fix a typo from creating them in a hurry.
53. As a User, I want to add and remove Aliases (legal name, screen name, Discord username, nickname), so that I can find them under any name in future.
54. As a User, I want Markdown notes on an Opponent, so that I can keep a scouting report.
55. As a User, I want to delete an Opponent with no Rounds, so that I can clean up mistakes.
56. As a User, I want to be told that an Opponent with Rounds can't be deleted, so that I don't break my Tournament history. Merging duplicates comes later.
57. As a User, I want to create an Opponent from the Opponents area as well, so that I can add someone I plan to scout.

### Dashboard
58. As a User, I want a dashboard of my overall performance, so that I can see how I'm doing without counting by hand.
59. As a User, I want the dashboard to default to the current Regulation, so that it shows what's most relevant now.
60. As a User, I want to filter by any Regulation or all of them, so that I can compare formats.
61. As a User, I want to filter by Season, so that I see my results between one Worlds and the next.
62. As a User, I want to filter by a custom date range, so that I can look at any stretch of time.
63. As a User, I want choosing a Season to fill in the date range, so that the two filters never contradict each other.
64. As a User, I want to filter by Event tier, so that I can see how I do at Regionals compared with locals.
65. As a User, I want to filter by online or in person, so that I can compare the two.
66. As a User, I want to see how many Tournaments I played, so that I know how active I've been.
67. As a User, I want to see my Round record and win rate, without Byes, so that the rate reflects real games.
68. As a User, I want to see my Game win rate across Rounds that have a Game score, so that I see performance at the Game level.
69. As a User, I want to see my Top cut rate (Tournaments where I reached Top cut, out of all Tournaments), so that I know how often I make it.
70. As a User, I want to see the Championship Points I've earned, with one total per Season when the filter covers several Seasons, so that a CP figure always means something.
71. As a User, I want to see what I've spent on Entry fees, totalled per currency, so that I know what competing costs.
72. As a User, I want win rates split by Swiss and Top cut, so that I can tell whether I fold under pressure.
73. As a User, I want win rates split by best-of-1 and best-of-3, so that I know which suits me.
74. As a User, I want performance by Team, with snapshots of the same original Team grouped together, so that I know which of my Teams works.
75. As a User, I want snapshots whose original Team was deleted to still appear under their snapshot name, so that no results go missing.
76. As a User, I want to see the Opponents I've played most, with my Head-to-head record against each, so that I know my rivals.
77. As a User, I want a list of my best Placements, with the Tournament name and player count, so that I can see my highlights.
78. As a User, I want Upcoming Tournaments with no Rounds to count toward spending, but not toward performance, so that planning ahead doesn't skew my stats.
79. As a User, I want the 2026 Season clearly marked as only covering the part played in Champions, so that I understand why its totals look low.
80. As a User, I want the dashboard to explain when there is nothing to show for the chosen filters, so that an empty screen isn't confusing.

### Across the feature
81. As a User at an event, I want every Tournament, Round, Opponent and dashboard screen to work at 375 px wide, so that I can use them on my phone.
82. As a self-hoster, I want the feature to work without any extra services or configuration, so that upgrading is just pulling the new image.
83. As a self-hoster, I want new Regulations and Seasons to arrive with app releases, so that "current Regulation" stays right after I upgrade.

## Implementation Decisions

### Domain (`packages/core`, no I/O)
- **Calendar (ADR 16).** A fixed list of Regulations, each with a start date and an optional end date, and a fixed list of Seasons with start and end dates. The calendar answers four questions: which Regulation is in force on a date, which is current today, which Season a date falls in, and whether a Season is partial. All dates are calendar days (no time of day). Initial data, taken from `docs/research/pokemon-champions-data.md`:
  - M-A runs 2026-04-08 to 2026-06-16, M-B runs 2026-06-17 to 2026-09-08, and M-C starts 2026-09-09 and runs to 2026-12-01.
  - The 2026 Season starts 2026-04-08 (Champions' release) and ends 2026-08-30 (the last day of Worlds 2026). It is marked partial.
  - The 2027 Season starts 2026-08-31 and has no end date yet.
  - Dates after a Regulation or Season with no end date fall into that open-ended entry. Dates before 2026-04-08 belong to no Season, and their Regulation defaults to M-A.
  - Today's date is passed in, never read from the clock, so the calendar stays pure.
- **Round rules.** A best-of-1 Round has no Game score. In a best-of-3 Round, the Game score is optional; each side has 0 to 2 Games, and no more than 3 are played in total. When a Game score is given, it decides the result: more Games won means a Win, fewer means a Loss, and equal means a Tie. A Bye has no Opponent, no Game score and no chosen result; its result is always Win. A Swiss Round has a round number (1 or more) and no stage. A Top cut Round has a stage and no round number.
- **Record.** Worked out from a Tournament's Rounds, giving separate Swiss and Top cut counts of wins, losses and ties. Byes count as wins. It is never stored.
- **Placement suggestion.** Losing in Finals suggests 2nd, Top 4 suggests 3rd, Top 8 5th, Top 16 9th, Top 32 17th and Top 64 33rd. Winning Finals suggests 1st. The suggestion only ever pre-fills the Placement; the User's entry is what gets stored.
- **Dashboard summary.** A single pure function. It takes a User's Tournaments (with their Rounds, Team snapshot identity, Entry fee and CP), the calendar and today's date, and returns every dashboard figure.
  - Win rates leave out Byes, and a Tie counts as a non-win (wins ÷ Rounds played).
  - Game win rate uses only Rounds with a Game score.
  - Top cut rate is the number of Tournaments with at least one Top cut Round, divided by Tournaments with at least one Round.
  - CP is grouped by Season, and Tournaments outside any Season are grouped as "No Season".
  - Entry fees are grouped by currency and include Upcoming Tournaments.
  - Performance by Team groups by the original Team ID, falling back to the snapshot for snapshots whose Team was deleted.
  - Most-played Opponents is the top 10 by Rounds played, with their Head-to-head records.
  - Best Placements is the top 10 by Placement, with ties broken by the more recent Tournament.
  - Filtering happens before this function is called. Keeping the function in core means nearly all dashboard behaviour is tested without a database.
- **Shared Zod schemas** (in the part of core the web app imports) for creating and updating Tournaments, Rounds and Opponents, and for dashboard filters. Limits follow the existing ones: names up to 100 characters and notes up to 20,000.
- **Entry fees** are stored as a whole number of minor units (cents) plus an ISO 4217 currency code. Amounts in different currencies are never converted or added together.
- **Event tier** has a fixed list: Premier Challenge, Regional, International, Worlds, Grassroots, Online, Other.
- **Format** isn't modelled: Tournaments are doubles only.

### Storage (Postgres, Drizzle; migrations generated and committed, then run on start-up)
- **`tournament`:**
  - ownership: ID, owner
  - details: name, start date, optional end date (on or after the start date), optional location, online flag, Event tier, Regulation, optional Organizer, optional Entry fee (amount and currency, both or neither), optional CP (0 or more), optional player count (2 or more), optional external link (http or https URL), default best-of (1 or 3), notes
  - results: optional Placement (1 or more, and no higher than the player count when that's known), Dropped flag
  - Team snapshot fields: the source Team ID (set to null when that Team is deleted), plus the Team's name, Regulation and Pokémon builds as JSON, and the time it was taken. These are nullable as a group, because a Tournament can have no Team.
  - created and updated timestamps
- **`round`:** ID, Tournament (deleted with the Tournament), phase, round number or Top cut stage, best-of, Bye flag, result, optional Game score (both sides or neither), optional Opponent, notes, and created and updated timestamps. The Opponent is required except on a Bye; deleting an Opponent with Rounds is refused. Each Tournament can have each Swiss round number only once and each Top cut stage only once. Owner is checked through the Tournament.
- **`opponent`:** ID, owner, display name, notes, and created and updated timestamps.
- **`opponent_alias`:** ID, Opponent (deleted with the Opponent) and name. Search matches display names and Alias names, ignoring case and spaces at either end.
- The Team snapshot lives in columns on the Tournament, not a separate table, because a Tournament has at most one. The Round's Opponent Team snapshot for the next slice will go on the Round in the same way.
- Regulation reuses the existing enum. Event tier, round phase, Top cut stage and Round result become new enums.

### API (Hono, under `/api`, every route behind the session)
Routes follow the Teams conventions:
- Another User's records answer with 404, exactly like missing ones.
- Invalid bodies get a 400 with errors per field.
- Responses use IDs and ISO dates.

**Tournaments**
- `GET /api/tournaments`: the User's Tournaments, newest start date first, each with its Record, Placement and whether it is Upcoming.
- `POST /api/tournaments` creates a Tournament and returns 201. If the Regulation is left out, it is taken from the start date.
- `GET /api/tournaments/:id`: the Tournament with its Team snapshot (builds with display names), its Rounds in order (Opponent display names included), its Record, and a Regulation mismatch warning when there is one.
- `PATCH /api/tournaments/:id` updates the details, Placement and Dropped flag.
- `DELETE /api/tournaments/:id` returns 204 and deletes its Rounds.

**Team snapshot**
- `PUT /api/tournaments/:id/team` with a Team ID links or replaces the Team snapshot. It also re-snapshots, and is refused with 409 once the end date (or start date) is in the past.
- `DELETE /api/tournaments/:id/team` unlinks the Team.
- The response includes a warning when the Regulations differ.

**Organizer suggestions**
- `GET /api/tournaments/organizers?q=` returns the distinct Organizers the User has entered, for autocomplete.

**Rounds**
- `POST /api/tournaments/:id/rounds` creates a Round and returns 201. The body takes either an existing Opponent ID or a new Opponent's display name, in which case the Opponent and Round are created together in one transaction. For Swiss Rounds, the round number defaults to the next free one, and the best-of defaults to the Tournament's.
- `PATCH /api/tournaments/:id/rounds/:roundId` and `DELETE /api/tournaments/:id/rounds/:roundId` edit and delete a Round.
- When a Round is saved, the response includes the updated Record. If the Round was a Top cut Round, it also includes a suggested Placement.

**Opponents**
- `GET /api/opponents?q=`: the User's Opponents, each with their Aliases, Head-to-head record and Round count, filtered by display name or Alias when `q` is given. Exact matches come first.
- `POST /api/opponents` creates an Opponent, and `GET /api/opponents/:id` returns one with its Aliases, notes, Head-to-head record and every Round (Tournament name, date, phase, result, Game score and notes).
- `PATCH /api/opponents/:id` updates the display name, notes and Aliases (the full list is replaced).
- `DELETE /api/opponents/:id` returns 204, or 409 if the Opponent has Rounds.

**Dashboard**
- `GET /api/dashboard` takes these filters, which can be combined:
  - `regulation` (a Regulation or `all`, defaulting to the current one)
  - `season`, or `from` and `to` (sending a Season along with a date range is a 400)
  - `eventTier` (can be repeated)
  - `setting` (`online` or `in-person`)
- It returns the core summary, plus the filters actually applied, so the web app can show the resolved defaults.

**Calendar**
- `GET /api/calendar` returns the Regulations and Seasons with their dates and which one is current, so the web app can build filters and defaults without loading the full core package.

### Web app (Nuxt single-page app, shadcn-vue, TanStack Query)
- **Pages:**
  - `/tournaments` (list, with Upcoming ones marked)
  - `/tournaments/new`
  - `/tournaments/:id` (details, Team snapshot, Rounds, Record, a quick "Log Round" action)
  - `/tournaments/:id/edit`
  - `/opponents` and `/opponents/:id`
  - `/dashboard`, linked from the main navigation and the landing page after login
- **Logging a Round** is a single phone-first form, in a sheet or page:
  - phase toggle
  - round number or stage, pre-filled
  - best-of toggle
  - result buttons, or a Game score picker in best-of-3
  - a Bye toggle that hides the Opponent and result fields
  - an Opponent combobox that searches as you type and offers "Create '…'" at the bottom
  - notes
- **After saving a Top cut Round**, the app offers the suggested Placement in one tap. A Top cut loss also offers to set the Placement.
- **Deleting a Tournament** uses the existing alert-dialog component, showing the Round count.
- **Dashboard filters** sit in a collapsible bar. Choosing a Season sets the date range, and editing the dates clears the Season. A partial-Season note appears whenever the 2026 Season is included.
- **UI text** uses glossary terms: "Round", never "Match".

## Testing Decisions

- **What makes a good test:** it exercises behaviour through a public interface (core's exported functions, or HTTP requests to the app) and checks outcomes a User would care about. It doesn't check internal structure, table layout or how the queries are built. A refactor that keeps behaviour must not break any test (ADR 13).
- **Seam A: `packages/core` with Vitest.** Covers:
  - the calendar: Regulation on a date, including the boundary days and dates before Champions; the current Regulation for a given today; the Season for a date, including the open-ended 2027 Season; the partial flag
  - Round rules: the Game score deciding the result; rejecting a Game score on best-of-1 and impossible scores; Bye rules; round number versus stage
  - Records: Swiss and Top cut kept apart, Byes counted
  - Placement suggestions
  - the dashboard summary, tested on hand-built sets of Tournaments: Byes left out of win rates, Ties as non-wins, Game win rate only from scored Rounds, the Top cut rate denominator, CP per Season and "No Season", fees per currency including Upcoming Tournaments, grouping by Team with the deleted-Team fallback, most-played Opponents, best Placements with tie-breaks, and an empty input
  - Prior art: the existing paste and Team tests in core.
- **Seam B: the Hono API through `app.request()` against PGlite with migrations applied.** Covers:
  - creating, listing, reading, updating and deleting each resource
  - another User's records returning 404 on every route
  - the default Regulation coming from the start date
  - validation errors
  - Team snapshot behaviour: frozen after the Team is edited, kept with a null source after the Team is deleted, re-snapshot refused after the end date, the Regulation mismatch warning
  - creating a Round with a new Opponent in one request
  - the next Swiss round number default
  - duplicate round numbers or stages refused
  - deleting an Opponent with Rounds refused with 409
  - deleting a Tournament deleting its Rounds but keeping Opponents
  - Opponent search matching Aliases
  - the dashboard endpoint applying each filter, resolving the current-Regulation default and refusing a Season sent with a date range. Detailed figures stay in Seam A; these tests check filtering and wiring.
  - Prior art: the existing Teams and team library API tests, and their test helpers for creating a test app and signing up.
- **Smoke test (Playwright, phone viewport):** extend the existing smoke test with one path: create a Tournament, log a Round against a newly created Opponent, and see the Record and the Round on the Tournament page.
- **No component tests** for the web app, as is the case today.

## Out of Scope
- Opponent Teams on Rounds, entered by choosing species (the next slice).
- Teamsheet export, and uploading teamsheet PDFs.
- Tracking individual Games (Pokémon brought, leads, per-Game results). Only the Game score is recorded.
- Merging duplicate Opponents.
- Calculating Championship Points from the official tables.
- Tournaments and CP from before Champions (Scarlet/Violet) in the 2026 Season.
- Singles. VGC Tournaments are doubles only.
- Divisions (Masters, Seniors, Juniors).
- Converting between currencies.
- Organizers as records of their own.
- Importing standings from RK9, Limitless or start.gg.
- Ladder and practice games.

## Further Notes
- ADR 16 means a new Regulation or Season needs a release. When the end of M-C (2026-12-01) and the next Regulation are announced, update the calendar data and cut a release.
- The Tournament glossary entry used to say the Record "can be overridden". The interview dropped that, and `CONTEXT.md` has been updated to match.
- Logging a Round is the screen that matters most for "phone first". Its tap count is the thing to protect.
- Suggested split into vertical-slice issues:
  1. the calendar in core and `GET /api/calendar`
  2. creating, listing, viewing and editing Tournaments
  3. linking a Team snapshot
  4. Rounds, with Opponents created on the spot
  5. the Opponents list and pages
  6. the dashboard
  7. the smoke test update
