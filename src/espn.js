// Cached ESPN fetching. Every response is written to data/cache/ so re-runs are
// offline and deterministic. Nothing here interprets the data; see ingest.js.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const CACHE_DIR = new URL('../data/cache/', import.meta.url);

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

await mkdir(CACHE_DIR, { recursive: true });

async function cachedJson(key, url) {
  const file = new URL(`${key}.json`, CACHE_DIR);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // not cached yet
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  const data = await res.json();
  await writeFile(file, JSON.stringify(data));
  return data;
}

export function scoreboard(season, week) {
  return cachedJson(
    `scoreboard-${season}-w${week}`,
    `${SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`,
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
