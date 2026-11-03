# 06: Docker smoke test and image publishing

Blocked by: 05

## What to build
- A Playwright smoke test that starts the built image with Compose, signs up, imports a fixture paste and checks the Team page shows its six species.
- Run it in CI on pull requests and on `main`.
- A release workflow that, on a version tag (for example `v0.1.0`), builds the image and publishes it to GHCR as `ghcr.io/jobanmendpara/myvgc` with the version tag and `latest`.
- README: how to self-host with Compose, the environment variables, and how to back up with `pg_dump`.

## Acceptance criteria
- [x] The smoke test passes in CI against the built image.
- [ ] Pushing a version tag publishes the image to GHCR with both tags.
  - Not run yet: it needs a real version tag, which should be pushed from `main` once this slice is merged.
- [x] Following the README on a clean machine gives a working install.

## Notes
- `compose.yaml` now runs the published image `ghcr.io/jobanmendpara/myvgc:${MYVGC_VERSION:-latest}`; `compose.build.yaml` adds `build: .` for CI and for running unreleased code (`pnpm up:local`).
- `.github/workflows/smoke.yml` is reusable: it builds the image, starts Compose with `--wait` (the image's health check), and runs `e2e/tests/smoke.spec.ts` at 375 px. `ci.yml` runs it on every push and pull request (a superset of "pull requests and main", so a branch shows it passing before merge). `release.yml` runs it before publishing.
- `release.yml` publishes for `linux/amd64` and `linux/arm64` (for home servers such as a Raspberry Pi). `latest` only moves for full releases, not pre-releases such as `v0.2.0-rc.1`.
- GHCR makes a new package private. After the first release, make it public (the package's settings on GitHub) so self-hosters can pull it without logging in.
- The README was rehearsed in a fresh folder holding only `compose.yaml` and `.env` (the published image stood in by a local build): install, first sign-up, smoke test, and `pg_dump` backup and `pg_restore` after deleting all data.
- The README asks for a letters-and-digits `POSTGRES_PASSWORD`, because Compose puts it into a connection URL.
