# 28. The Teamsheet font is DejaVu Sans

Date: 2026-11-09
Status: Accepted (DEV-31). Replaces ADR 25's choice of Noto Sans.

## Context
ADR 25 embeds the full Noto Sans in exported Teamsheets so text typed into the PDF later can use any character it covers, "♀" included. Noto Sans has no "♀" or "♂" glyph: Noto keeps symbols in separate fonts such as Noto Sans Symbols. MyVGC's own text never needs them, since Showdown's names write `Nidoran-F` and `Nidoran-M`, but a User changing a value in a PDF viewer could type them.

## Decision
- **Text fields use the full DejaVu Sans** (version 2.37), embedded once, not a subset. It covers Latin, Greek and Cyrillic, the curly apostrophe in Sirfetch’d, and "♀" and "♂".
- It is licensed under the Bitstream Vera Fonts licence, with DejaVu's changes in the public domain. The licence allows bundling and embedding; it is shipped in `apps/api/assets/fonts/` with a NOTICE.
- ADR 25's other decisions stand: auto font size, no JavaScript, teamsheet.gg's field layout.

## Consequences
- DejaVu Sans is about 760 KB against Noto Sans's 430 KB, so each exported PDF is about 330 KB larger.
- DejaVu Sans is wider than Calibri and Noto Sans, so long names shrink a little more under auto font size.
- DejaVu has had no release since 2016. It needs no updates for the characters a Teamsheet uses.
