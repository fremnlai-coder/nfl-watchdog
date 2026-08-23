// Cached ESPN fetching. Every response is written to data/cache/ so re-runs are
// offline and deterministic. Nothing here interprets the data; see ingest.js.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const CACHE_DIR = new URL('../data/cache/', import.meta.url);

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

await mkdir(CACHE_DIR, { recursive: true });

// `refresh` slaat de cache over en schrijft hem daarna opnieuw. Zonder die
// uitweg is er geen manier om een gecacht antwoord te vernieuwen behalve
// data/cache/ met de hand leegmaken — en dan lijkt een ververs-commando te
// werken terwijl het de oude payload teruggeeft.
async function cachedJson(key, url, { refresh = false } = {}) {
  const file = new URL(`${key}.json`, CACHE_DIR);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      // not cached yet
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  const data = await res.json();
  await writeFile(file, JSON.stringify(data));
  return data;
}

// Scoreboards are mutable until every game in the week is final. Ingest requests
// them fresh by default; otherwise a schedule cached before kickoff would keep
// reporting `completed: false` for the entire season. `refresh: false` is kept as
// an explicit offline/reproducible mode for local work.
export function scoreboard(season, week, opts = { refresh: true }) {
  return cachedJson(
    `scoreboard-${season}-w${week}`,
    `${SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`,
    opts,
  );
}

// Carries period, clock, scoringPlay and the running score for every play.
// secondsLeft on the probabilities rows is always 0, so period comes from here.
export function plays(eventId, competitionId) {
  return cachedJson(
    `plays-${eventId}`,
    `${CORE}/events/${eventId}/competitions/${competitionId}/plays?limit=500`,
  );
}

// Win probability per play. Joined to plays() on the play id embedded in $ref.
export function probabilities(eventId, competitionId) {
  return cachedJson(
    `prob-${eventId}`,
    `${CORE}/events/${eventId}/competitions/${competitionId}/probabilities?limit=1000`,
  );
}

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// De teamgids. Alle drie de endpoints dragen velden die hier nooit publiek
// mogen worden — team.record staat er met W-L én gemiddelde punten in, en de
// roster kent een groep injuredReserveOrOut. Wat er wél doorheen komt bepaalt
// src/teams.js, net zoals schema.js dat voor de wedstrijden doet.
export function teamList(opts) {
  return cachedJson('teams-list', `${SITE}/teams?limit=32`, opts);
}

export function teamProfile(teamId, opts) {
  return cachedJson(`team-${teamId}`, `${SITE}/teams/${teamId}`, opts);
}

// Draagt de namen; de depth chart hieronder draagt alleen athlete-ids.
export function teamRoster(teamId, opts) {
  return cachedJson(`roster-${teamId}`, `${SITE}/teams/${teamId}/roster`, opts);
}

// Wie waar staat, zonder één statistiek. rank 1 is de starter.
export function depthCharts(season, teamId, opts) {
  return cachedJson(
    `depth-${season}-${teamId}`,
    `${CORE}/seasons/${season}/teams/${teamId}/depthcharts`,
    opts,
  );
}

// Runs tasks with bounded concurrency so a full-season backfill stays polite.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
