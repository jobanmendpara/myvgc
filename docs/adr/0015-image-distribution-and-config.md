# 15. Distributing the Docker image and configuring it

Date: 2026-11-03
Status: Accepted

## Decision
- GitHub Actions builds the image and publishes it to GHCR (GitHub's container registry), tagged with version numbers (for example `1.2.0`) and `latest`.
- Database migrations run automatically when the app starts.
- All configuration comes from environment variables, documented in `.env.example`.
- Self-hosters back up their data with `pg_dump`. The README documents how.

## Consequences
Upgrading a self-hosted install means pulling the new image and restarting it.
