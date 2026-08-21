// The "waarom?" panel explains the pick, not the game. That distinction is the
// whole reason it is safe to put on the card at level 0, so it gets tested
// against every real game of the season rather than a handful of fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { explainPick } from '../src/explain.js';

const ROOT = new URL('../', import.meta.url);
const weeks = [];
for (const f of (await readdir(new URL('data/public/2025/', ROOT))).filter((x) => /^week-\d+\.json$/.test(x))) {
  weeks.push(JSON.parse(await readFile(new URL(`data/public/2025/${f}`, ROOT), 'utf8')));
}

const allGames = weeks.flatMap((w) => w.games);

test('er is een seizoen om tegen te testen', () => {
  assert.equal(allGames.length, 272);
});

test('elke wedstrijd krijgt minstens één reden', () => {
  for (const g of allGames) {
    const { reasons } = explainPick(g, { rank: 1 });
    assert.ok(reasons.length > 0, `${g.game_id} kreeg geen enkele reden`);
  }
});

test('de uitleg zegt nooit iets over het verloop of de uitslag', () => {
  // Deliberately narrow: these are the words that would turn an explanation of
  // the pick into a verdict on the game.
  const forbidden = [
    'won', 'wonnen', 'gewonnen', 'winnaar', 'verloor', 'verloren', 'nederlaag',
    'eindstand', 'uitslag', 'spannend', 'thriller', 'blowout', 'comeback',
    'overtime', 'verlenging', 'touchdown', 'omslagpunt', 'kwart', 'slotfase',
    'scoorde', 'punten voorsprong', 'achterstand',
  ];
  for (const g of allGames) {
    const { reasons, caveat } = explainPick(g, { rank: 2 });
    const text = [...reasons, caveat].join(' ').toLowerCase();
    for (const word of forbidden) {
      assert.ok(
        !new RegExp(`\\b${word}\\b`).test(text),
        `${g.game_id}: "${word}" staat in de uitleg — "${text}"`,
      );
    }
  }
});

test('de uitleg is deterministisch', () => {
  const g = allGames[0];
  assert.deepEqual(explainPick(g, { rank: 1 }), explainPick(g, { rank: 1 }));
});

test('het voorbehoud staat er altijd bij', () => {
  for (const g of allGames.slice(0, 40)) {
    const { caveat } = explainPick(g, {});
    assert.ok(caveat.includes('niet over hoe de wedstrijd verliep'));
  }
});

test('de rang wordt alleen genoemd bij een eigen team', () => {
  for (const g of allGames) {
    if (g.tags.includes('own_team')) continue;
    const { reasons } = explainPick(g, { rank: 3 });
    assert.ok(
      !reasons.some((r) => r.includes('je nummer')),
      `${g.game_id} is geen eigen team maar noemt wel een voorkeursrang`,
    );
  }
});

test('overgeslagen wedstrijden leggen uit waaróm ze afvielen', () => {
  const skipped = allGames.filter((g) => g.format_advice === 'skip');
  assert.ok(skipped.length > 100, 'verwacht veel overgeslagen wedstrijden');
  for (const g of skipped.slice(0, 50)) {
    const { reasons } = explainPick(g, {});
    assert.ok(
      reasons.some((r) => /weekvorm|budget|nooit-lijst/.test(r)),
      `${g.game_id} legt niet uit waarom hij afviel`,
    );
  }
});
