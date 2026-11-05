# 18. Bundle the official team list PDF

Date: 2026-11-05
Status: Accepted

## Context
Teamsheet export (DEV-31) fills the official Pokémon Video Game Team List PDF, which belongs to The Pokémon Company International. MyVGC needs the blank template from somewhere. The options were to bundle it, download it from the official URL at export time, ask the User to supply it, or draw a look-alike sheet (DEV-49).

The official file is flat: it has no form fields. It is at `https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-vg-team-list.pdf`, 247,672 bytes, SHA-256 `4c0bb4ebe74d22edce3dd48d87f8009e0fb2121e43fd2c8cc7c0e01fedad9b56`, created 2026-05-27. Checked on 2026-11-05, it is byte for byte the same as the blank template teamsheet.gg serves. The copy with 151 fields (`f0` to `f150`) that `docs/research/vg-team-list-pdf.md` describes is teamsheet.gg's generated output, not TPCi's file. Browser PDF viewers save their own copy on download, so a copy's hash must come from the raw file.

## Decision
- **Bundle it.** The official file is committed at `apps/api/assets/team-list/play-pokemon-vg-team-list.pdf` and copied into the Docker image. A NOTICE next to it says it belongs to The Pokémon Company International and is not covered by the AGPL (ADR 1). MyVGC never fetches it from teamsheet.gg or `pokemon.com` at export time.
- **Logic in core, file in the API.** `packages/core` holds the template's SHA-256, a coordinate map (where each value goes and at what font size), and a function that takes the template bytes and draws the text with pdf-lib. It does no I/O. Hono reads the file and generates the export, so export is online-only (ADR 17).
- **Check the fingerprint.** A test checks the committed file against the hash. At runtime, export refuses to run with a clear error if the template's hash doesn't match, rather than drawing on the wrong layout.
- **No override.** There is no setting to point at another template. A reissued PDF ships as a new release with a new hash and map.
- **Watch for reissues.** At the start of each Regulation (ADR 16), download the file from the official URL and compare its hash. The URL answers scripted requests, so this check can be automated later.

## Consequences
- Export works offline from TPCi's servers and gives the same result every time, on self-hosted and hosted installs alike.
- MyVGC redistributes TPCi's file in a public repository and a public image. Git history and old image tags keep it even if it is removed later. This is part of the intellectual property risk in `docs/risks.md`.
- **Fallback:** if TPCi objects, or the review before taking payments (DEV-41) finds bundling unacceptable, the User supplies the template instead, checked against the same hash. Only where the bytes come from changes; the coordinate map and drawing code stay.
- DEV-31 draws text at measured coordinates instead of filling form fields, and picks a font that covers display names such as "Nidoran♀".
