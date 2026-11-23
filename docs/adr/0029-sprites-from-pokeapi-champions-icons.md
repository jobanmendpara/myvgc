# 29. Sprites come from PokeAPI's Champions icons

Date: 2026-11-23 (amended 2026-11-23 for the gap a missing Sprite leaves, DEV-178; amended 2026-11-23 for the measured size, DEV-182)
Status: Accepted

## Context
v0.3.0 shows a Sprite next to every species (map DEV-168). Until now `docs/risks.md` allowed no official art. The research in `docs/research/sprite-sources.md` (on the branch `research/sprite-sources`, DEV-169) compared the sources. All of them are art owned by The Pokémon Company, and none comes with a licence that clears it.
- Showdown's small `gen5` set is keyed by the Showdown IDs MyVGC stores (ADR 14) and is about 0.6 MB. But 11 Champions Megas have no static Sprite in any Showdown set. Its Sprites for Pokémon after Gen 5 are community art whose authors ask to be contacted before anyone uses them.
- PokeAPI's Champions icons (`sprites/pokemon/versions/generation-ix/champions/icons/`, 128 px PNG) cover all 382 species and forms in Champions in one style. The repository is CC0, says the images belong to The Pokémon Company, and invites copying. Files are named by PokeAPI's numeric IDs, so MyVGC needs its own table.

## Decision
- **Source.** PokeAPI's Champions icons only, from a pinned commit of `PokeAPI/sprites`. No Showdown Sprites, so the two styles never mix.
- **The table.** `packages/core` holds a table from each Champions species or form's Showdown ID to its PokeAPI file, about 392 rows, most of them generated and about 25 written by hand. Every Alcremie uses the Strawberry Sweet icon for its cream, because Showdown doesn't record the sweet. The 10 battle-only forms that `packages/core` accepts but Champions lacks (DEV-173) get no row.
- **Committed files.** A script, `pnpm sprites:update`, reads the table, downloads the icons from the pinned commit, converts them to 96 × 96 WebP and writes them to `apps/web/public/sprites/<showdown-id>.webp`. The output is committed, with a NOTICE saying the images belong to The Pokémon Company and are not covered by the AGPL (ADR 1). Building the image and running the app never fetch Sprites, so a self-hosted install with no internet access has every one.
- **Served from MyVGC's own origin.** The files are part of the generated web app, so Hono serves them like the rest of the web app's files. The browser never asks a third party for a Sprite.
- **No mapping in the web app.** The web app builds a Sprite's URL from the species ID it already has, and still imports only `@myvgc/core/schema` (ADR 17). A Sprite is shown at 48 CSS px or smaller. If there is no file, or it fails to load, a gap of the Sprite's size keeps rows aligned and the name shows as usual.
- **Offline.** The service worker precaches every Sprite with the app shell (ADR 17), so all of them show offline from the first launch, even on an iPhone's Home Screen app, which starts with empty storage.
- **Upkeep.** A Vitest test in `packages/core` fails when a Champions species or form has no row in the table or no file. A `@pkmn/mods` bump that adds a form therefore needs a new row and a rerun of the script. Until then, its Sprite shows as a gap beside the name.
- **Disclaimer.** The Settings page has a footer reading "Pokémon and Pokémon images are © Nintendo, Creatures, GAME FREAK and The Pokémon Company. MyVGC is not affiliated with them." and "Sprites from PokeAPI". The README carries the same line.

## Consequences
- `docs/risks.md` changes from "no official art" to Sprites only: small game icons from PokeAPI under fan-use tolerance, with no logos and no other official art. Formal legal review is still due before taking payments.
- MyVGC redistributes The Pokémon Company's images in a public repository and a public image, as it already does with the team list PDF (ADR 18). Git history and old image tags keep them even if they are removed later.
- The repository and the image grow by the Sprite files: 382 files at 96 × 96, WebP quality 80, totalling 1,373,174 bytes (1.31 MiB, about 3.6 KB each), measured when the script first ran (DEV-177). This is above the first estimate of well under 1 MB. The maintainer accepted the measured size on 2026-11-23 (DEV-182).
- Precaching every Sprite (DEV-179) grew the service worker's precache from 875.72 KiB to 2216.71 KiB. Each device downloads about 1.3 MB more on its first launch with a connection, all at once on an iPhone Home Screen install.
- The table is MyVGC's to maintain. New forms in a Regulation show a gap beside the name until someone adds a row, and the failing test makes sure someone notices.
