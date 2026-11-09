# 25. Teamsheet export fills form fields

Date: 2026-11-09
Status: Accepted (DEV-31). Replaces ADR 18's decision to draw text at measured coordinates, and ADR 20's subset font. The choice of Noto Sans is replaced by ADR 28 (DejaVu Sans).

## Context
ADR 18 bundles TPCi's flat team list PDF and has export draw text on it at measured coordinates. A drawn sheet can't be changed after download: a typo, a late item swap or the Date of Birth box means exporting again or writing by hand. Players already use teamsheet.gg, whose download adds 151 form fields (`f0` to `f150`) to the same template, and MyVGC reads that layout (ADR 24, DEV-62). A fixture of it is in `packages/core/test/fixtures/teamsheet-gg-filled.pdf`.

## Decision
- **Export adds form fields to the bundled template and fills them.** The User can change any value in an ordinary PDF viewer before printing or submitting. Fields are not locked or flattened. There is one export; MyVGC makes no flat version.
- **The fields copy teamsheet.gg's:** the same names (`f0` to `f150`), the same rectangles (measured from the fixture) and the same kinds (text fields, and three separate Age Division check boxes on each page). The staff and opponents pages keep separate fields, so a change in the PDF is made on both. In return, `readTeamsheet()` reads MyVGC's own exports with no new code.
- **Font:** text fields use the full Noto Sans (OFL), embedded once, not a subset, so text typed into the PDF can use any character it covers, "♀" included. Text fields use auto font size, so the viewer shrinks text to fit as it is typed.
- **No JavaScript.** Changing a value in the PDF recalculates nothing and checks nothing. MyVGC stays where Teams are checked, and edits come back only by reading the PDF in again (ADR 24).
- **Date of Birth** fields are filled from Player details (ADR 26), and stay empty when there is none.
- ADR 18's other decisions stand: the bundled template, its SHA-256 check, no override, and watching for reissues. ADR 20 stands apart from its font and Date of Birth.

## Consequences
- The PDF is a few hundred KB larger for the full font.
- If teamsheet.gg changes its field names, MyVGC's exports keep the old ones; both are still read as long as the reader knows them.
- DEV-66 (read MyVGC's own export back) becomes a round-trip test instead of a coordinate-based reader.
- A reissued template needs new field rectangles as well as a new hash.
