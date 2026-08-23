// The restore path, tested outside the browser. parseBackup touches no storage
// of its own, so it imports cleanly here.
//
// What is being guarded is mostly the watched counter. A back-up is the one
// place where a number that decides which weeks may be fetched arrives from
// outside the app, and a wrong one opens weeks whose records are the standings
// after games you have not seen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportState, parseBackup } from '../web/src/lib/prefs.js';

const VALID = {
  app: 'nfl-watchdog',
  version: 3,
  exported_at: '2026-08-21T10:00:00.000Z',
  teams: { KC: { tier: 'favorite', rank: 1 }, DET: { tier: 'favorite', rank: 2 }, NYJ: { tier: 'avoid', rank: null } },
  watched: { 2026: 3, 2025: 18 },
  settings: {
    weekly_quota: { full: 1, game_in_40: 4 },
    with_recap: true,
    last_season: '2026',
    last_week_by_season: { 2026: 4, 2025: 18 },
  },
  viewed: { 2026: ['401000001', '401000002'] },
  viewing_log: [{
    game_id: '401000001',
    season: '2026',
    week: 3,
    viewed_at: '2026-09-22T18:30:00.000Z',
    view_format: 'full',
    suggested: false,
    planned_format: 'skip',
    away: 'BUF',
    home: 'MIA',
    kickoff_utc: '2026-09-20T17:00:00.000Z',
    game_type: 'division',
    is_international: false,
    event_labels: [],
  }],
};

test('een geldige back-up komt er ongeschonden uit', () => {
  const state = parseBackup(JSON.stringify(VALID));
  assert.deepEqual(state.watched, { 2026: 3, 2025: 18 });
  assert.equal(state.teams.KC.tier, 'favorite');
  assert.equal(state.teams.NYJ.rank, null);
  assert.deepEqual(state.settings.weekly_quota, { full: 1, game_in_40: 4 });
  assert.deepEqual(state.viewed, { 2026: ['401000001', '401000002'] });
  assert.equal(state.viewing_log[0].view_format, 'full');
});

test('favorieten worden hernummerd, dus een gat in de rangen overleeft het niet', () => {
  const doc = { ...VALID, teams: { KC: { tier: 'favorite', rank: 4 }, DET: { tier: 'favorite', rank: 9 } } };
  const { teams } = parseBackup(JSON.stringify(doc));
  assert.equal(teams.KC.rank, 1);
  assert.equal(teams.DET.rank, 2);
});

test('een niet-favoriet houdt geen rang over', () => {
  const doc = { ...VALID, teams: { KC: { tier: 'neutral', rank: 2 } } };
  const { teams } = parseBackup(JSON.stringify(doc));
  assert.equal(teams.KC.rank, null);
});

test('rommel wordt geweigerd in plaats van half toegepast', () => {
  for (const [label, text] of [
    ['geen JSON', 'niet eens json'],
    ['ander bestand', JSON.stringify({ app: 'iets-anders', version: 1 })],
    ['andere versie', JSON.stringify({ ...VALID, version: 4 })],
    ['onbekende tier', JSON.stringify({ ...VALID, teams: { KC: { tier: 'held' } } })],
    ['ongeldige weekvorm', JSON.stringify({ ...VALID, settings: { weekly_quota: { full: 99, game_in_40: 3 } } })],
    ['ongeldige voortgang', JSON.stringify({ ...VALID, viewed: { 2026: ['../../score'] } })],
    ['ongeldig kijkprofiel', JSON.stringify({ ...VALID, viewing_log: [{ nope: true }] })],
  ]) {
    assert.throws(() => parseBackup(text), Error, label);
  }
});

test('een kijkstand buiten het seizoen wordt geweigerd', () => {
  // The spoiler side of an import: 19 would open every week, and 3.5 or a "3"
  // as text slips past the comparison without this check.
  for (const week of [19, -1, 3.5, '3', null]) {
    assert.throws(
      () => parseBackup(JSON.stringify({ ...VALID, watched: { 2026: week } })),
      Error,
      `week ${week}`,
    );
  }
});

test('exporteren en terugzetten levert dezelfde stand op', () => {
  // exportState reads localStorage; outside a browser that is empty, and the
  // result should be a valid — if empty — document.
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const doc = exportState(new Date('2026-08-21T10:00:00.000Z'));
  assert.equal(doc.app, 'nfl-watchdog');
  assert.equal(doc.exported_at, '2026-08-21T10:00:00.000Z');
  const state = parseBackup(JSON.stringify(doc));
  assert.deepEqual(state, {
    teams: {}, watched: {}, settings: {}, viewed: {}, viewing_log: [],
  });
  delete globalThis.localStorage;
});

test('een versie 1-back-up blijft leesbaar', () => {
  const old = { ...VALID, version: 1 };
  delete old.settings;
  delete old.viewed;
  delete old.viewing_log;
  const state = parseBackup(JSON.stringify(old));
  assert.deepEqual(state.settings, {});
  assert.deepEqual(state.viewed, {});
  assert.deepEqual(state.viewing_log, []);
});

test('een versie 2-back-up blijft leesbaar zonder kijkprofiel', () => {
  const old = { ...VALID, version: 2 };
  delete old.viewing_log;
  const state = parseBackup(JSON.stringify(old));
  assert.deepEqual(state.viewing_log, []);
  assert.deepEqual(state.viewed, VALID.viewed);
});
