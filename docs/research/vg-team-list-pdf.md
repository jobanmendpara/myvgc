# The official Pokémon Video Game Team List PDF

Checked 2026-11-05 for MyVGC (DEV-30). This resolves open items 2 and 3 in `pokemon-champions-data.md`.

## Summary

- **It is the Champions sheet.** It asks for Stat Alignment and a Switch Profile Name, and it has no Tera Type or Level.
- **A program can fill it.** It is a plain AcroForm with 151 fields (no XFA, no JavaScript, not encrypted). pdf-lib 1.17.1 filled every field and both sets of check boxes, and the output rendered correctly in poppler.
- **The field names are meaningless** (`f0` to `f150`), so MyVGC has to keep its own map from each field to its meaning (below). If the PDF is reissued, the map has to be checked again.
- **The sheet asks for things MyVGC does not store**: player details on both pages, and six stat boxes for each Pokémon on the staff page. See "Questions for Teamsheet export".

## Source

- The [Play! Pokémon documents page (VGC filter)](https://play.pokemon.com/en-us/resources/documents/?filter=vgc) links "Pokémon Video Game Team List" to `https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-vg-team-list-2023.pdf`. The page was read directly on 2026-11-05. The file name still says 2023, but the content has been updated for Champions.
- `pokemon.com` (and `mcdn.pokemon.com`) still answered 403 from this environment, so the PDF was not downloaded from that URL. The copy inspected is the one attached to DEV-30 by the maintainer: `vg-team-list.pdf`, 364,503 bytes, SHA-256 `643bd4a0b1d42a077c85e3444d5e6ae541440ac134be47e371efada34115f4e5`. It is not committed to this repository.
- PDF 1.7, two US Letter pages (612 × 792 pt). Created 2026-05-27, last saved by pdf-lib. Its modification date is 2026-11-05, so the attached copy may have been saved again after download. Before relying on the hash, compare it with a fresh download.
- Inspected with pypdf 6.17 (field dump), poppler's `pdftotext` and `pdftoppm` (text and rendering) and pdf-lib 1.17.1 (filling).

## Layout

The **staff page** ("1 of 2: For Tournament Staff") is handed to event staff before the Tournament. The **opponents page** ("2 of 2: For Opponents") is kept by the player and shown to the other player in each Round. Both pages end with "All Pokémon must be listed exactly as they appear in the Battle Team."

Each page has a header and six Pokémon boxes in a 2 × 3 grid. Each box has Pokémon, Stat Alignment, Ability, Held Item and Move 1 to 4. Only the staff page boxes also have HP, Atk, Def, Sp. Atk, Sp. Def and Speed boxes.

This agrees with the handbook rule reported in `pokemon-champions-data.md` §3: opponents see everything except stats, and Stat Alignment is on the open list.

## Field map

Every field is a terminal field with one widget, and every field is blank: the header text fields hold an empty string and the others have no value. All text fields are single-line with no maximum length. The check boxes are separate check boxes (not a radio group) with the states `/Yes` and `/Off`.

### Header

| Label | Staff page | Opponents page |
|---|---|---|
| Player Name | `f0` | `f5` |
| Trainer Name in Game | `f1` | `f6` |
| Battle Team Number / Name | `f10` | `f11` |
| Switch Profile Name | `f12` | `f13` |
| Age Division: Juniors (check box) | `f2` | `f7` |
| Age Division: Seniors (check box) | `f3` | `f8` |
| Age Division: Masters (check box) | `f4` | `f9` |
| Player ID | `f14` | none |
| Date of Birth: month / day / year | `f15` / `f16` / `f17` | none |
| Support ID | `f18` | none |

The opponents page header uses its own fields, so both copies have to be filled.

### Pokémon boxes

Boxes are numbered left to right, then top to bottom. Each box has a first field number *n*. The fields in a box run on from it:

| Offset | Field |
|---|---|
| *n* + 0 | Pokémon |
| *n* + 1 | Stat Alignment |
| *n* + 2 | Ability |
| *n* + 3 | Held Item |
| *n* + 4 to *n* + 7 | Move 1 to Move 4 |
| *n* + 8 to *n* + 13 | HP, Atk, Def, Sp. Atk, Sp. Def, Speed (staff page only) |

| Box | Position | Staff page *n* | Opponents page *n* |
|---|---|---|---|
| 1 | top left | 19 | 33 |
| 2 | top right | 41 | 55 |
| 3 | middle left | 63 | 77 |
| 4 | middle right | 85 | 99 |
| 5 | bottom left | 107 | 121 |
| 6 | bottom right | 129 | 143 |

For example, box 2's Move 3 is `f47` on the staff page and `f61` on the opponents page, and box 6's Speed is `f142`. This map was checked by filling every field with a sample Team and reading the rendered pages.

## Filling it

- **pdf-lib works.** `PDFDocument.load`, `form.getTextField(name).setText(...)`, `form.getCheckBox(name).check()` and `save()` produced a correct PDF with no viewer warnings. pdf-lib draws the appearances itself, so viewers do not have to regenerate them.
- **Font sizes are set per field.** Every field has its own default appearance (`/DA`) in black Helvetica: 12 pt for Pokémon, 9 pt for Stat Alignment, 10 pt for Ability, Held Item, the moves and the header, and 8 pt for the stat boxes. pdf-lib uses these sizes when it draws the fields.
- **The font name does not resolve.** The field `/DA` strings name `/Helvetica`, but the form's resources (`/DR`) define only `/Helv`, and the AcroForm has no `/DA` of its own. pdf-lib copes with this. A tool that leaves drawing to the viewer (by setting `NeedAppearances`) relies on each viewer falling back to a font. Draw the appearances when saving.
- **The standard Helvetica font covers WinAnsi only.** "Flabébé" and "Mind's Eye" fill fine. "Nidoran♀" throws (`WinAnsi cannot encode "♀"`). Showdown names write the symbol as `Nidoran-F`, so this only matters if display names with symbols are used. Otherwise, embed a font with fontkit.
- **Flattening** (`form.flatten()`) removes the fields and keeps the text, but poppler then reports many "Invalid XRef entry" warnings. That is a known pdf-lib flattening problem. Leave the form unflattened unless a reason to flatten comes up.
- **Space.** The longest names tried (Ursaluna-Bloodmoon at 12 pt, Scorching Sands and Charizardite Y at 10 pt) fit at the form's own sizes. pdf-lib does not shrink text to fit unless asked.

## Questions for Teamsheet export (DEV-31)

These are not settled here. They belong to DEV-31. Any that need a decision become Linear issues labelled Decision, and the outcome is recorded as an ADR.

1. **Player details.** Player Name, Trainer Name in Game, Switch Profile Name, Age Division, Player ID, Date of Birth and Support ID are not stored anywhere in MyVGC. The export could leave them blank for the User to fill by hand, ask for them at export time, or store them on the User. Date of birth is personal data, which argues against storing it.
2. **Battle Team Number / Name.** This refers to the in-game Battle Team. A Team has a name, but no Battle Team number.
3. **The stat boxes.** The sheet does not say whether to write the Pokémon's stat values (as shown in game at level 50) or its Stat Points. A Pokémon build stores Stat Points, so writing stat values would mean working them out from base stats, Stat Points and Stat Alignment. Settled by ADR 19: stat values (DEV-50).
4. **Support ID.** The sheet does not explain this field. It is probably an ID from the game or from Play! Pokémon support. Check the handbook.
5. **Shipping the template.** The PDF belongs to The Pokémon Company International. MyVGC can bundle it in the repository and image, download it from the official URL when exporting, or ask the User to supply it. This touches the intellectual property risk in `docs/risks.md`, so it needs a decision. Tracked as DEV-49.
6. **Display names.** The sheet says Pokémon must be listed exactly as in the Battle Team, so the export should write in-game display names (from `@myvgc/core`'s data), not Showdown IDs.
