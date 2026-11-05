# 18. Warn about illegal Teams; never block saving

Date: 2026-11-05 (amended 2026-11-05 with details settled while building it, DEV-53, and for learnsets, DEV-54)
Status: Accepted (DEV-42)

## Context
ADR 10 left legality checks out ("not planned yet"), and ADR 14 left them unchecked. Users want to know when a Team breaks its Regulation's rules. Blocking the save would stop them from recording a Team they actually brought, a Team they're still building, or an old Team after its Regulation's rules change. Showdown's Champions data (ADR 12) has per-Regulation rules: the `champions` mod always holds the latest Regulation (M-C today) and older ones get their own mod (`championsregmb` for M-B). There is no mod for M-A.

## Decision
- **Warn, never block.** A Team that is illegal in its Regulation (glossary) can still be saved, from a paste or from the Team builder.
- **Rules checked:** species or form allowed in the Regulation, an ability the species can have, an item allowed in the Regulation, banned categories (such as Mythical and Restricted Legendary Pokémon), Species Clause, Item Clause, and moves the species can learn (DEV-54).
- **Against which Regulation:** a Team against its own Regulation; a Tournament's Team snapshot against the Tournament's Regulation. Opponents' Teams are never judged.
- **Malformed versus illegal.** ADR 14 still rejects a name that isn't in *any* Champions Regulation. A name that is in Champions but not allowed in this Regulation is a warning, not an error. So a later Regulation dropping a Pokémon never makes an older Team fail to save.
- **Worked out, not stored.** The API judges a Team each time it returns it, so a data update corrects old Teams. A check endpoint judges unsaved Pokémon builds so the Team builder can warn while the User edits (the web app can't load the data, ADR 17). The logic lives in `packages/core`.
- **Each Regulation names its rules.** `packages/core` maps every Regulation to the Showdown mod that holds its rules, or marks it unchecked (M-A). A test fails if a Regulation in `REGULATIONS` isn't in the map. A Team in an unchecked Regulation is shown as "Not checked", never as legal.
- **Where it shows:** a badge in the Teams list ("Illegal in M-C" or "Not checked"; nothing for a legal Team), each problem next to its Pokémon build on the Team page, live in the Team builder with a note by Save, and next to the Team snapshot on a Tournament.
- **Details of the rules (DEV-53):** the banned categories are the species tags Mythical and Restricted Legendary (Sub-Legendary is allowed), hard-coded next to the rules rather than read from each mod. Species Clause counts forms with the same Pokédex number, such as Rotom-Wash and Rotom-Heat, as one species. A battle-only form, such as a Mega, may have its own ability or its base form's, as Showdown judges it by its base form; whether it holds its Mega Stone isn't checked.
- **Names from any Regulation (DEV-53):** name look-ups (pickers, pastes and the Team builder's check) search every mapped mod, latest first, so ADR 14 only rejects a name that is in none.
- **Learnsets (DEV-54):** a move the species can't learn in the Regulation is a problem next to that move. The learnsets come from the same mods, so they add nothing to the bundle the API already loads (about 27 KB gzipped of the 900 KB) and only a few MB of memory, read in place rather than copied. An older Regulation's mod holds only the learnsets it changes (Archaludon in M-B) and inherits the rest from `champions`. A Mega, other battle-only form or cosmetic form (such as a Vivillon pattern) has no learnset of its own and learns what the form it comes from learns. A species the data has no learnset for isn't judged on its moves.
- **The check endpoint (DEV-53):** `POST /api/teams/check` takes a Regulation and each slot's species, item, ability and moves; a slot with no species yet is skipped. The Team builder calls it as the User edits, and also says when the Team's Regulation is unchecked. The badge appears on the Team page and on a Tournament's Team snapshot too, naming the Regulation it was judged against.

## Consequences
- Bumping `@pkmn/mods` needs care: when a new Regulation arrives, `champions` silently moves to it, so the map must be updated in the same release (ADR 16 already makes a new Regulation a release). So must the banned categories, if the new Regulation changes them.
- Supersedes ADR 10's "Legality checks against a Regulation (not planned yet)" and ADR 14's last bullet.
