import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventLabels, isPrimeTime, slotLabel } from '../src/time.js';

const labels = (iso, opts = {}) => eventLabels(new Date(iso), opts);

test('alleen de openingswedstrijd van week 1 heet NFL Kickoff', () => {
  const kickoff2025 = '2025-09-05T00:20:00.000Z';
  const kickoff = '2026-09-10T00:20:00.000Z';
  const thanksgivingEve = '2026-11-26T01:00:00.000Z';

  assert.deepEqual(labels(kickoff2025, { week: 1 }), ['kickoff']);
  assert.equal(slotLabel(new Date(kickoff2025), { week: 1 }), 'NFL Kickoff');
  assert.deepEqual(labels(kickoff, { week: 1 }), ['kickoff']);
  assert.equal(slotLabel(new Date(kickoff), { week: 1 }), 'NFL Kickoff');
  assert.ok(!labels(thanksgivingEve, { week: 12 }).includes('kickoff'));
  assert.equal(slotLabel(new Date(thanksgivingEve), { week: 12 }), 'Thanksgiving Eve');
});

test('een internationale donderdagavondwedstrijd is niet automatisch TNF', () => {
  const melbourne = '2026-09-11T00:35:00.000Z';
  assert.deepEqual(labels(melbourne, { week: 1, isInternational: true }), ['international']);
  assert.equal(
    slotLabel(new Date(melbourne), { week: 1, isInternational: true }),
    'Donderdagavond',
  );
});

test('Thanksgivingmiddag en Thanksgiving-TNF blijven uit elkaar', () => {
  const early = '2026-11-26T18:00:00.000Z';
  const late = '2026-11-27T01:20:00.000Z';

  assert.deepEqual(labels(early, { week: 12 }), ['thanksgiving']);
  assert.deepEqual(labels(late, { week: 12 }), ['thanksgiving', 'tnf']);
  assert.equal(isPrimeTime(new Date(early)), false);
  assert.equal(isPrimeTime(new Date(late)), true);
});

test('feestdagen krijgen hun eigen labels', () => {
  assert.deepEqual(
    labels('2026-11-27T20:00:00.000Z', { week: 12 }),
    ['black_friday'],
  );
  assert.deepEqual(
    labels('2026-12-25T18:00:00.000Z', { week: 16 }),
    ['christmas'],
  );
});

test('MNF, SNF en zaterdag worden specifiek benoemd', () => {
  assert.ok(labels('2026-09-15T00:15:00.000Z', { week: 1 }).includes('mnf'));
  assert.ok(labels('2026-09-14T00:20:00.000Z', { week: 1 }).includes('snf'));
  assert.ok(labels('2026-12-20T01:15:00.000Z', { week: 15 }).includes('saturday'));
});
