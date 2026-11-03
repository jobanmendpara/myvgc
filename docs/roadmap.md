# Roadmap and principles

## Principles
- **Phone first.** Logging a Round at an event should take a few taps on a phone. Building and reviewing Teams must also work well on desktop.
- **English only for now.** Showdown IDs (ADR 14) leave room to translate later.
- **Self-hosting is a first-class option.** Every feature works in a self-hosted install. Hosted-only concerns (billing, payment provider, plans, usage limits) wait until after the self-hosted release and get their own design interview.

## Order of work
1. **Teams:** sign up and log in, import a Champions Showdown paste, save, list and view Teams (ADR 10).
2. **Teamsheet export:** generate the official Teamsheet from a Team. Blocked on checking the official format (see `docs/risks.md`).
3. **Tournaments:** Tournaments, Rounds, Opponents with Aliases, and Opponent Teams entered by choosing species.
4. **Team builder:** a form-based way to build and edit Teams.

## Later
- Recording individual Games: the four brought by each side, leads, and per-game results.
- Dated note entries on Opponents.
- Uploaded teamsheet PDFs as attachments, then reading uploaded PDFs and replica-team screenshots into Teams (OCR or an AI vision model).
- Exporting all of a User's data as JSON and importing it into another install, in either direction between hosted and self-hosted.
- Merging duplicate Opponents.
- The hosted service: billing and operations.
