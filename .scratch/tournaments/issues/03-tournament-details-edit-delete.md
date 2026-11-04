# 03: Full Tournament details, edit and delete

**What to build:** A Tournament records everything else from the glossary: location, Organizer (with suggestions from past Tournaments), Entry fee (amount and currency, the currency defaulting to the last one used), Championship Points, player count, an optional external link, notes, Placement and Dropped. The User can edit any detail, and delete a Tournament after a confirmation that says how many Rounds will go with it.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The new fields are validated: Entry fee needs an amount and a currency together; CP is 0 or more; player count is 2 or more; Placement is 1 or more and no higher than the player count; the link is an http or https URL.
- [ ] `PATCH /api/tournaments/:id` updates any subset of fields; `DELETE /api/tournaments/:id` answers 204; both answer 404 for another User's Tournament.
- [ ] `GET /api/tournaments/organizers?q=` returns the User's distinct Organizers matching `q`.
- [ ] The Tournament page shows Placement as "9th of 128" when the player count is known, and shows Dropped.
- [ ] The form suggests Organizers and remembers the last currency.
