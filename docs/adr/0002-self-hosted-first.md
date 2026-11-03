# 2. Ship self-hosted first, hosted later

Date: 2026-11-03
Status: Accepted

## Context
Both distributions are long-term goals, but one has to ship first. The project is solo with no deadline, and the goal is a vertical slice as soon as possible.

## Decision
Ship a self-hostable Docker release first. The hosted service comes later and adds billing, operations and object storage on top of the same code.

## Consequences
- The first release needs no billing.
- Data must still belong to an account from day one (each user gets a private space, see CONTEXT.md), so hosting many users later doesn't need a data-model rewrite.
