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

v3 fixes scoreboard freshness, persists the complete local state, splits reveal
artifacts per game, exposes Sunday in 60, and tracks watched games. The mobile UI
uses a compact default card; All-22 timing and decision details sit behind
`Waarom?`. Context chips are limited to three and identify favourites, viewing
priority, international games, prime-time broadcasts, and holiday fixtures.
The planner treats `full` as DAZN's ad-free full-length replay and budgets 125
minutes; kickoff time is context, not a reason to recommend live viewing. All-22
availability uses a conservative 48-hour delay. A local, versioned viewing log
records the chosen format and mark time for every game; the collapsed viewing
profile reports patterns after three observations but does not affect planning.
Run `npm run verify` for the build plus the complete test suite.
