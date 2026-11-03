# 1. AGPL open source with a paid hosted service

Date: 2026-11-03
Status: Accepted

## Context
MyVGC will be offered both as a paid hosted service and as a self-hostable app. The license decides whether self-hosting is free and what protects the hosted business.

## Decision
License the code under AGPL-3.0. Self-hosting is free; revenue comes from the convenience of the hosted service. There is one edition of the code: no license keys and no paid-only features in self-hosted installs.

## Consequences
- No license-key or feature-flag system per edition.
- A third party running a modified hosted copy must publish its changes.
- Self-hosting does not bring in revenue directly.
