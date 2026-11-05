# 18. Warn about illegal Teams; never block saving

Date: 2026-11-05
Status: Accepted (DEV-42)

## Context
ADR 10 left legality checks out ("not planned yet"), and ADR 14 left them unchecked. Users want to know when a Team breaks its Regulation's rules. Blocking the save would stop them from recording a Team they actually brought, a Team they're still building, or an old Team after its Regulation's rules change. Showdown's Champions data (ADR 12) has per-Regulation rules: the `champions` mod always holds the latest Regulation (M-C today) and older ones get their own mod (`championsregmb` for M-B). There is no mod for M-A.

## Decision
- **Warn, never block.** A Team that is illegal in its Regulation (glossary) can still be saved, from a paste or from the Team builder.
- **Rules checked:** species or form allowed in the Regulation, an ability the species can have, an item allowed in the Regulation, banned categories (such as Mythical and Restricted Legendary Pokémon), Species Clause and Item Clause. Learnsets aren't checked yet.
- **Against which Regulation:** a Team against its own Regulation; a Tournament's Team snapshot against the Tournament's Regulation. Opponents' Teams are never judged.
- **Malformed versus illegal.** ADR 14 still rejects a name that isn't in *any* Champions Regulation. A name that is in Champions but not allowed in this Regulation is a warning, not an error. So a later Regulation dropping a Pokémon never makes an older Team fail to save.
- **Worked out, not stored.** The API judges a Team each time it returns it, so a data update corrects old Teams. A check endpoint judges unsaved Pokémon builds so the Team builder can warn while the User edits (the web app can't load the data, ADR 17). The logic lives in `packages/core`.
- **Each Regulation names its rules.** `packages/core` maps every Regulation to the Showdown mod that holds its rules, or marks it unchecked (M-A). A test fails if a Regulation in `REGULATIONS` isn't in the map. A Team in an unchecked Regulation is shown as "Not checked", never as legal.
- **Where it shows:** a badge in the Teams list ("Illegal in M-C" or "Not checked"; nothing for a legal Team), each problem next to its Pokémon build on the Team page, live in the Team builder with a note by Save, and next to the Team snapshot on a Tournament.

## Consequences
- Bumping `@pkmn/mods` needs care: when a new Regulation arrives, `champions` silently moves to it, so the map must be updated in the same release (ADR 16 already makes a new Regulation a release).
- Checking learnsets (whether a species can learn a move) is a follow-up, since it needs much more data.
- Supersedes ADR 10's "Legality checks against a Regulation (not planned yet)" and ADR 14's last bullet.
