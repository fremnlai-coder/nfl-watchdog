// Fetches a season, computes metrics, and writes the public/private split.
//
// Usage: node src/ingest.js [--season 2025] [--weeks 1-18] [--offline]
//
// The public file is built exclusively through buildPublicGame(), which picks
// from the allowlist in schema.js. No ESPN object is ever spread into it.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { scoreboard, plays, probabilities, mapLimit } from './espn.js';
import { joinSeries, rawMetrics, stakes, finalScore } from './metrics.js';
import { scoreSeason, bucketStakes } from './score.js';
import { planBoth } from './planner.js';
import { buildPublicGame, assertPublicShape } from './schema.js';
import { playerNamesFromPlays, lintTeaser } from './linter.js';
import { teaserFor } from './teasers.js';
import { computeTags } from './tags.js';
import { formatNL, slotLabel, isSundaySlate, isLiveFriendly, offsetHours } from './time.js';

const ROOT = new URL('../', import.meta.url);

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const prefs = JSON.parse(await readFile(new URL('config/preferences.json', ROOT), 'utf8'));
const season = Number(argValue('season', prefs.season ?? 2025));
const [weekFrom, weekTo] = String(argValue('weeks', '1-18')).split('-').map(Number);
const offline = hasFlag('offline');
// Weeks that get written out.
const weeks = Array.from({ length: weekTo - weekFrom + 1 }, (_, i) => weekFrom + i);
// Everything from week 1 is still ingested: records carried into a week can only
// be tallied from earlier weeks, and watchability percentiles are relative to
// the season so far. Responses are cached, so this is a one-time cost.
const seasonWeeks = Array.from({ length: weekTo }, (_, i) => i + 1);

// Data lives per season. Without this, ingesting 2026 would overwrite week-1 of
// 2025 in place and leave a mix of two seasons in one folder — and the leak-scan
// tests need a finished season to check against.
const PUBLIC_DIR = new URL(`data/public/${season}/`, ROOT);
const PRIVATE_DIR = new URL(`data/private/${season}/`, ROOT);

const teamsByAbbr = new Map(prefs.teams.map((t) => [t.abbr, t]));
const favorites = prefs.teams.filter((t) => t.tier === 'favorite');
const favoriteDivisions = new Set(favorites.map((t) => t.division));
const favoriteConferences = new Set(favorites.map((t) => t.conference));

await mkdir(PUBLIC_DIR, { recursive: true });
await mkdir(PRIVATE_DIR, { recursive: true });

// ---------------------------------------------------------------- scoreboards

console.log(`Scoreboards ophalen voor seizoen ${season}, weken 1-${weekTo}...`);
const boards = new Map();
await mapLimit(seasonWeeks, 4, async (w) => {
  boards.set(w, await scoreboard(season, w, { refresh: !offline }));
});

// Flatten to a raw list, keeping ESPN data strictly on the private side.
const raw = [];
for (const week of seasonWeeks) {
  for (const event of boards.get(week).events ?? []) {
    const comp = event.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === 'home');
    const away = comp.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;
    raw.push({
      game_id: event.id,
      competition_id: comp.id,
      week,
      date: new Date(event.date),
      home_abbr: home.team.abbreviation,
      away_abbr: away.team.abbreviation,
      home_score: Number(home.score),
      away_score: Number(away.score),
      final: event.status?.type?.completed === true,
      venue_city: comp.venue?.address?.city ?? null,
      venue_country: comp.venue?.address?.country ?? null,
      neutral_site: comp.neutralSite === true,
      broadcast: comp.broadcast ?? null,
    });
  }
}
console.log(`${raw.length} wedstrijden gevonden.`);

// ------------------------------------------------------- records carried in
// Tallied from completed games in earlier weeks only. Reading the records field
// straight off the scoreboard would give the record *including* that week's
// game, which leaks the result of the very game being described.

const recordsBefore = new Map(); // `${week}:${abbr}` -> {w,l,t}
const recordsAfter = new Map(); // private side only
const running = new Map(prefs.teams.map((t) => [t.abbr, { w: 0, l: 0, t: 0 }]));

for (const week of seasonWeeks) {
  for (const team of prefs.teams) {
    recordsBefore.set(`${week}:${team.abbr}`, { ...running.get(team.abbr) });
  }
  for (const g of raw.filter((r) => r.week === week && r.final)) {
    const h = running.get(g.home_abbr);
    const a = running.get(g.away_abbr);
    if (!h || !a) continue;
    if (g.home_score > g.away_score) { h.w++; a.l++; }
    else if (g.away_score > g.home_score) { a.w++; h.l++; }
    else { h.t++; a.t++; }
  }
  for (const team of prefs.teams) {
    recordsAfter.set(`${week}:${team.abbr}`, { ...running.get(team.abbr) });
  }
}

const fmtRecord = (r) => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`);

// ------------------------------------------------------------------- metrics

console.log('Play-by-play en win probability ophalen...');
let done = 0;
const enriched = await mapLimit(raw, 6, async (g) => {
  if (!g.final) return { ...g, rows: [], metrics: null };
  const [playsDoc, probsDoc] = await Promise.all([
    plays(g.game_id, g.competition_id),
    probabilities(g.game_id, g.competition_id),
  ]);
  const rows = joinSeries(playsDoc, probsDoc);
  if (++done % 40 === 0) console.log(`  ${done}/${raw.filter((r) => r.final).length}`);
  return {
    ...g,
    rows,
    metrics: rows.length ? rawMetrics(rows) : null,
    // Everyone who touched the ball in this game. The teaser linter treats any
    // of these names as a leak, whatever is said about them.
    playerNames: playerNamesFromPlays(playsDoc),
  };
});

const teamMeta = (abbr) => teamsByAbbr.get(abbr) ?? { abbr, name: abbr, conference: '?', division: '?' };

function gameType(homeAbbr, awayAbbr) {
  const h = teamMeta(homeAbbr);
  const a = teamMeta(awayAbbr);
  if (h.division === a.division) return 'division';
  if (h.conference === a.conference) return 'conference';
  return 'interconference';
}

// Stakes is computed for every game, played or not: it only reads the records
// carried into the week, so an upcoming week can be ranked too. The other four
// metrics need play-by-play and therefore only exist for finished games.
const stakesAll = enriched.map((g) => ({
  game_id: g.game_id,
  stakes: stakes({
    recordBefore: {
      home: recordsBefore.get(`${g.week}:${g.home_abbr}`) ?? { w: 0, l: 0, t: 0 },
      away: recordsBefore.get(`${g.week}:${g.away_abbr}`) ?? { w: 0, l: 0, t: 0 },
    },
    week: g.week,
    gameType: gameType(g.home_abbr, g.away_abbr),
  }),
}));
const stakesBucket = bucketStakes(stakesAll);
const stakesById = new Map(stakesAll.map((s) => [s.game_id, s.stakes]));

// Watchability is scored across finished games only, so the percentiles stay
// relative to games that actually have a shape to measure.
const scorable = enriched
  .filter((g) => g.metrics)
  .map((g) => ({
    game_id: g.game_id,
    metrics: { ...g.metrics, stakes: stakesById.get(g.game_id) },
  }));

const scored = new Map(
  scoreSeason(scorable, prefs.score_weights).map((s) => [s.game_id, s]),
);
const metricsById = new Map(scorable.map((s) => [s.game_id, s.metrics]));

// --------------------------------------------------------------------- level 2
// Closed vocabulary. Qualitative only, and deliberately silent about direction.

function hintsFor(m) {
  const out = [];
  if (m.tension >= 0.6) out.push('bleef lang in de balans');
  if (m.tension < 0.25) out.push('vroeg in de plooi gevallen');
  if (m.volatility >= 6) out.push('wisselend beeld');
  if (m.pace >= 0.18) out.push('veel scoreverloop');
  if (m.pace <= 0.1) out.push('defensief duel');
  if (m.excitement >= 1.8) out.push('een paar grote omslagpunten');
  return out.length ? out : ['weinig bijzonders'];
}

// ---------------------------------------------------------------------- write

// The NFL help desk puts All-22 at 24 to 36 hours after a game *ends*, so the
// clock starts roughly three and a half hours after kickoff, not at kickoff.
const all22Delay = ((prefs.all22_delay_hours ?? 36) + 3.5) * 3600000;

for (const week of weeks) {
  const weekGames = enriched.filter((g) => g.week === week);

  const publicGames = weekGames.map((g) => {
    const isInternational = Boolean(g.venue_country && g.venue_country !== 'USA');
    const type = gameType(g.home_abbr, g.away_abbr);
    const home = teamMeta(g.home_abbr);
    const away = teamMeta(g.away_abbr);

    // Level 0 tags, computed by the shared helper so the browser can redo them
    // when favourites change without drifting from what the CLI shows.
    const tags = computeTags(
      {
        home: { abbr: home.abbr, conference: home.conference, division: home.division },
        away: { abbr: away.abbr, conference: away.conference, division: away.division },
        records_before: {
          home: fmtRecord(recordsBefore.get(`${week}:${g.home_abbr}`) ?? { w: 0, l: 0, t: 0 }),
          away: fmtRecord(recordsBefore.get(`${week}:${g.away_abbr}`) ?? { w: 0, l: 0, t: 0 }),
        },
        is_international: isInternational,
      },
      prefs.teams,
    );
    const isOwn = tags.includes('own_team');

    const liveWindow = prefs.live_friendly_hours ?? [11, 21];
    const slot = slotLabel(g.date, { isInternational, timeZone: prefs.timezone, window: liveWindow });
    const liveFriendly = isLiveFriendly(g.date, { timeZone: prefs.timezone, window: liveWindow });

    return buildPublicGame({
      game_id: g.game_id,
      season,
      week,
      kickoff_utc: g.date.toISOString(),
      kickoff_nl: formatNL(g.date, prefs.timezone),
      slot,
      is_international: isInternational,
      venue: g.venue_city,
      home: { abbr: home.abbr, name: home.name, conference: home.conference, division: home.division },
      away: { abbr: away.abbr, name: away.name, conference: away.conference, division: away.division },
      records_before: {
        home: fmtRecord(recordsBefore.get(`${week}:${g.home_abbr}`) ?? { w: 0, l: 0, t: 0 }),
        away: fmtRecord(recordsBefore.get(`${week}:${g.away_abbr}`) ?? { w: 0, l: 0, t: 0 }),
      },
      game_type: type,
      primetime: ['Thursday Night', 'Sunday Night', 'Monday Night'].includes(slot),
      tags,
      in_sunday_slate: isSundaySlate(g.date, prefs.slate_recap?.covers_weekdays ?? [0]),
      // Kickoff falls at an hour you could actually watch live from here.
      live_friendly_nl: liveFriendly,
      all22_from_nl: formatNL(new Date(g.date.getTime() + all22Delay), prefs.timezone),
      // Pre-game importance. Level 0: derived purely from the records carried
      // into the week, so it is safe even before you have watched anything.
      stakes_pre: stakesBucket.get(g.game_id) ?? null,
      // The rating is outcome-derived: it correlates -0.70 with the final margin,
      // so it says a game stayed close without saying who won. With
      // show_watchability off it is left out of the public payload entirely and
      // lives on at level 2 instead, where that shape hint belongs.
      // Own teams never carry one either way: you watch them regardless, and
      // omitting it keeps the section from being sortable by outcome data.
      watchability: (prefs.show_watchability === false || isOwn)
        ? null
        : (scored.get(g.game_id)?.watchability ?? null),
      hints_ready: metricsById.has(g.game_id),
      outcome_ready: g.final,
    });
  });

  // Teasers are generated from the public game only, then linted against the
  // players who actually appeared. A failing teaser falls back to a fixed
  // template rather than being rewritten.
  let fallbacks = 0;
  for (const pg of publicGames) {
    const src = weekGames.find((g) => g.game_id === pg.game_id);
    const { teaser, source } = teaserFor(pg, { playerNames: src?.playerNames ?? [] });
    if (source === 'fallback') fallbacks++;
    pg.teaser = teaser;
  }

  const packages = planBoth(publicGames, prefs);
  const planById = new Map(packages.a.games.map((p) => [p.game_id, p]));
  for (const pg of publicGames) {
    const p = planById.get(pg.game_id);
    pg.format_advice = p.format_advice;
    pg.format_reason = p.format_reason;
    pg.runtime_minutes = p.runtime_minutes;
    assertPublicShape(pg, `week ${week} game ${pg.game_id}`);
  }

  await writeFile(
    new URL(`week-${week}.json`, PUBLIC_DIR),
    JSON.stringify({
      season,
      week,
      timezone: prefs.timezone,
      nl_et_offset_hours: offsetHours(weekGames[0]?.date ?? new Date(), prefs.timezone),
      teams_on_bye: (boards.get(week).week?.teamsOnBye ?? []).map((t) => t.abbreviation),
      packages: { a: packages.a.summary, b: packages.b.summary },
      package_b_plan: packages.b.games,
      games: publicGames,
    }, null, 2),
  );

  await writeFile(
    new URL(`week-${week}.hints.json`, PRIVATE_DIR),
    JSON.stringify(Object.fromEntries(
      weekGames.filter((g) => metricsById.has(g.game_id))
        .map((g) => [g.game_id, hintsFor(metricsById.get(g.game_id))]),
    ), null, 2),
  );

  await writeFile(
    new URL(`week-${week}.results.json`, PRIVATE_DIR),
    JSON.stringify(Object.fromEntries(
      weekGames.filter((g) => g.final).map((g) => {
        const fs = finalScore(g.rows) ?? { home: g.home_score, away: g.away_score };
        const after = (abbr) => {
          const r = recordsAfter.get(`${week}:${abbr}`);
          return r ? fmtRecord(r) : null;
        };
        return [g.game_id, {
          final_score: { home: fs.home, away: fs.away },
          score_line: `${g.away_abbr} ${fs.away} - ${fs.home} ${g.home_abbr}`,
          winner: fs.home === fs.away ? 'TIE' : (fs.home > fs.away ? g.home_abbr : g.away_abbr),
          records_after: { home: after(g.home_abbr), away: after(g.away_abbr) },
          watchability: scored.get(g.game_id)?.watchability ?? null,
          player_names: g.playerNames ?? [],
          metrics: metricsById.get(g.game_id) ?? null,
          percentiles: scored.get(g.game_id)?._percentiles ?? null,
        }];
      }),
    ), null, 2),
  );

  console.log(
    `week ${week}: ${publicGames.length} wedstrijden geschreven` +
    (fallbacks ? `, ${fallbacks}x teaser-fallback` : ''),
  );
}

console.log('\nKlaar. Publiek in data/public/, privé in data/private/.');
