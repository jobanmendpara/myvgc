# 6. Teamsheets are generated from Teams; image uploads are deferred

Date: 2026-11-03
Status: Accepted. Storage for uploaded Teamsheets is settled in ADR 27.

## Context
Each Tournament has a Teamsheet. A user may create it in the app or upload their own PDF. Later, users should be able to upload screenshots of replica teams and have the app read the team out of them (OCR or an AI vision model).

## Decision
- Teamsheets the app creates are generated on demand from a Team and are not stored.
- Image storage is out of scope for now.
- Uploaded teamsheet PDFs are first stored as reference attachments only. Later they are read into a Team through the same pipeline as replica-team screenshots (see ADR 10).

## Consequences
File storage is not on the critical path for the first slice. When uploads arrive, they go behind a single storage interface: a disk volume for self-hosting, and S3-compatible storage for the hosted service.
