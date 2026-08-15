// Downloads the 32 team crests once and stores them in the repo.
//
// Hotlinking to ESPN would put a third-party request on every page load and
// break the moment they reorganise their CDN. These are static crests, not game
// imagery, so there is nothing here that can spoil a result.
//
// Downscaled to 96px with sips when available: the originals are ~45kB each,
// which is 1.5MB of git history for something rendered at 20 pixels.

import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const run = promisify(execFile);
const ROOT = new URL('../', import.meta.url);
const OUT = new URL('assets/logos/', ROOT);
const SIZE = 96;

await mkdir(OUT, { recursive: true });

const prefs = JSON.parse(await readFile(new URL('config/preferences.json', ROOT), 'utf8'));

let haveSips = true;
try {
  await run('sips', ['--version']);
} catch {
  haveSips = false;
  console.warn('sips niet gevonden — logos worden op volledige grootte bewaard.');
}

const existing = new Set(await readdir(OUT).catch(() => []));
let fetched = 0;

for (const team of prefs.teams) {
  const file = `${team.abbr}.png`;
  if (existing.has(file)) continue;

  const url = `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${team.abbr.toLowerCase()}.png`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`${team.abbr}: ${res.status} bij ${url}`);
    continue;
  }
  const target = new URL(file, OUT);
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  if (haveSips) {
    await run('sips', ['-Z', String(SIZE), target.pathname, '--out', target.pathname]);
  }
  fetched++;
}

const files = await readdir(OUT);
let bytes = 0;
for (const f of files) bytes += (await stat(new URL(f, OUT))).size;

console.log(
  `${files.length} logos in assets/logos/ (${fetched} nieuw opgehaald, ` +
  `${Math.round(bytes / 1024)} kB totaal).`,
);
