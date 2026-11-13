# 27. Storing uploaded Teamsheets

Date: 2026-11-09
Status: Accepted (DEV-37), amended by DEV-74 and DEV-71. Settles ADR 6's storage interface for uploads.

## Context
ADR 6 and ADR 10 promise that a User can upload their own Teamsheet PDF and keep it as a reference attachment, behind one storage interface: a disk volume for self-hosting and S3-compatible storage for the hosted service. Until now MyVGC kept nothing outside Postgres, so `pg_dump` backed up everything (ADR 15), and self-hosting needed no configuration beyond the database (ADR 24). Reading a Team from a stored Teamsheet (DEV-65) builds on this.

## Decision
- **A Tournament has at most one Teamsheet attachment.** Uploading again replaces it, and the User can delete it. It sits on the Tournament page; Teams have none.
- **Any PDF up to 5 MB is kept exactly as uploaded**, the same limit as reading one (ADR 24). It is checked by its `%PDF-` header, not by the type the browser claims. Whether MyVGC can read it doesn't matter: scans are worth keeping too. Nothing is cleared from it, Date of Birth included. That departs from ADR 20's "Date of Birth is never stored", which ADR 26 replaced by making Date of Birth a Player detail.
- **Files sit behind a `FileStorage` interface** in `apps/api`: put, get (a stream), delete and delete everything under a prefix. Deleting what's already gone counts as done. There are two drivers, disk and S3-compatible (DEV-71), chosen by configuration, with disk the default.
- **Keys are fresh per upload**, `teamsheets/<userId>/<uuid>.pdf`. A replace writes the new file, points the Tournament at it, then deletes the old one. The disk driver writes beside the file and renames, so a reader never sees half a file.
- **The Tournament row holds the key, file name, size and upload time**, all set or all empty, as it holds the Team snapshot (ADR 9). The Tournament view shows `teamsheet: { fileName, size, uploadedAt } | null`.
- **Files are served through Hono only**, behind the session check: `PUT`, `GET` and `DELETE` on `/api/tournaments/:id/teamsheet`. No public or presigned URLs, on any driver. `GET` sends `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox allow-scripts`, so a crafted file from our own origin can't run as a page with the User's session. The sandbox gives the file an opaque origin, so it can't reach the User's cookies or our API. It allows scripts because browsers' built-in PDF viewers need them and show a blank page under a bare `sandbox` (DEV-74). The stored file name drops folders, control characters and direction overrides, and is cut to 200 characters (never mid-character).
- **Clean-up is best effort.** Deleting the attachment or its Tournament deletes the file after the row; a failure is logged and leaves an unreachable file. There is no sweeper.
- **Online only** (ADR 17). The PDF is never put in the Query cache. A service worker added later must leave `/api/` out of its navigation fallback, or opening the PDF would show the app instead.
- **Not in the Data export** (ADR 23), nor its metadata, so the format doesn't change.
- **Disk configuration:** `UPLOADS_DIR`, default `.data/uploads` for development. The image sets `/data/uploads`, owned by `node`, and declares `VOLUME /data`; `compose.yaml` names it `uploads`. The server creates the folder on start-up and refuses to start if it can't write to it.
- **S3-compatible configuration (DEV-71):** setting `S3_BUCKET` keeps files in that bucket instead of `UPLOADS_DIR`, under the same keys. `S3_REGION` defaults to `us-east-1`; `S3_ENDPOINT` points at a provider other than AWS (R2, B2, MinIO and the like); `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` go together, and without them the AWS SDK finds credentials itself (`AWS_*` variables, an IAM role); `S3_FORCE_PATH_STYLE=true` puts the bucket in the path, which MinIO needs. `S3_ENDPOINT` or the keys without a bucket are refused as a likely mistake. The server checks the bucket answers (`HeadBucket`) on start-up and refuses to start if it doesn't, as it does for an unwritable folder. The driver uses `@aws-sdk/client-s3`, asks only for the checksums S3 requires (the SDK's newer defaults break several S3-compatible providers), and deletes a prefix one key at a time from a listing rather than with `DeleteObjects`, which some providers lack. The bucket stays private: files still stream through the API.

## Consequences
- `pg_dump` no longer backs up everything. The README backs up the `uploads` volume with `tar` as well. Installs upgrading with an old `compose.yaml` keep files in an unnamed volume that `docker compose down -v` deletes, so the release notes tell them to update it.
- Self-hosting still needs no configuration beyond the database.
- Account deletion doesn't exist yet. When it does, it must call `deletePrefix('teamsheets/<userId>/')`, since the database cascade can't reach files.
- An attachment may hold personal data (Player details, Date of Birth), as Player details do. The hosted service treats it so (DEV-41).
- With S3, backups are the bucket's business (versioning, replication), not the `uploads` volume's.
- A hosted-service storage quota was not built in DEV-71; whether one is needed is an open Decision issue (DEV-104).
