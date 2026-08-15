// Tags are computed in two places — the ingest and the browser — so they get
// their own tests. The browser recomputes them because favourites are editable
// there; if these two ever drift, the web UI silently describes preferences the
// user no longer has.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTags, FAVORITE, OWN_DIVISION, SEEDING, INTERNATIONAL } from '../src/tags.js';

const teams = [
  { abbr: 'KC', tier: 'favorite', rank: 1, conference: 'AFC', division: 'AFC West' },
  { abbr: 'DET', tier: 'favorite', rank: 2, conference: 'NFC', division: 'NFC North' },
  { abbr: 'DEN', tier: 'neutral', conference: 'AFC', division: 'AFC West' },
  { abbr: 'LAC', tier: 'neutral', conference: 'AFC', division: 'AFC West' },
  { abbr: 'BUF', tier: 'neutral', conference: 'AFC', division: 'AFC East' },
  { abbr: 'GB', tier: 'neutral', conference: 'NFC', division: 'NFC North' },
  { abbr: 'TB', tier: 'neutral', conference: 'NFC', division: 'NFC South' },
];

const game = (away, home, recAway = '8-4', recHome = '8-4', extra = {}) => ({
  away: teams.find((t) => t.abbr === away),
  home: teams.find((t) => t.abbr === home),
  records_before: { away: recAway, home: recHome },
  is_international: false,
  ...extra,
});

test('een wedstrijd van je eigen team krijgt own_team', () => {
  assert.deepEqual(computeTags(game('DEN', 'KC'), teams), [FAVORITE]);
});

test('own_team sluit de andere voorkeurstags uit', () => {
  const tags = computeTags(game('DEN', 'KC'), teams);
  assert.ok(!tags.includes(OWN_DIVISION));
  assert.ok(!tags.includes(SEEDING));
});

test('twee andere teams uit de divisie van je team krijgen jouw divisie', () => {
  assert.ok(computeTags(game('LAC', 'DEN'), teams).includes(OWN_DIVISION));
});

test('indirect belangrijk vraagt twee winnende records in dezelfde conference', () => {
  assert.ok(computeTags(game('BUF', 'DEN', '9-3', '8-4'), teams).includes(SEEDING));
  // One team below .500: the seeding picture barely moves.
  assert.ok(!computeTags(game('BUF', 'DEN', '3-9', '8-4'), teams).includes(SEEDING));
});

test('indirect belangrijk kijkt alleen naar de records van vóór de week', () => {
  // A 0-0 record means week 1: nothing is riding on anything yet.
  assert.ok(!computeTags(game('BUF', 'DEN', '0-0', '0-0'), teams).includes(SEEDING));
});

test('een conference waarin geen van je teams speelt levert geen seeding-tag', () => {
  const onlyKC = teams.map((t) => (t.abbr === 'DET' ? { ...t, tier: 'neutral' } : t));
  // GB vs TB is NFC; with only KC (AFC) as a favourite that is irrelevant.
  assert.ok(!computeTags(game('GB', 'TB', '9-3', '8-4'), onlyKC).includes(SEEDING));
});

test('internationaal komt er los bij', () => {
  const tags = computeTags(game('DEN', 'KC', '8-4', '8-4', { is_international: true }), teams);
  assert.ok(tags.includes(FAVORITE));
  assert.ok(tags.includes(INTERNATIONAL));
});

test('zonder favorieten blijven alleen feitelijke tags over', () => {
  const none = teams.map((t) => ({ ...t, tier: 'neutral' }));
  assert.deepEqual(computeTags(game('LAC', 'DEN', '9-3', '8-4'), none), []);
});

test('tags volgen de favorieten mee als die veranderen', () => {
  // This is what the UI toggle depends on.
  const before = computeTags(game('GB', 'TB', '9-3', '8-4'), teams);
  const withTB = teams.map((t) => (t.abbr === 'TB' ? { ...t, tier: 'favorite', rank: 3 } : t));
  const after = computeTags(game('GB', 'TB', '9-3', '8-4'), withTB);
  assert.ok(!before.includes(FAVORITE));
  assert.ok(after.includes(FAVORITE));
});

test('conference en divisie komen uit de wedstrijd zelf, niet uit de teamlijst', () => {
  // The public payload carries them, so the browser does not depend on a
  // complete team list to tag correctly.
  const sparse = [{ abbr: 'KC', tier: 'favorite', rank: 1, conference: 'AFC', division: 'AFC West' }];
  const g = {
    away: { abbr: 'LAC', conference: 'AFC', division: 'AFC West' },
    home: { abbr: 'DEN', conference: 'AFC', division: 'AFC West' },
    records_before: { away: '9-3', home: '8-4' },
    is_international: false,
  };
  const tags = computeTags(g, sparse);
  assert.ok(tags.includes(OWN_DIVISION));
  assert.ok(tags.includes(SEEDING));
});
