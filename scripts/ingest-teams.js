// Bouwt de teamgids: data/public/{season}/teams.json.
//
//   node scripts/ingest-teams.js                 # laat een bestaand bestand staan
//   node scripts/ingest-teams.js --refresh       # bij ESPN ophalen en overschrijven
//
// --refresh slaat ook de HTTP-cache over. Deed hij dat niet, dan bouwde hij het
// bestand opnieuw uit dezelfde payloads in data/cache/ en zag je een verse
// bestandsdatum boven weken oude namen.
//
// Bewust géén onderdeel van de wekelijkse cron, en bewust niet overschrijvend.
// Een depth chart halverwege het seizoen is niet neutraal: een quarterback die
// van plek 1 naar plek 2 zakt, zakte daar om een reden die in een wedstrijd
// gebeurde die jij misschien nog moet kijken. De gids is daarom een momentopname
// van vóór het seizoen, en blijft dat tot je zelf --refresh draait.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { teamList, teamProfile, teamRoster, depthCharts, mapLimit } from '../src/espn.js';
import { buildPublicTeam } from '../src/teams.js';

const ROOT = new URL('../', import.meta.url);
const refresh = process.argv.includes('--refresh');

const config = JSON.parse(await readFile(new URL('config/preferences.json', ROOT), 'utf8'));
const season = config.season;
const out = new URL(`data/public/${season}/teams.json`, ROOT);

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

if (!refresh && (await exists(out))) {
  console.log(`data/public/${season}/teams.json bestaat al — draai met --refresh om te vernieuwen.`);
  process.exit(0);
}

// De koppeling loopt over de afkorting. Wijkt ESPN daarin af, dan moet dat
// opvallen en niet stilletjes een team overslaan.
const opts = { refresh };

const list = await teamList(opts);
const byAbbr = new Map(
  (list.sports?.[0]?.leagues?.[0]?.teams ?? []).map((t) => [t.team.abbreviation, t.team.id]),
);

const missing = config.teams.filter((t) => !byAbbr.has(t.abbr));
if (missing.length) {
  throw new Error(`geen ESPN-id voor: ${missing.map((t) => t.abbr).join(', ')}`);
}

const built = await mapLimit(config.teams, 4, async (team) => {
  const id = byAbbr.get(team.abbr);
  const [profile, roster, depth] = await Promise.all([
    teamProfile(id, opts),
    teamRoster(id, opts),
    depthCharts(season, id, opts),
  ]);
  const doc = buildPublicTeam({ profile, roster, depth, config: team });
  console.log(
    `${team.abbr.padEnd(4)} ${doc.coach?.name ?? 'geen coach'} · ${doc.key_players.length} spelers`,
  );
  return doc;
});

await mkdir(new URL(`data/public/${season}/`, ROOT), { recursive: true });
await writeFile(
  out,
  JSON.stringify(
    {
      season,
      // Geen tijdstempel: de gids hoort niet elke run te veranderen, en een
      // wisselend veld maakt elke diff onleesbaar.
      teams: Object.fromEntries(built.map((t) => [t.abbr, t])),
    },
    null,
    2,
  ),
);

console.log(`\ndata/public/${season}/teams.json — ${built.length} teams`);
