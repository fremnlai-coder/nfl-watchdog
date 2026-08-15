// Checks the public payload against the private ground truth for the whole
// season. This is the machine-checkable form of the acceptance criterion "I can
// scroll the week overview for five minutes and still not know who won".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assertPublicShape, PUBLIC_KEYS } from '../src/schema.js';
import { lintTeaser } from '../src/linter.js';

const ROOT = new URL('../', import.meta.url);

const weekNumbers = (await readdir(new URL('data/public/', ROOT)))
  .map((f) => /^week-(\d+)\.json$/.exec(f)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);

const readJson = async (p) => JSON.parse(await readFile(new URL(p, ROOT), 'utf8'));

const weeks = [];
for (const n of weekNumbers) {
  weeks.push({
    n,
    pub: await readJson(`data/public/week-${n}.json`),
    results: await readJson(`data/private/week-${n}.results.json`),
  });
}

test('er is een seizoen om tegen te testen', () => {
  assert.ok(weeks.length >= 18, `verwacht 18 weken, kreeg ${weeks.length}`);
  const games = weeks.reduce((s, w) => s + w.pub.games.length, 0);
  assert.equal(games, 272);
});

test('elk publiek veld staat op de allowlist', () => {
  for (const { n, pub } of weeks) {
    for (const g of pub.games) assertPublicShape(g, `week ${n} game ${g.game_id}`);
  }
});

test('geen eindstand in de publieke payload', () => {
  for (const { n, pub, results } of weeks) {
    const blob = JSON.stringify(pub);
    for (const [id, r] of Object.entries(results)) {
      assert.ok(
        !blob.includes(r.score_line),
        `week ${n}: scoreregel "${r.score_line}" lekt in de publieke payload`,
      );
      const pair = `${r.final_score.away}-${r.final_score.home}`;
      const reverse = `${r.final_score.home}-${r.final_score.away}`;
      const game = pub.games.find((g) => g.game_id === id);
      const gameBlob = JSON.stringify(game);
      // Records legitimately look like "8-4", so only flag a score pair when it
      // is not one of the two records carried into the game.
      const legitimate = new Set([
        game.records_before.home,
        game.records_before.away,
      ]);
      for (const p of [pair, reverse]) {
        if (legitimate.has(p)) continue;
        assert.ok(
          !gameBlob.includes(`"${p}"`),
          `week ${n} game ${id}: uitslagpatroon "${p}" lekt`,
        );
      }
    }
  }
});

test('records zijn die van vóór de wedstrijd, niet erna', () => {
  for (const { n, pub, results } of weeks) {
    for (const g of pub.games) {
      const r = results[g.game_id];
      if (!r || !r.records_after.home) continue;
      // A completed game always moves both records, so equality means the
      // public file is carrying the post-game standing.
      assert.notEqual(
        g.records_before.home,
        r.records_after.home,
        `week ${n} game ${g.game_id}: thuisrecord is dat van ná de wedstrijd`,
      );
      assert.notEqual(
        g.records_before.away,
        r.records_after.away,
        `week ${n} game ${g.game_id}: uitrecord is dat van ná de wedstrijd`,
      );
    }
  }
});

test('geen ruwe metrics of percentielen publiek', () => {
  const forbidden = [
    'excitement', 'tension', 'volatility', 'pace', 'percentile',
    'composite', 'winner', 'final_score', 'score', 'homeScore', 'awayScore',
    'records_after', 'headline', 'highlight', 'leaders',
  ];
  for (const { n, pub } of weeks) {
    const blob = JSON.stringify(pub);
    for (const word of forbidden) {
      assert.ok(!blob.includes(word), `week ${n}: verboden term "${word}" in publieke payload`);
    }
  }
});

test('eigen teams tonen geen rating', () => {
  for (const { n, pub } of weeks) {
    for (const g of pub.games) {
      if (!g.tags.includes('own_team')) continue;
      assert.equal(g.watchability, null, `week ${n} game ${g.game_id}: eigen team heeft een rating`);
    }
  }
});

test('watchability blijft binnen 1-5 en lekt niets buiten die schaal', () => {
  for (const { pub } of weeks) {
    for (const g of pub.games) {
      if (g.watchability === null) continue;
      assert.ok(Number.isInteger(g.watchability));
      assert.ok(g.watchability >= 1 && g.watchability <= 5);
    }
  }
});

test('een rating van 1 komt alleen voor bij lage inzet vooraf', async () => {
  // The compression that stops a 1 from meaning "blowout". A 1 must always be
  // explainable by pre-game stakes, which is level 0 information.
  for (const { n, pub, results } of weeks) {
    for (const g of pub.games) {
      if (g.watchability !== 1) continue;
      const p = results[g.game_id]?.percentiles;
      if (!p) continue;
      assert.ok(
        p.stakes < 0.35,
        `week ${n} game ${g.game_id}: rating 1 bij stakes-percentiel ${p.stakes}`,
      );
    }
  }
});

test('de rating voorspelt de winnaar niet', () => {
  // This is the acceptance criterion in its measurable form. The rating does
  // correlate with the final margin — it measures how close a game stayed — but
  // it must carry no information about *which* side won. If highly rated games
  // skewed towards home or away wins, the rating would be a partial spoiler.
  const buckets = new Map();
  for (const { pub, results } of weeks) {
    for (const g of pub.games) {
      const r = results[g.game_id];
      if (!r || g.watchability == null || r.winner === 'TIE') continue;
      const b = buckets.get(g.watchability) ?? { home: 0, away: 0 };
      if (r.winner === g.home.abbr) b.home++;
      else b.away++;
      buckets.set(g.watchability, b);
    }
  }
  for (const [rating, b] of buckets) {
    const n = b.home + b.away;
    if (n < 20) continue; // too few to say anything
    const share = b.home / n;
    assert.ok(
      share > 0.3 && share < 0.7,
      `rating ${rating}: ${(share * 100).toFixed(0)}% thuiswinst over ${n} wedstrijden — de rating stuurt richting uitkomst`,
    );
  }
});

test('internationaal betekent niet automatisch overdag hier', () => {
  // Sao Paulo 2025 kicked off at 02:00 Dutch time; 2026 adds Melbourne and Rio.
  // The International slot may only be used when it is actually watchable here.
  for (const { n, pub } of weeks) {
    for (const g of pub.games) {
      if (g.slot !== 'International') continue;
      assert.equal(
        g.live_friendly_nl,
        true,
        `week ${n} game ${g.game_id}: International-slot om ${g.kickoff_nl}`,
      );
    }
  }
});

test('elke gepubliceerde teaser overleeft de linter tegen de echte spelers', () => {
  // End-to-end: the teaser as actually shipped, checked against the surnames of
  // everyone who appeared in that specific game.
  let checked = 0;
  for (const { n, pub, results } of weeks) {
    for (const g of pub.games) {
      if (!g.teaser) continue;
      const names = results[g.game_id]?.player_names ?? [];
      const verdict = lintTeaser(g.teaser, { playerNames: names });
      assert.ok(
        verdict.ok,
        `week ${n} game ${g.game_id}: "${g.teaser}" -> ${JSON.stringify(verdict.violations)}`,
      );
      checked++;
    }
  }
  assert.ok(checked > 250, `slechts ${checked} teasers gecontroleerd`);
});

test('elke wedstrijd heeft een teaser', () => {
  for (const { n, pub } of weeks) {
    for (const g of pub.games) {
      assert.ok(g.teaser, `week ${n} game ${g.game_id} heeft geen teaser`);
      assert.ok(g.teaser.length < 120, `teaser te lang: ${g.teaser}`);
    }
  }
});

test('de allowlist bevat geen uitkomstvelden', () => {
  for (const key of PUBLIC_KEYS) {
    assert.ok(
      !/score|winner|result|final|record_after/i.test(key) || key === 'records_before',
      `allowlist bevat verdacht veld "${key}"`,
    );
  }
});

test('tijdzone: het verschil met New York is niet vastgezet op 6 uur', () => {
  // The EU moves to winter time a week before the US does. In that window the
  // gap is 5 hours, and a hardcoded offset would be an hour wrong all week.
  const offsets = new Set(weeks.map((w) => w.pub.nl_et_offset_hours));
  assert.ok(offsets.has(6), 'verwacht weken met 6 uur verschil');
  assert.ok(offsets.has(5), `verwacht minstens één week met 5 uur verschil, kreeg ${[...offsets]}`);
});
