# 0003 — License and Governance

## Decision

**Apache-2.0** for the open-source core.

## Why Apache-2.0 instead of MIT

MIT is shorter and maximally permissive. Apache-2.0 adds:

- an explicit patent grant
- a trademark clause (it does not grant trademark rights)
- notice and change-marking requirements

For an AI developer tool that wants enterprise adoption and a later commercial layer, those are useful defaults. The cost is a slightly longer license and a NOTICE file.

If the goal changes to maximum adoption with minimum friction, MIT remains a valid choice. Do not use AGPL, SSPL, or BUSL for an influence-first project; they suppress adoption and make the commercial story harder to explain.

## Trademark

The code license does not grant rights to the OpenContinue name or logo. Keep a separate trademark policy before accepting substantial outside contributions.

OpenContinue is not affiliated with Continue Dev or OpenCode. Do not use their logos or imply endorsement.

## Contributions

Use the Developer Certificate of Origin (DCO) 1.1. It is lighter than a CLA and keeps contributor friction low.

Revisit a CLA only if the project needs to relicense contributions for a dual-license commercial edition. If that day comes, announce it before accepting the contributions that would be affected.

## Commercial boundary

Free and open:

- CLI, TUI, local server
- local checks and the check format
- MCP, providers, SDK

Planned commercial surface:

- hosted dashboards and team workspaces
- shared sessions and policy packs
- managed CI runners
- SSO/SCIM, audit retention, enterprise support

The local core is not crippled to sell the hosted product. No license bait-and-switch.
