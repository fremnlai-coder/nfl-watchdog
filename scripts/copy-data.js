// Stages data for the web build.
//
// Both public and private files are copied: "private" here means "not in the
// initial page payload", not "access controlled". The app fetches the private
// files only on an explicit click, which is the whole level 2 / level 3
// mechanism. What must never happen is private data ending up *inside* the
// bundle, and the dist leak scan is what checks that.

import { mkdir, readdir, copyFile, rm, writeFile, readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const TARGET = new URL('web/public/data/', ROOT);

await rm(TARGET, { recursive: true, force: true });

// Walks the per-season folders and stages them verbatim.
async function stage(kind) {
  const from = new URL(`data/${kind}/`, ROOT);
  const to = new URL(`${kind}/`, TARGET);
  const seasons = {};
  for (const season of await readdir(from)) {
    if (!/^\d{4}$/.test(season)) continue;
    const seasonFrom = new URL(`${season}/`, from);
    const seasonTo = new URL(`${season}/`, to);
    await mkdir(seasonTo, { recursive: true });
    const files = (await readdir(seasonFrom)).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      await copyFile(new URL(file, seasonFrom), new URL(file, seasonTo));
    }
    seasons[season] = files;
  }
  return seasons;
}

const publicSeasons = await stage('public');
const privateSeasons = await stage('private');

const prefs = JSON.parse(
  await readFile(new URL('config/preferences.json', ROOT), 'utf8'),
);

const weeksBySeason = Object.fromEntries(
  Object.entries(publicSeasons).map(([season, files]) => [
    season,
    files
      .map((f) => Number(/^week-(\d+)\.json$/.exec(f)?.[1]))
      .filter(Number.isFinite)
      .sort((a, b) => a - b),
  ]),
);

// An index so the app does not have to probe for what exists. `current` is the
// season the config points at; the others stay available in the week picker.
await writeFile(
  new URL('index.json', TARGET),
  JSON.stringify({
    current: String(prefs.season),
    seasons: weeksBySeason,
  }, null, 2),
);

// Team crests, fetched once by scripts/fetch-logos.js and committed.
const logosFrom = new URL('assets/logos/', ROOT);
const logosTo = new URL('web/public/logos/', ROOT);
await rm(logosTo, { recursive: true, force: true });
await mkdir(logosTo, { recursive: true });
let logoCount = 0;
for (const file of await readdir(logosFrom).catch(() => [])) {
  if (!file.endsWith('.png')) continue;
  await copyFile(new URL(file, logosFrom), new URL(file, logosTo));
  logoCount++;
}

await mkdir(new URL('config/', new URL('web/public/', ROOT)), { recursive: true });
await copyFile(
  new URL('config/preferences.json', ROOT),
  new URL('web/public/config/preferences.json', ROOT),
);

const totals = (m) => Object.values(m).reduce((n, f) => n + f.length, 0);
console.log(
  `Gestaged: ${totals(publicSeasons)} publieke, ${totals(privateSeasons)} privé bestanden, ` +
  `${logoCount} logos. Seizoenen: ${Object.keys(weeksBySeason).sort().join(', ')} ` +
  `(actief: ${prefs.season}).`,
);
