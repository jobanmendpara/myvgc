# 24. Reading Teams from files

Date: 2026-11-07
Status: Accepted (DEV-38, first built in DEV-62)

## Context
ADR 6 and ADR 10 promise a "file in, Team out" pipeline for uploaded Teamsheet PDFs and screenshots of Replica Teams, but left open how files are read. The files differ a lot. A Teamsheet filled in on teamsheet.gg keeps its 151 form fields (`f0` to `f150`, `docs/research/vg-team-list-pdf.md`), so it can be read exactly, with no OCR. Scans, photos and in-game screenshots can't. Self-hosted installs come first (ADR 2) and need no configuration beyond the database (ADR 15).

## Decision
- **Reading a Team makes a draft, never a saved Team.** The draft opens in the Team builder (later, the Opponent's Team form) for the User to review and save. What the reader isn't sure of is flagged on that Pokémon build, in its slot and its editor, so the flag follows it when the Team is reordered. On save the draft passes the same checks as any other Team (ADR 14).
- **Reading is stateless.** The file is read and discarded: never stored, never logged. Only reading a Teamsheet already stored as an attachment (ADR 6, DEV-37) depends on storage.
- **Online only** (ADR 17). The control is disabled while offline.
- **Digital PDFs first, read in core.** `packages/core` reads teamsheet.gg's form fields with pdf-lib and does no I/O. It prefers the staff page, which has stats, and falls back to the opponents page. "Battle Team Number / Name" becomes the Team's name. Player details on the sheet are ignored and never written into Account settings. A PDF without that layout is refused as not a recognised Teamsheet. Other producers (RK9, MyVGC's own export) are added once a sample is in hand.
- **Names become Showdown IDs through the Champions data.** A name that doesn't match leaves the field blank, with a flag giving the text that was read, rather than refusing the whole file.
- **Stat values become Stat Points by working ADR 19's formula backwards** with the species' base stats and the Stat Alignment. On a lowered stat, rounding down often lets two Stat Points values give the same stat value (Kingambit's Adamant SpA is 72 with 0 or 1). They make the same Pokémon, so the smallest is used without a flag; flagging would mark almost every Team read. A stat value no Stat Points can give gets 0 and a flag. Blank stat boxes leave Stat Points at 0.
- **Images will use an AI vision model, opt-in.** Screenshots and photos (1 to 6 images, PNG, JPEG or WebP, up to 10 MB each) are read by Anthropic's API behind a small reader interface in `apps/api`, configured by `ANTHROPIC_API_KEY` and an optional `TEAM_READER_MODEL`, with an optional per-User `TEAM_READER_DAILY_LIMIT` (unlimited when unset). With no key the image upload is hidden. The upload says the image is sent to Anthropic and not kept. No local OCR: it reads game UI poorly. Built in DEV-63.
- **Words:** code and UI say *read* and *reader*. *Import* stays reserved for pastes and the Data export (ADR 23).

## Consequences
- teamsheet.gg PDFs work on every install with no configuration, and the reader is unit-tested against a real teamsheet.gg file (with its Player details replaced).
- Image reading costs money per read and sends files to a third party, so it stays off unless an operator turns it on. The hosted service sets the daily limit.
- teamsheet.gg's field names are meaningless and could change. A changed layout is refused, not misread, and the fixture is replaced from a fresh download.
