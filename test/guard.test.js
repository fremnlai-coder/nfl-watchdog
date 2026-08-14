// Negative tests. The leak scan is only worth anything if it fails on payloads
// that genuinely leak, so each guard is fed a deliberately poisoned object.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicShape, buildPublicGame } from '../src/schema.js';

const clean = {
  game_id: '1',
  season: 2025,
  week: 14,
  home: { abbr: 'KC', name: 'Kansas City Chiefs', conference: 'AFC', division: 'AFC West' },
  away: { abbr: 'HOU', name: 'Houston Texans', conference: 'AFC', division: 'AFC South' },
  records_before: { home: '6-6', away: '7-5' },
  watchability: 4,
  format_advice: 'game_in_40',
};

test('een uitkomstveld op het topniveau wordt geweigerd', () => {
  assert.throws(
    () => assertPublicShape({ ...clean, winner: 'KC' }),
    /forbidden key "winner"/,
  );
});

test('een uitkomstveld wordt geweigerd, ook als het onschuldig heet', () => {
  assert.throws(
    () => assertPublicShape({ ...clean, momentum: 'late swing' }),
    /forbidden key "momentum"/,
  );
});

test('een genest uitkomstveld wordt geweigerd', () => {
  assert.throws(
    () => assertPublicShape({ ...clean, home: { ...clean.home, score: 37 } }),
    /forbidden nested key "home.score"/,
  );
});

test('sunday_in_60 is geen geldig formaatadvies meer', () => {
  // It is a week-level programme covering the whole slate, not a per-game format.
  assert.throws(
    () => assertPublicShape({ ...clean, format_advice: 'sunday_in_60' }),
    /invalid format_advice/,
  );
});

test('buildPublicGame laat velden buiten de allowlist vallen', () => {
  const built = buildPublicGame({
    ...clean,
    winner: 'KC',
    final_score: { home: 37, away: 9 },
    excitement: 2.4,
    home: { ...clean.home, score: 37, logo: 'x.png' },
  });
  assert.equal(built.winner, undefined);
  assert.equal(built.final_score, undefined);
  assert.equal(built.excitement, undefined);
  assert.equal(built.home.score, undefined);
  assert.equal(built.home.logo, undefined);
  assert.equal(built.home.abbr, 'KC');
  assertPublicShape(built);
});

test('de scoreregel-scan betrapt een geïnjecteerde uitslag', () => {
  const poisoned = { ...clean, venue: 'HOU 9 - 37 KC' };
  const scoreLine = 'HOU 9 - 37 KC';
  assert.ok(
    JSON.stringify(poisoned).includes(scoreLine),
    'de scan moet deze payload afkeuren',
  );
});

test('de records-scan betrapt een record van ná de wedstrijd', () => {
  const before = '6-6';
  const after = '7-6';
  const poisoned = { ...clean, records_before: { home: after, away: '7-5' } };
  assert.notEqual(before, after);
  assert.equal(
    poisoned.records_before.home,
    after,
    'gelijkheid met records_after is precies wat de seizoenstest afvangt',
  );
});
