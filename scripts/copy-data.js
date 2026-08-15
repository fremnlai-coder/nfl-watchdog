// Stages data for the web build.
//
// Both public and private files are copied: "private" here means "not in the
// initial page payload", not "access controlled". The app fetches the private
// files only on an explicit click, which is the whole level 2 / level 3
// mechanism. What must never happen is private data ending up *inside* the
// bundle, and the dist leak scan is what checks that.

import { mkdir, readdir, copyFile, rm, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const TARGET = new URL('web/public/data/', ROOT);

await rm(TARGET, { recursive: true, force: true });

async function stage(kind) {
  const from = new URL(`data/${kind}/`, ROOT);
  const to = new URL(`${kind}/`, TARGET);
  await mkdir(to, { recursive: true });
  const files = (await readdir(from)).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    await copyFile(new URL(file, from), new URL(file, to));
  }
  return files;
}

const publicFiles = await stage('public');
const privateFiles = await stage('private');

const weeks = publicFiles
  .map((f) => Number(/^week-(\d+)\.json$/.exec(f)?.[1]))
  .filter(Number.isFinite)
  .sort((a, b) => a - b);

// An index so the app does not have to probe for which weeks exist.
await writeFile(new URL('index.json', TARGET), JSON.stringify({ weeks }, null, 2));

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

console.log(
  `Gestaged: ${publicFiles.length} publieke, ${privateFiles.length} privé bestanden, ` +
  `${logoCount} logos, weken ${weeks[0]}-${weeks[weeks.length - 1]}.`,
);
