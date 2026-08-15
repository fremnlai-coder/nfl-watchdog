// Scans the built site the way a visitor's browser would see it on load.
//
// The distinction that matters: dist/data/private/ *is* expected to contain
// scores, because that is what the level 3 fetch reads. What must be clean is
// the initial payload — the HTML plus the CSS and JS the page pulls in before
// anyone clicks anything. That is what "view-source bevat geen eindstand" means.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DIST = new URL('dist/', ROOT);

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

const built = await exists(DIST);

// Everything the browser loads before any interaction.
async function initialPayload() {
  const parts = [];
  parts.push(await readFile(new URL('index.html', DIST), 'utf8'));
  const assets = new URL('assets/', DIST);
  for (const file of await readdir(assets)) {
    if (/\.(js|css)$/.test(file)) {
      parts.push(await readFile(new URL(file, assets), 'utf8'));
    }
  }
  return parts.join('\n');
}

test('de build bestaat', (t) => {
  if (!built) {
    t.skip('geen dist/ — draai eerst `npm run build` (of `npm run verify`)');
    return;
  }
  assert.ok(built);
});

test('de initiele payload bevat geen enkele eindstand', async (t) => {
  if (!built) return t.skip('geen dist/');
  const payload = await initialPayload();

  const weekFiles = (await readdir(new URL('data/private/', ROOT)))
    .filter((f) => f.endsWith('.results.json'));
  assert.ok(weekFiles.length >= 18, `verwacht 18 weken, kreeg ${weekFiles.length}`);

  let checked = 0;
  for (const file of weekFiles) {
    const results = JSON.parse(
      await readFile(new URL(`data/private/${file}`, ROOT), 'utf8'),
    );
    for (const [id, r] of Object.entries(results)) {
      assert.ok(
        !payload.includes(r.score_line),
        `${file} ${id}: "${r.score_line}" staat in de initiele payload`,
      );
      checked++;
    }
  }
  assert.equal(checked, 272);
});

test('de initiele payload bevat geen privé-data, alleen de verwijzing ernaar', async (t) => {
  if (!built) return t.skip('geen dist/');
  const payload = await initialPayload();

  // The path template is expected — that is how the click-time fetch is built.
  // Actual hint or result content is not.
  assert.ok(
    payload.includes('data/private/week-'),
    'verwacht dat de bundel weet waar de privé-bestanden staan',
  );

  const hints = JSON.parse(
    await readFile(new URL('data/private/week-14.hints.json', ROOT), 'utf8'),
  );
  const phrases = new Set(Object.values(hints).flat());
  for (const phrase of phrases) {
    assert.ok(
      !payload.includes(phrase),
      `hint-tekst "${phrase}" zit in de bundel in plaats van in het losse bestand`,
    );
  }
});

test('de privé-bestanden staan wel in de build, want anders werkt level 3 niet', async (t) => {
  if (!built) return t.skip('geen dist/');
  const privateDir = new URL('dist/data/private/', ROOT);
  assert.ok(await exists(privateDir), 'dist/data/private/ ontbreekt');
  const files = await readdir(privateDir);
  assert.equal(files.filter((f) => f.endsWith('.results.json')).length, 18);
  assert.equal(files.filter((f) => f.endsWith('.hints.json')).length, 18);
});

test('het publieke weekbestand in de build is nog steeds schoon', async (t) => {
  if (!built) return t.skip('geen dist/');
  for (const week of [1, 9, 18]) {
    const pub = await readFile(new URL(`dist/data/public/week-${week}.json`, ROOT), 'utf8');
    const results = JSON.parse(
      await readFile(new URL(`data/private/week-${week}.results.json`, ROOT), 'utf8'),
    );
    for (const r of Object.values(results)) {
      assert.ok(!pub.includes(r.score_line), `week ${week}: "${r.score_line}" lekt in de build`);
    }
  }
});
