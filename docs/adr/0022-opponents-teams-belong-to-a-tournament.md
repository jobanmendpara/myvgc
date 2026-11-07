# 22. Opponent's Teams belong to a Tournament and are not snapshots

Date: 2026-11-06 (amended 2026-11-06 for how they are stored, written and merged, DEV-55)
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

### How it is stored, written and merged (DEV-55)
- **Storage.** An `opponent_team` table: the Tournament (deleted with it), the Opponent (restrict), and its Pokémon as a jsonb list of Pokémon builds, unique per Tournament and Opponent.
- **What the server checks.** One to six builds with different species (each form counts as its own species). Species, ability, held item and up to four different moves must exist in Champions. Learnsets, whether the ability is the species' own, and legality are not checked.
- **The write.** The Round input takes an optional `opponentTeam`. Left out, the Opponent's Team is unchanged; a list replaces it whole; an empty list deletes it. Sending one on a Bye, or with no Opponent, is a validation issue on that field. A replayed write simply replaces it again: the last write wins.
- **Picks from Games** are added to the Opponent's Team by the Round form, before it sends the write. The server never adds species to it from the Games.
- **Removal.** Any Round write or delete that leaves no Round against that Opponent in the Tournament deletes their Opponent's Team in the same transaction. The client warns from its cache before sending; the server never asks, because a queued replay can't answer.
- **Reading.** Each Tournament (in the list and alone) carries its Opponent's Teams, and a saved Round answers with its Opponent's Team. The copy offer reads the cached Tournaments list, so it works offline: the latest other Tournament in the same Regulation by start date.
- **Merging** Opponents who both have an Opponent's Team in one Tournament keeps the survivor's builds first, adds the duplicate's species the survivor lacks, up to six, and fills the survivor's empty ability, held item and moves for a species both have from the duplicate's.
- **Data export** carries each Tournament's Opponent's Teams, with their ids and timestamps (ADR 23); importing adds one only where the account has none for that Tournament and Opponent, and a Round there is against that Opponent.

## Consequences
- ADR 9 now covers only the User's Team on a Tournament.
- Merging Opponents (DEV-36) must merge Opponent's Teams held in the same Tournament.
- Statistics by species are left to a follow-up issue.
- An Opponent's page doesn't show their Opponent's Teams yet; that is DEV-59.
