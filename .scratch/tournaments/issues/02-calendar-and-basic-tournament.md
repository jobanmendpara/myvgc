# 02: Calendar and a basic Tournament

**What to build:** The Season and Regulation dates ship in core (ADR 16) and the API serves them. A User can create, list and view a Tournament with a name, start and optional end date, Event tier, online or in person, Regulation and default best-of. The Regulation defaults to the one in force on the start date. Tournaments starting in the future show as Upcoming.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Core answers which Regulation is in force on a date, which is current for a given today, which Season a date falls in and whether that Season is partial. Unit tests cover the boundary days, dates before Champions and the open-ended 2027 Season.
- [ ] `GET /api/calendar` returns the Regulations and Seasons with their dates and which Regulation is current.
- [ ] `POST /api/tournaments` creates a Tournament; a missing Regulation is taken from the start date; an end date before the start date is a 400.
- [ ] `GET /api/tournaments` lists only the User's Tournaments, newest start date first, each marked Upcoming or not; `GET /api/tournaments/:id` returns 404 for another User's Tournament.
- [ ] The Tournaments list, New Tournament and Tournament pages work at 375 px wide.
