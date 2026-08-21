// The between-weeks leak. Every other spoiler rule in this project works inside
// a single week; this one is about the relationship between them, and it is the
// easiest to get wrong because nothing on the page looks like a spoiler.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isLocked, maxOpenWeek, lockReason, partitionWeeks } from '../src/watched.js';

const ROOT = new URL('../', import.meta.url);

test('je mag altijd één week vooruit', () => {
  // Watched through 3 means week 4 carries the standing after week 3, which you
  // have seen. Week 5 carries the standing after week 4, which you have not.
  assert.equal(maxOpenWeek(3), 4);
  assert.equal(isLocked(4, 3), false);
  assert.equal(isLocked(5, 3), true);
});

test('vanaf nul is alleen week 1 open', () => {
  assert.equal(maxOpenWeek(0), 1);
  assert.equal(isLocked(1, 0), false);
  assert.equal(isLocked(2, 0), true);
});

test('een gekeken week blijft open', () => {
  for (let w = 1; w <= 10; w++) assert.equal(isLocked(w, 10), false);
});

test('ontbrekende of rommelige waarden vallen terug op nul', () => {
  for (const bad of [undefined, null, '', NaN, 'nee']) {
    assert.equal(maxOpenWeek(bad), 1, `${bad} zou als 0 moeten tellen`);
    assert.equal(isLocked(2, bad), true);
  }
});

test('de uitleg benoemt welke weken zouden lekken', () => {
  assert.match(lockReason(5, 2), /week 3 tot en met 4/);
  assert.match(lockReason(5, 2), /tot en met week 2/);
  // Vanaf nul is er geen ondergrens om vanaf te tellen.
  assert.match(lockReason(4, 0), /week 1 tot en met 3/);
});

test('weken splitsen in open en op slot', () => {
  const { open, locked } = partitionWeeks([1, 2, 3, 4, 5], 2);
  assert.deepEqual(open, [1, 2, 3]);
  assert.deepEqual(locked, [4, 5]);
});

test('het lek dat dit afvangt bestaat echt in de data', async () => {
  // Not a theoretical rule: prove that week N+1 really does carry the standing
  // after week N, so that opening ahead would give it away.
  const read = async (w) =>
    JSON.parse(await readFile(new URL(`data/public/2025/week-${w}.json`, ROOT), 'utf8'));

  const w4 = await read(4);
  const w5 = await read(5);
  const recordsIn = (doc) => {
    const m = new Map();
    for (const g of doc.games) {
      m.set(g.home.abbr, g.records_before.home);
      m.set(g.away.abbr, g.records_before.away);
    }
    return m;
  };
  const before4 = recordsIn(w4);
  const before5 = recordsIn(w5);

  let moved = 0;
  for (const [abbr, r5] of before5) {
    if (before4.has(abbr) && before4.get(abbr) !== r5) moved++;
  }
  assert.ok(
    moved > 20,
    `slechts ${moved} records verschillen tussen week 4 en 5 — verwacht dat vrijwel elke ploeg beweegt`,
  );
});
