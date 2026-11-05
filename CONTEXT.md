# MyVGC: domain context

MyVGC is a hub where a competitive player tracks their Pokémon VGC experience in the game **Pokémon Champions**: tournaments attended, the teams they brought, who they played, what those opponents brought, and notes on all of it. Teams can be exported to the official VGC teamsheet format.

## Glossary

- **VGC**: Video Game Championships, the official Pokémon competitive format. In Champions it is doubles: each player brings a Team of 6 and picks 4 of them for each Game.
- **Regulation**: the ruleset in force for a period, such as Reg M-C. It decides which Pokémon, items and mechanics are legal. Each Regulation has a start and end date; the **current Regulation** is the one in force today. A new Tournament defaults to the Regulation in force on its date.
- **Legal / illegal**: a Team is legal in a Regulation when it breaks none of that Regulation's rules (allowed Pokémon, abilities and items, moves the species can learn, banned categories, Species Clause, Item Clause), and illegal when it breaks at least one. An illegal Team can still be saved; MyVGC warns, it doesn't block. Only the User's own Teams are judged: a Team against its own Regulation, and a Tournament's Team snapshot against the Tournament's Regulation. Opponents' Teams never are. A Regulation MyVGC has no rules for (such as M-A) can't be judged: its Teams are neither legal nor illegal, just unchecked.
- **Season**: the Play! Pokémon competitive year, running from the day after one Worlds to the end of the next, for example the 2027 Season. Championship Points reset each Season. A Tournament belongs to the Season its start date falls in. Seasons and their dates come with the app; Users don't define them. In MyVGC the 2026 Season starts on Champions' release (2026-04-08), so it only holds the part of that Season played in Champions.
- **User**: someone with a MyVGC account. Each User has a private space; nothing is shared between Users.
- **Team**: up to six Pokémon builds. One type covers both the User's own teams (fully known) and teams seen from Opponents (often partly known). Everything except species is optional. An Opponent's Team is usually entered by choosing six species, then filling in what the open teamsheet shows.
- **Pokémon build**: one Pokémon on a Team. In Champions it has a species or form, ability, held item, up to four different moves, a Stat Alignment and Stat Points (0 to 32 per stat, 66 in total). Champions has no EVs, IVs to set, Tera or level to choose; level is always 50.
- **Stat Alignment**: what Champions calls a nature, such as Adamant: it raises one stat and lowers another. Showdown pastes call it Nature; MyVGC says Stat Alignment.
- **Opponent**: a private record a User keeps about someone they played. Opponents are not Users. An Opponent has a display name plus Aliases.
- **Alias**: another name an Opponent goes by, such as a legal name, screen name, Discord username or nickname. Opponent search matches display names and Aliases.
- **Tournament**: a competitive event the User took part in. It records a name, date(s), optional location, online or in person, an Event tier, a Regulation, an optional Organizer, an optional Entry fee, optional Championship Points gained, an optional player count, an optional external link (such as RK9 or Limitless), a default best-of (1 or 3) for its Rounds, a Placement, and whether the User Dropped. It has at most one Team snapshot of the User's Team, one Teamsheet, and is made up of Rounds. MyVGC only records play inside Tournaments; ladder and practice games are not tracked.
- **Record**: a Tournament's wins, losses and ties, always worked out from its Rounds and never entered by hand. Swiss and Top cut are shown separately (for example 6-2-0, then 0-1 in Top cut). A Bye counts as a win in the Record, but not in win rates or head-to-head records.
- **Top cut stage**: what a Top cut Round is called, by the number of players left: Top 64, Top 32, Top 16, Top 8, Top 4, Finals. Losing in a stage suggests the Placement (losing in Top 4 suggests 3rd).
- **Upcoming Tournament**: a Tournament whose start date is still in the future. It has no Rounds yet, but its Entry fee counts toward spending.
- **Head-to-head record**: the User's wins, losses and ties in Rounds against one Opponent, leaving out Byes.
- **Placement**: where the User finished in a Tournament (for example 9th of 128), entered by hand. Winning a Tournament means a Placement of 1st.
- **Dropped**: the User left a Tournament before it ended. A Dropped Tournament usually has no Placement.
- **Organizer**: who ran a Tournament, such as a local game store or community. Just a name, not a record of its own.
- **Entry fee**: what the User paid to enter a Tournament: an amount and a currency. Totals across different currencies are never converted into one another.
- **Championship Points (CP)**: the Play! Pokémon points a User earned at a Tournament, entered by hand. MyVGC does not calculate them. Because CP resets each Season, CP is only ever totalled within one Season.
- **Event tier**: the kind of Tournament, from a fixed list: Premier Challenge, Regional, International, Worlds, Grassroots, Online, Other.
- **Teamsheet**: the official Play! Pokémon team list for a Tournament. It can be generated in the app from a Team, or uploaded as a PDF.
- **Round**: one pairing in a Tournament. Never called "Match". It has a phase (Swiss or Top cut) and, within it, a round number (Swiss) or a Top cut stage, is best of 1 or best of 3 (defaulting to the Tournament's setting), and has a result, an Opponent and notes (for example leads). Every Round except a Bye has an Opponent.
- **Round result**: Win, Loss or Tie. Intentional draws and time-outs count as Ties.
- **Bye**: a Round with no Opponent, which counts as a win.
- **Game score**: how many Games each side won in a best-of-3 Round, such as 2-1. It is optional; when it is given, it decides the Round result.
- **Game**: a single battle within a Round. Tracking individual Games is planned, not in the first slice.
- **Team snapshot**: a frozen copy of a Team attached to a Tournament (the User's Team) or to a Round (the Opponent's Team). It links back to the original Team.
- **Notes**: one Markdown notes field on each Opponent, Team, Tournament and Round. An Opponent's page also shows the notes from every Round against them.
