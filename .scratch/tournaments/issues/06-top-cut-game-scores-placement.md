# 06: Top cut Rounds, Game scores and Placement suggestions

**What to build:** A User logs Top cut Rounds by stage (Top 64 to Finals). In a best-of-3 Round they can enter the Game score, which decides the result. The Tournament shows its Top cut Record separately from Swiss. After a Top cut Round, the app offers the suggested Placement in one tap.

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] Core: a Game score decides the Round result; a Game score on a best-of-1 Round, or an impossible score, is refused; a Top cut Round has a stage and no round number; the Placement suggestion matches the spec (losing in Top 4 suggests 3rd, and so on).
- [ ] Each Top cut stage can be logged only once per Tournament.
- [ ] Saving a Top cut Round returns the suggested Placement; the page offers to apply it.
