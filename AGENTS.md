# NFL Watchdog v3

## Purpose

Single-user, spoiler-safe NFL viewing planner for Dutch DAZN viewers. The app is
static: ingestion generates public and reveal-on-demand JSON, while the React UI
runs the same planner as the CLI.

## Architecture

- `src/ingest.js` fetches ESPN data and writes season/week artifacts.
- `src/schema.js` and `src/teams.js` are allowlist-based spoiler boundaries.
- `src/planner.js` allocates Full Replay and Game in 40 slots.
- `web/src/App.jsx` owns season/week, quota, watched-state, and reveal flows.
- `web/src/lib/data.js` is the only browser network layer.
- `web/src/lib/prefs.js` stores team preferences and watched progress locally.
- GitHub Actions refreshes data weekly and deploys the static build to Pages.

## Product constraints

- Never expose scores, winners, outcome-derived metrics, or post-game records in
  the initial page payload.
- A later week must not be fetched until the watched-through gate permits it.
- Team preferences may change in the browser, so tags must be recomputed there.
- Mobile Safari and home-screen PWA use are the primary interaction context.
- Conversations and UI copy are Dutch; code comments and technical docs are English.

## Current state

v3 was created from clean commit `990dad0` in v2 for a feature, UX, and technical
review. No product implementation changes have been made yet. Run `npm run verify`
for the build plus the complete test suite.
