import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextChips } from '../web/src/lib/chips.js';

const game = (extra = {}) => ({
  kickoff_utc: '2026-09-15T00:15:00.000Z',
  week: 1,
  is_international: false,
  game_type: 'conference',
  tags: [],
  ...extra,
});

test('een kaart toont maximaal drie contextchips in vaste prioriteit', () => {
  const chips = contextChips(game({
    kickoff_utc: '2026-11-23T01:20:00.000Z',
    week: 11,
    is_international: true,
    game_type: 'division',
    tags: ['own_team', 'internationaal'],
  }), { rank: 1, next: true });

  assert.deepEqual(chips.map((chip) => chip.label), ['Volgende', 'Favoriet #1', 'Internationaal']);
});

test('MNF staat specifiek op de kaart in plaats van primetime', () => {
  assert.deepEqual(contextChips(game()).map((chip) => chip.label), ['MNF']);
});

test('Thanksgivingmiddag krijgt geen TNF-chip', () => {
  const chips = contextChips(game({
    kickoff_utc: '2026-11-26T18:00:00.000Z',
    week: 12,
  }));
  assert.deepEqual(chips.map((chip) => chip.label), ['Thanksgiving']);
});

test('de late Thanksgivingwedstrijd mag ook TNF heten', () => {
  const chips = contextChips(game({
    kickoff_utc: '2026-11-27T01:20:00.000Z',
    week: 12,
  }));
  assert.deepEqual(chips.map((chip) => chip.label), ['Thanksgiving', 'TNF']);
});

test('een reguliere zondag gebruikt alleen inhoudelijke chips', () => {
  const chips = contextChips(game({
    kickoff_utc: '2026-09-13T17:00:00.000Z',
    game_type: 'division',
  }));
  assert.deepEqual(chips.map((chip) => chip.label), ['Divisieduel']);
});
