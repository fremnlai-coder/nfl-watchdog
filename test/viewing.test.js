import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildViewingProfile,
  createViewingEvent,
  normalizeViewingEvent,
  normalizeViewingLog,
  removeViewingEvent,
  upsertViewingEvent,
} from '../web/src/lib/viewing.js';

const game = (extra = {}) => ({
  game_id: '401900001',
  week: 3,
  kickoff_utc: '2026-09-20T17:00:00.000Z',
  away: { abbr: 'GB' },
  home: { abbr: 'CHI' },
  game_type: 'division',
  is_international: false,
  format_advice: 'skip',
  ...extra,
});

const event = (extra = {}) => ({
  game_id: '401900001',
  season: '2026',
  week: 3,
  viewed_at: '2026-09-21T18:00:00.000Z',
  view_format: 'full',
  suggested: false,
  planned_format: 'skip',
  away: 'GB',
  home: 'CHI',
  kickoff_utc: '2026-09-20T17:00:00.000Z',
  game_type: 'division',
  is_international: false,
  event_labels: [],
  ...extra,
});

test('een kijkmoment bewaart alleen lokale, spoilervrije gedragssignalen', () => {
  const created = createViewingEvent(game({ score: '31-30', winner: 'CHI' }), {
    season: 2026,
    week: 3,
    viewFormat: 'full',
    suggested: false,
    plannedFormat: 'skip',
    now: new Date('2026-09-21T18:00:00.000Z'),
  });

  assert.equal(created.view_format, 'full');
  assert.equal(created.suggested, false);
  assert.equal(created.viewed_at, '2026-09-21T18:00:00.000Z');
  assert.ok(!Object.hasOwn(created, 'score'));
  assert.ok(!Object.hasOwn(created, 'winner'));
});

test('opnieuw markeren vervangt het kijkmoment in plaats van het te verdubbelen', () => {
  const first = event();
  const later = event({ viewed_at: '2026-09-21T20:00:00.000Z', view_format: 'game_in_40' });
  const log = upsertViewingEvent(upsertViewingEvent([], first), later);

  assert.equal(log.length, 1);
  assert.equal(log[0].view_format, 'game_in_40');
  assert.deepEqual(removeViewingEvent(log, '2026', first.game_id), []);
});

test('een beschadigd kijkprofiel wordt lokaal genegeerd en in een back-up geweigerd', () => {
  assert.deepEqual(normalizeViewingLog([{ nope: true }]), []);
  assert.throws(() => normalizeViewingLog([{ nope: true }], true), /kijkprofiel|kijkmoment/i);
  assert.throws(
    () => normalizeViewingEvent(event({ game_id: '../../score' }), true),
    /wedstrijd-id/i,
  );
});

test('het kijkprofiel wacht op drie betrouwbare kijkmomenten', () => {
  const profile = buildViewingProfile([event()], '2026');
  assert.equal(profile.ready, false);
  assert.equal(profile.remaining, 2);
  assert.deepEqual(profile.insights, []);
});

test('het kijkprofiel vindt tijd, formaat en terugkerende teams buiten het plan', () => {
  const log = [
    event(),
    event({
      game_id: '401900002',
      viewed_at: '2026-09-28T19:00:00.000Z',
      away: 'MIN',
      home: 'CHI',
    }),
    event({
      game_id: '401900003',
      viewed_at: '2026-10-05T18:30:00.000Z',
      away: 'DET',
      home: 'SF',
      suggested: true,
      planned_format: 'full',
    }),
  ];
  const profile = buildViewingProfile(log, '2026', { CHI: 'Chicago Bears' });
  const text = profile.insights.map((insight) => insight.text).join(' ');

  assert.equal(profile.ready, true);
  assert.match(text, /maandagavond \(3×\)/);
  assert.match(text, /Volledige replays.*3×/);
  assert.match(text, /Chicago Bears.*2×.*buiten je kijkplan/);
});

test('internationale belangstelling verschijnt als teams nog geen patroon vormen', () => {
  const log = [
    event({ game_id: '401900010', away: 'JAX', home: 'ATL', is_international: true }),
    event({ game_id: '401900011', away: 'NYJ', home: 'DEN', is_international: true }),
    event({
      game_id: '401900012', away: 'SEA', home: 'ARI', suggested: true, planned_format: 'game_in_40',
    }),
  ];
  const profile = buildViewingProfile(log, '2026');
  assert.match(
    profile.insights.map((insight) => insight.text).join(' '),
    /Internationale wedstrijden koos je 2× buiten je kijkplan/,
  );
});
