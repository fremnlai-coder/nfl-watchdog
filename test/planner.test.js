// Planner behaviour, including the ordering rules that exist for spoiler reasons
// rather than for convenience.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWeek, planBoth } from '../src/planner.js';

const prefs = {
  weekly_budget_minutes: 240,
  own_team_default_format: 'full',
  format_durations_minutes: { full: 185, game_in_40: 40 },
  slate_recap: { enabled: true, name: 'Sunday in 60', minutes: 60, covers_weekdays: [0] },
  teams: [
    { abbr: 'KC', tier: 'favorite', rank: 1 },
    { abbr: 'DET', tier: 'favorite', rank: 2 },
    { abbr: 'SF', tier: 'favorite', rank: 3 },
    { abbr: 'BUF', tier: 'watchlist' },
    { abbr: 'NYJ', tier: 'avoid' },
    { abbr: 'HOU', tier: 'neutral' },
    { abbr: 'GB', tier: 'neutral' },
    { abbr: 'ARI', tier: 'neutral' },
    { abbr: 'MIA', tier: 'neutral' },
    { abbr: 'PHI', tier: 'neutral' },
  ],
};

const game = (id, away, home, watchability, sunday = true) => ({
  game_id: id,
  home: { abbr: home },
  away: { abbr: away },
  watchability,
  in_sunday_slate: sunday,
});

const week = [
  game('1', 'HOU', 'KC', null),
  game('2', 'DET', 'GB', null),
  game('3', 'ARI', 'SF', null),
  game('4', 'PHI', 'MIA', 5),
  game('5', 'BUF', 'ARI', 3),
  game('6', 'MIA', 'NYJ', 5),
  game('7', 'GB', 'PHI', 2),
];

const byId = (plan) => new Map(plan.games.map((p) => [p.game_id, p]));

test('rang 1 wordt nooit automatisch gedegradeerd', () => {
  const plan = planWeek(week, prefs, { withRecap: false });
  assert.equal(byId(plan).get('1').format_advice, 'full');
});

test('degradatie gaat van de laagste rang omhoog', () => {
  const plan = planWeek(week, prefs, { withRecap: false });
  const p = byId(plan);
  // KC (1) keeps the full replay, SF (3) gives way before DET (2).
  assert.equal(p.get('1').format_advice, 'full');
  assert.equal(p.get('3').format_advice, 'skip');
  assert.notEqual(p.get('2').format_advice, 'skip');
});

test('een gedegradeerde eigen wedstrijd zegt waarom', () => {
  const plan = planWeek(week, prefs, { withRecap: false });
  assert.equal(byId(plan).get('3').format_reason, 'own_team_degraded');
});

test('avoid-teams krijgen nooit budget, ook niet bij een 5', () => {
  const plan = planWeek(week, prefs, { withRecap: false });
  const p = byId(plan).get('6');
  assert.equal(p.format_advice, 'skip');
  assert.equal(p.format_reason, 'avoid');
});

test('niet-favorieten krijgen standaard nooit een full replay', () => {
  // Otherwise "full" becomes a reliable marker for a high rating, which is the
  // level 1 leak the format advice is supposed to avoid.
  const plan = planWeek(week, { ...prefs, own_team_default_format: 'game_in_40' }, { withRecap: false });
  for (const p of plan.games) {
    if (['1', '2', '3'].includes(p.game_id)) continue;
    assert.notEqual(p.format_advice, 'full', `game ${p.game_id} kreeg een full replay`);
  }
});

test('het budget wordt niet overschreden door de vulling', () => {
  const plan = planWeek(week, { ...prefs, own_team_default_format: 'game_in_40' }, { withRecap: false });
  assert.ok(plan.summary.total_minutes <= prefs.weekly_budget_minutes);
});

test('watchlist gaat voor bij gelijke rating', () => {
  const tied = [
    game('a', 'BUF', 'HOU', 3),
    game('b', 'GB', 'ARI', 3),
  ];
  const plan = planWeek(tied, { ...prefs, weekly_budget_minutes: 40 }, { withRecap: false });
  assert.equal(byId(plan).get('a').format_advice, 'game_in_40');
  assert.equal(byId(plan).get('b').format_advice, 'skip');
});

test('de recap krijgt alleen minuten die na je eigen teams overblijven', () => {
  const plan = planWeek(week, prefs, { withRecap: true });
  // KC full (185) leaves 55 of 240, which is under the 60 the recap needs.
  assert.equal(plan.summary.recap_included, false);
  assert.equal(plan.summary.recap_dropped, true);
});

test('de recap komt er wel bij een ruimer budget', () => {
  const plan = planWeek(week, { ...prefs, own_team_default_format: 'game_in_40' }, { withRecap: true });
  assert.equal(plan.summary.recap_included, true);
  assert.equal(plan.summary.recap_minutes, 60);
});

test('de recap dekt alleen zondagwedstrijden', () => {
  const mixed = [
    game('t', 'HOU', 'GB', 4, false), // Thursday
    game('s', 'ARI', 'PHI', 4, true), // Sunday
  ];
  const plan = planWeek(mixed, { ...prefs, weekly_budget_minutes: 60 }, { withRecap: true });
  assert.equal(plan.summary.recap_included, true);
  assert.equal(plan.summary.recap_covers, 1);
  assert.equal(plan.summary.unseen, 1);
});

test('de uitkomst is deterministisch bij gelijke rating', () => {
  const a = planWeek(week, prefs, { withRecap: false });
  const b = planWeek(week, prefs, { withRecap: false });
  assert.deepEqual(a.games, b.games);
});

test('beide pakketten worden altijd berekend', () => {
  const both = planBoth(week, prefs);
  assert.equal(both.a.summary.package, 'A');
  assert.equal(both.b.summary.package, 'B');
});

test('elke wedstrijd krijgt een advies, ook overslaan', () => {
  const plan = planWeek(week, prefs, { withRecap: false });
  assert.equal(plan.games.length, week.length);
  for (const p of plan.games) {
    assert.ok(['full', 'game_in_40', 'skip'].includes(p.format_advice));
    assert.ok(p.format_reason);
  }
});
