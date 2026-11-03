# 06: Docker smoke test and image publishing

Blocked by: 05

## What to build
- A Playwright smoke test that starts the built image with Compose, signs up, imports a fixture paste and checks the Team page shows its six species.
- Run it in CI on pull requests and on `main`.
- A release workflow that, on a version tag (for example `v0.1.0`), builds the image and publishes it to GHCR as `ghcr.io/jobanmendpara/myvgc` with the version tag and `latest`.
- README: how to self-host with Compose, the environment variables, and how to back up with `pg_dump`.

## Acceptance criteria
- [ ] The smoke test passes in CI against the built image.
- [ ] Pushing a version tag publishes the image to GHCR with both tags.
- [ ] Following the README on a clean machine gives a working install.
