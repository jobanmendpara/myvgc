# MyVGC: domain context

MyVGC is a hub where a competitive player tracks their Pokémon VGC experience in the game **Pokémon Champions**: tournaments attended, the teams they brought, who they played, what those opponents brought, and notes on all of it. Teams can be exported to the official VGC teamsheet format.

## Glossary

- **VGC**: Video Game Championships, the official Pokémon competitive format. In Champions it is doubles: each player brings a Team of 6 and picks 4 of them for each Game.
- **Regulation**: the ruleset in force for a period, such as Reg M-C. It decides which Pokémon, items and mechanics are legal.
- **User**: someone with a MyVGC account. Each User has a private space; nothing is shared between Users.
- **Team**: up to six Pokémon builds. One type covers both the User's own teams (fully known) and teams seen from Opponents (often partly known). Everything except species is optional. An Opponent's Team is usually entered by choosing six species, then filling in what the open teamsheet shows.
- **Pokémon build**: one Pokémon on a Team. In Champions it has a species or form, ability, held item, up to four moves, a nature (called Stat Alignment in Champions) and Stat Points (0 to 32 per stat, 66 in total). Champions has no EVs, IVs to set, Tera or level to choose; level is always 50.
- **Opponent**: a private record a User keeps about someone they played. Opponents are not Users. An Opponent has a display name plus Aliases.
- **Alias**: another name an Opponent goes by, such as a legal name, screen name, Discord username or nickname. Opponent search matches display names and Aliases.
- **Tournament**: a competitive event the User took part in. It records a name, date(s), optional location, online or in person, an Event tier, a Regulation, a default best-of (1 or 3) for its Rounds, and an optional final placement or record (worked out from Rounds, and can be overridden). It has one Teamsheet and is made up of Rounds. MyVGC only records play inside Tournaments; ladder and practice games are not tracked.
- **Event tier**: the kind of Tournament, from a fixed list: Premier Challenge, Regional, International, Worlds, Grassroots, Online, Other.
- **Teamsheet**: the official Play! Pokémon team list for a Tournament. It can be generated in the app from a Team, or uploaded as a PDF.
- **Round**: one pairing against one Opponent in a Tournament. Never called "Match". It has a phase (Swiss or Top cut) and a round number, and is best of 1 or best of 3 (defaulting to the Tournament's setting), and the User records the result, the Opponent and notes (for example leads).
- **Game**: a single battle within a Round. Tracking individual Games is planned, not in the first slice.
- **Team snapshot**: a frozen copy of a Team attached to a Tournament (the User's Team) or to a Round (the Opponent's Team). It links back to the original Team.
- **Notes**: one Markdown notes field on each Opponent, Team, Tournament and Round. An Opponent's page also shows the notes from every Round against them.
