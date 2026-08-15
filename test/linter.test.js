// The spoiler linter. Every entry in LEAKS is a teaser that must be rejected;
// every entry in SAFE must pass. These are the tests that decide whether the
// teaser feature can ship at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintTeaser, playerNamesFromPlays, MAX_WORDS } from '../src/linter.js';
import { teaserFor, FALLBACK } from '../src/teasers.js';

const PLAYERS = ['Gonzalez', 'Mahomes', 'Goff', 'McCullough', 'Pinion', 'Myers'];

// --- Leak examples ------------------------------------------------------------
// Each case names the rule it is expected to trip, so a regression that silences
// one rule cannot hide behind another still firing.

const LEAKS = [
  // Outcome, stated outright
  ['De Chiefs wonnen dit duel overtuigend.', 'spoiler_word'],
  ['Kansas City verloor thuis van Houston.', 'spoiler_word'],
  ['Detroit versloeg Dallas op Thanksgiving.', 'spoiler_word'],
  ['Een klinkende zege voor de bezoekers.', 'spoiler_word'],
  ['De thuisploeg ging hier onderuit.', 'spoiler_word'],
  ['Een verrassende winnaar in deze divisiewedstrijd.', 'spoiler_word'],

  // Scores and other digits
  ['Eindstand na een lange middag football.', 'spoiler_word'],
  ['Beide ploegen kwamen tot boven de 30 punten.', 'digits'],
  ['Seattle staat na deze week op 10-3.', 'digits'],
  ['Een field goal in de slotseconde besliste alles.', 'spoiler_word'],
  ['De stand bleef lang gelijk in het vierde kwart.', 'spoiler_word'],

  // Shape of the game, forbidden at level 1
  ['Een absolute thriller tot de laatste snap.', 'spoiler_word'],
  ['Een complete blowout, al vroeg beslist.', 'spoiler_word'],
  ['De grootste upset van het hele seizoen.', 'spoiler_word'],
  ['Een shootout waarin de defensies ontbraken.', 'spoiler_word'],
  ['Een spectaculaire comeback na rust.', 'spoiler_word'],
  ['Dit duel ging pas in de verlenging beslist.', 'spoiler_word'],
  ['Een kansloze vertoning van de bezoekers.', 'spoiler_word'],
  ['Twee ploegen leverden een razend spannend duel.', 'spoiler_word'],
  ['De thuisploeg domineerde van begin tot eind.', 'spoiler_word'],

  // Players who actually appeared in the game
  ['Mahomes speelde een hoofdrol in dit duel.', 'player_name'],
  ['Alles draaide om Goff in het vierde kwart.', 'player_name'],
  ['Gonzalez was bepalend vanaf de zijlijn.', 'player_name'],

  // Events that imply a score
  ['Een interceptie brak dit duel helemaal open.', 'spoiler_word'],
  ['Een pick six halverwege het derde kwart.', 'spoiler_word'],
  ['De turnover was het omslagpunt van de middag.', 'spoiler_word'],

  // Standings consequences
  ['Met dit resultaat is Detroit uitgeschakeld.', 'spoiler_word'],
  ['De Chiefs plaatste zich hiermee voor de play-offs.', 'spoiler_word'],

  // Length
  ['Dit is een veel te lange teaser die ruim over de vijftien woorden heen gaat en dus hoort te falen.', 'max_words'],
];

test(`de linter betrapt alle ${LEAKS.length} lekvoorbeelden`, () => {
  for (const [text, expectedRule] of LEAKS) {
    const result = lintTeaser(text, { playerNames: PLAYERS });
    assert.equal(result.ok, false, `niet betrapt: "${text}"`);
    const rules = result.violations.map((v) => v.rule);
    assert.ok(
      rules.includes(expectedRule),
      `"${text}" betrapt op ${rules.join(', ')}, verwacht ${expectedRule}`,
    );
  }
});

test('er zijn minstens 20 lekvoorbeelden', () => {
  assert.ok(LEAKS.length >= 20, `slechts ${LEAKS.length} voorbeelden`);
});

// --- Safe examples ------------------------------------------------------------

const SAFE = [
  'Divisieduel in de NFC North, deze twee treffen elkaar elk seizoen tweemaal.',
  'Beide ploegen jagen nog volop op een plek in de play-offs.',
  'AFC tegen NFC, deze twee ploegen treffen elkaar zelden.',
  'Overzees duel in Londen, hier gewoon op een normaal tijdstip te kijken.',
  'Twee ploegen met een winnend record komen elkaar tegen.',
  'Sunday Night: KC op bezoek bij NYG.',
  'SF op bezoek bij ARI.',
  'Twee ploegen die de aansluiting naar boven kwijt zijn.',
];

test('veilige teasers komen er ongeschonden doorheen', () => {
  for (const text of SAFE) {
    const result = lintTeaser(text, { playerNames: PLAYERS });
    assert.ok(
      result.ok,
      `onterecht afgekeurd: "${text}" -> ${JSON.stringify(result.violations)}`,
    );
  }
});

test('49ers is de enige toegestane uitzondering op de cijferregel', () => {
  assert.ok(lintTeaser('De 49ers op bezoek bij de Rams.', {}).ok);
  assert.equal(lintTeaser('De 12ers op bezoek bij de Rams.', {}).ok, false);
});

test('hoofdletters en accenten omzeilen de blocklist niet', () => {
  for (const text of ['De Chiefs WONNEN dit duel.', 'Een échte thriller.', 'BLOWOUT in Denver.']) {
    assert.equal(lintTeaser(text, {}).ok, false, `niet betrapt: ${text}`);
  }
});

test('nederlandse verbuigingen ontsnappen niet', () => {
  // The exact-token list only knows the base form; the stem list catches the
  // inflected ones. "kansloos" -> "kansloze" was a real miss.
  const inflected = [
    'Een kansloze vertoning van de bezoekers.',
    'Een spannende slotfase in Detroit.',
    'Een spectaculaire middag in Denver.',
    'Een dramatische wending in Cleveland.',
    'De thuisploeg overklaste de bezoekers.',
  ];
  for (const text of inflected) {
    assert.equal(lintTeaser(text, {}).ok, false, `niet betrapt: ${text}`);
  }
});

test('een deelwoord in een langer woord is geen valse treffer', () => {
  // "win" must not fire on "winter", "winnend" is a separate listed word.
  const r = lintTeaser('Een duel in de winterse kou van Green Bay.', {});
  assert.ok(r.ok, JSON.stringify(r.violations));
});

test('lege of ontbrekende tekst faalt', () => {
  for (const bad of ['', '   ', null, undefined, 42]) {
    assert.equal(lintTeaser(bad, {}).ok, false);
  }
});

test('de woordlimiet zit op 15', () => {
  const fifteen = Array.from({ length: MAX_WORDS }, () => 'woord').join(' ');
  assert.ok(lintTeaser(fifteen, {}).ok);
  assert.equal(lintTeaser(`${fifteen} extra`, {}).ok, false);
});

// --- Name extraction ----------------------------------------------------------

test('achternamen worden uit de play-by-play gehaald', () => {
  const doc = {
    items: [
      { text: ' Z.Gonzalez 35 yard field goal is GOOD, Center-L.McCullough, Holder-B.Pinion.' },
      { text: 'P.Mahomes pass complete to T.Kelce for 12 yards.' },
    ],
  };
  const names = playerNamesFromPlays(doc);
  for (const expected of ['Gonzalez', 'McCullough', 'Pinion', 'Mahomes', 'Kelce']) {
    assert.ok(names.includes(expected), `${expected} ontbreekt in ${names.join(', ')}`);
  }
});

// --- Teaser generation --------------------------------------------------------

const baseGame = {
  home: { abbr: 'DET', name: 'Detroit Lions', conference: 'NFC', division: 'NFC North' },
  away: { abbr: 'GB', name: 'Green Bay Packers', conference: 'NFC', division: 'NFC North' },
  records_before: { home: '7-5', away: '8-4' },
  game_type: 'division',
  primetime: false,
  slot: 'Sunday early',
  stakes_pre: 3,
  is_international: false,
  live_friendly_nl: true,
  venue: 'Detroit',
};

test('elke gegenereerde teaser is schoon en kort genoeg', () => {
  const variants = [
    baseGame,
    { ...baseGame, game_type: 'interconference', stakes_pre: 5 },
    { ...baseGame, is_international: true, venue: 'London' },
    { ...baseGame, is_international: true, live_friendly_nl: false, venue: 'Sao Paulo' },
    { ...baseGame, primetime: true, slot: 'Monday Night' },
    { ...baseGame, records_before: { home: '2-10', away: '3-9' }, stakes_pre: 1, game_type: 'conference' },
    { ...baseGame, records_before: { home: null, away: null }, game_type: 'conference', stakes_pre: null },
  ];
  for (const g of variants) {
    const { teaser } = teaserFor(g, { playerNames: PLAYERS });
    assert.ok(teaser, `geen teaser voor ${JSON.stringify(g.records_before)}`);
    const check = lintTeaser(teaser, { playerNames: PLAYERS });
    assert.ok(check.ok, `"${teaser}" -> ${JSON.stringify(check.violations)}`);
  }
});

test('de fallback is altijd veilig, ook voor de 49ers', () => {
  const g = { ...baseGame, home: { abbr: 'SF', name: 'San Francisco 49ers' }, away: { abbr: 'SEA' } };
  assert.ok(lintTeaser(FALLBACK(g), {}).ok);
});

test('een teaser die een speler noemt wordt niet gepubliceerd', () => {
  // Simulates a template that would name someone from this game.
  const poisoned = 'Alles draaide om Mahomes in dit duel.';
  assert.equal(lintTeaser(poisoned, { playerNames: PLAYERS }).ok, false);
});

test('teasergeneratie is deterministisch', () => {
  const a = teaserFor({ ...baseGame, game_id: '401772900' }, { playerNames: PLAYERS });
  const b = teaserFor({ ...baseGame, game_id: '401772900' }, { playerNames: PLAYERS });
  assert.deepEqual(a, b);
});

test('gelijksoortige wedstrijden krijgen niet allemaal dezelfde zin', () => {
  // Week 18 is entirely division games with high stakes, so without variants
  // every row on the page read identically.
  const ids = ['401772900', '401772901', '401772902', '401772903', '401772910', '401772933'];
  const teasers = ids.map(
    (game_id) => teaserFor({ ...baseGame, game_id, stakes_pre: 5 }, { playerNames: PLAYERS }).teaser,
  );
  const unique = new Set(teasers);
  assert.ok(unique.size >= 3, `slechts ${unique.size} verschillende zinnen: ${[...unique].join(' | ')}`);
  for (const t of teasers) {
    assert.ok(lintTeaser(t, { playerNames: PLAYERS }).ok, `variant lekt: ${t}`);
  }
});
