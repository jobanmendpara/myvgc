# 22. Opponent's Teams belong to a Tournament and are not snapshots

Date: 2026-11-06
Status: Accepted (DEV-32). Supersedes the part of ADR 9 about an Opponent's Team on a Round.

## Context
ADR 9 said an Opponent's Team on a Round would be a Team snapshot linking back to an original Team, like the User's Team on a Tournament. But an Opponent's Team has no original: nobody edits it between events, and saving it as one of the User's Teams would fill the Teams list with other people's Teams. A Team is also locked for a whole Tournament, so the same Opponent met twice (in Swiss and again in Top cut) brought the same six both times.

## Decision
- **One Opponent's Team per Opponent per Tournament**, stored with the Tournament and shared by every Round against that Opponent there. It is not a Team record and not a snapshot, so it never appears in the Teams list and links to nothing.
- **It only exists for an Opponent the User played in that Tournament.** Deleting the last Round against them, or changing that Round to another Opponent, deletes their Opponent's Team after a warning, and clears the Opponent's side of that Round's Games. Scouting Teams you didn't play is out of scope.
- **It holds what an open teamsheet shows**: species, ability, held item and moves, from one to six species. It is stored in the Pokémon build shape, so more fields can be offered later. It is never judged for legality (ADR 18).
- **Reuse is by copy.** When an Opponent has no Opponent's Team in this Tournament, the Round form offers to copy their most recent one from a Tournament in the same Regulation, with no link back.
- **It feeds the Games picker** (ADR 21) for the Opponent's side. Picking a Brought Pokémon the Opponent's Team doesn't have yet adds it to that Team, up to six. The User's Team snapshot is never changed this way.
- **One Round write** carries the Opponent's Team along with the Round and its Games, so the outbox from ADR 17 queues a Round logged offline the same way as any other write. The server's version wins.

## Consequences
- ADR 9 now covers only the User's Team on a Tournament.
- Merging Opponents (DEV-36) must merge Opponent's Teams held in the same Tournament.
- Statistics by species are left to a follow-up issue.
