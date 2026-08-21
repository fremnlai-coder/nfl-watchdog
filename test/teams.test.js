// De teamgids langs dezelfde lat als de wedstrijddata.
//
// De gids komt uit drie ESPN-payloads die alle drie uitslagen dragen: team.record
// (met W-L én gemiddelde punten), roster.team.seasonSummary, en de rostergroep
// injuredReserveOrOut. src/teams.js plukt eruit in plaats van te spreaden; deze
// test controleert dat het geplukte ook echt schoon is, en scant daarnaast het
// gepubliceerde bestand zelf.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keyPlayers, rosterFacts, buildPublicTeam } from '../src/teams.js';

const ROOT = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('config/preferences.json', ROOT), 'utf8'));
const guide = JSON.parse(
  await readFile(new URL(`data/public/${config.season}/teams.json`, ROOT), 'utf8'),
);

// --- het gepubliceerde bestand ---------------------------------------------

test('alle 32 teams staan erin, met coach en opstelling', () => {
  assert.equal(Object.keys(guide.teams).length, 32);
  for (const team of config.teams) {
    const doc = guide.teams[team.abbr];
    assert.ok(doc, `${team.abbr} ontbreekt`);
    assert.ok(doc.coach?.name, `${team.abbr} heeft geen coach`);
    assert.ok(doc.venue?.name, `${team.abbr} heeft geen stadion`);
    assert.ok(doc.key_players.length >= 8, `${team.abbr} heeft ${doc.key_players.length} spelers`);
  }
});

test('elke linie komt aan bod, niet vier keer dezelfde', () => {
  for (const [abbr, doc] of Object.entries(guide.teams)) {
    const sides = new Set(doc.key_players.map((p) => p.side));
    assert.ok(sides.has('offense'), `${abbr} zonder aanval`);
    assert.ok(sides.has('defense'), `${abbr} zonder verdediging`);

    const names = doc.key_players.map((p) => p.name);
    assert.equal(new Set(names).size, names.length, `${abbr} noemt iemand twee keer`);
  }
});

test('geen veld in de gids gaat over hoe het afliep', () => {
  // Woorden die in de ruwe payloads wél voorkomen. Verschijnt er ooit een van
  // deze sleutels in het publieke bestand, dan is er iets gespreid in plaats van
  // geplukt.
  const forbidden = [
    'record', 'summary', 'seasonSummary', 'stats', 'statistics', 'wins', 'losses',
    'standing', 'standingSummary', 'score', 'status', 'injuries', 'injury',
    'streak', 'playoffSeed', 'rank',
  ];

  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        assert.ok(!forbidden.includes(key), `${path}.${key} hoort hier niet te staan`);
        walk(value, `${path}.${key}`);
      }
    }
  };
  walk(guide, 'teams.json');
});

test('nergens staat iets dat op een W-L-stand lijkt', () => {
  // De vorm 12-5 is hoe ESPN een record schrijft. Rugnummers en jaartallen
  // hebben dat streepje niet, dus elke treffer is verdacht.
  const blob = JSON.stringify(guide);
  const hits = blob.match(/"[^"]*\b\d{1,2}-\d{1,2}\b[^"]*"/g) ?? [];
  assert.deepEqual(hits, [], `verdachte waarden: ${hits.slice(0, 5).join(', ')}`);
});

test('de gids draagt geen enkel getal dat een prestatie kan zijn', () => {
  // Wat wél mag: rugnummer, leeftijd, dienstjaren, aantallen uit de selectie.
  const allowed = new Set([
    'players', 'rookies', 'average_age', 'age', 'experience_years', 'season',
  ]);
  const walk = (node, key, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, key, `${path}[${i}]`));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, k, `${path}.${k}`);
      return;
    }
    if (typeof node === 'number') {
      assert.ok(allowed.has(key), `${path} is een getal (${node}) dat niet op de lijst staat`);
    }
  };
  walk(guide, null, 'teams.json');
});

// --- de bouwstenen zelf, tegen een payload die precies de vuile velden draagt -

const ROSTER = {
  coach: [{ firstName: 'Andy', lastName: 'Reid', experience: 27 }],
  team: { abbreviation: 'KC', seasonSummary: '13-4' },
  athletes: [
    {
      position: 'offense',
      items: [
        { id: '1', fullName: 'Patrick Mahomes', jersey: '15', age: 30, experience: { years: 10 }, college: { name: 'Texas Tech' }, status: { name: 'Active' }, injuries: [] },
        { id: '2', fullName: 'Travis Kelce', jersey: '87', age: 36, experience: { years: 14 }, college: { name: 'Cincinnati' } },
      ],
    },
    {
      position: 'defense',
      items: [{ id: '3', fullName: 'Chris Jones', jersey: '95', age: 32, experience: { years: 11 }, college: { name: 'Mississippi State' } }],
    },
    {
      // Deze groep mag nergens terugkomen: wie hier staat, raakte geblesseerd in
      // een wedstrijd die de gebruiker misschien nog moet kijken.
      position: 'injuredReserveOrOut',
      items: [{ id: '4', fullName: 'Rashee Rice', jersey: '4', age: 26, experience: { years: 4 } }],
    },
    { position: 'practiceSquad', items: [{ id: '5', fullName: 'Iemand Anders', age: 24, experience: { years: 0 } }] },
  ],
};

const ref = (id) => ({ athlete: { $ref: `http://x/athletes/${id}?lang=en` }, rank: 1 });

const DEPTH = {
  items: [
    {
      name: '3WR 1TE',
      positions: {
        qb: { position: { abbreviation: 'QB' }, athletes: [ref('1')] },
        te: { position: { abbreviation: 'TE' }, athletes: [ref('2')] },
      },
    },
    {
      name: 'Base 4-3 D',
      positions: {
        ldt: { position: { abbreviation: 'DT' }, athletes: [ref('3')] },
        // Verwijst naar de speler op IR; die staat niet in de index en hoort
        // dus over te slaan in plaats van de gids te laten struikelen.
        lde: { position: { abbreviation: 'DE' }, athletes: [ref('4')] },
      },
    },
  ],
};

test('een speler op IR komt niet in de opstelling', () => {
  const players = keyPlayers(DEPTH, ROSTER);
  const names = players.map((p) => p.name);
  assert.ok(names.includes('Patrick Mahomes'));
  assert.ok(!names.includes('Rashee Rice'), 'speler uit injuredReserveOrOut staat in de gids');
});

test('status en blessures worden niet overgenomen', () => {
  const blob = JSON.stringify(keyPlayers(DEPTH, ROSTER));
  assert.ok(!blob.includes('status'));
  assert.ok(!blob.includes('injur'));
  assert.ok(!blob.includes('Active'));
});

test('de feiten tellen alleen wie er speelt', () => {
  const facts = rosterFacts(ROSTER);
  // Drie spelers: IR en practice squad tellen niet mee.
  assert.equal(facts.players, 3);
  assert.equal(facts.rookies, 0);
  assert.equal(facts.average_age, 32.7);
});

test('seasonSummary en record halen de publieke gids niet', () => {
  const doc = buildPublicTeam({
    profile: {
      team: {
        location: 'Kansas City',
        nickname: 'Chiefs',
        color: 'e31837',
        alternateColor: 'ffb612',
        record: { items: [{ type: 'total', summary: '13-4', stats: [{ name: 'avgPointsFor', value: 29.2 }] }] },
        franchise: { venue: { fullName: 'Arrowhead Stadium', address: { city: 'Kansas City', state: 'MO' }, indoor: false } },
      },
    },
    roster: ROSTER,
    depth: DEPTH,
    config: { abbr: 'KC', name: 'Kansas City Chiefs', conference: 'AFC', division: 'AFC West' },
  });

  const blob = JSON.stringify(doc);
  assert.ok(!blob.includes('13-4'), 'het record lekt mee');
  assert.ok(!blob.includes('29.2'), 'gemiddelde punten lekken mee');
  assert.equal(doc.coach.name, 'Andy Reid');
  assert.equal(doc.venue.name, 'Arrowhead Stadium');
});
