// One sentence per game, at most 15 words, built from level 0 and level 1 fields
// only. No model, no play-by-play, no score: templates are filled from the
// schedule, the records carried into the week and the pre-game stakes.
//
// Conditions are evaluated in priority order. The first condition that matches
// and produces a teaser the linter accepts wins. Within that condition a
// phrasing is picked by hashing the game id, because week 18 is entirely
// division games and without variants every row reads identically.
//
// Every candidate is linted before it is accepted. If all of them fail, the
// hard fallback is used: it names the two teams and nothing else.

import { lintTeaser } from './linter.js';

// Records are level 0, but their digits are not allowed in a teaser, so they are
// reduced to a direction first.
function recordShape(record) {
  const [w, l] = String(record ?? '').split('-').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(l)) return 'unknown';
  if (w > l) return 'winning';
  if (l > w) return 'losing';
  return 'even';
}

// Deterministic, so the same game always gets the same phrasing across runs.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Each entry is one condition with interchangeable phrasings.
function conditions(game) {
  const home = game.home?.name ?? game.home?.abbr ?? 'de thuisploeg';
  const away = game.away?.name ?? game.away?.abbr ?? 'de bezoekers';
  const division = game.home?.division ?? '';
  const conference = game.home?.conference ?? '';
  const venue = game.venue ?? 'het buitenland';
  const slot = game.slot ?? '';
  const both = [recordShape(game.records_before?.home), recordShape(game.records_before?.away)];
  const bothWinning = both.every((s) => s === 'winning');
  const bothLosing = both.every((s) => s === 'losing');
  const mixed = both.includes('winning') && both.includes('losing');
  const highStakes = (game.stakes_pre ?? 0) >= 4;
  const lowStakes = (game.stakes_pre ?? 0) <= 2;

  const out = [];

  if (game.is_international && game.live_friendly_nl) {
    out.push([
      `Overzees duel in ${venue}, hier gewoon op een normaal tijdstip te kijken.`,
      `Een van de weinige wedstrijden die je hier bij daglicht kunt volgen: ${venue}.`,
      `${venue} als speelstad, en dus een aftrap die hier prima uitkomt.`,
    ]);
  }
  if (game.is_international && !game.live_friendly_nl) {
    out.push([
      `Overzees duel in ${venue}, maar midden in de nacht Nederlandse tijd.`,
      `Gespeeld in ${venue}, op een tijdstip dat hier niemand wakker houdt.`,
    ]);
  }
  if (highStakes && game.game_type === 'division') {
    out.push([
      `Divisieduel in de ${division} met veel op het spel voor beide ploegen.`,
      `Onderlinge strijd in de ${division}, en allebei hebben ze het nodig.`,
      `${division}-duel waar beide ploegen niet omheen kunnen.`,
      `Twee ploegen uit de ${division} die elkaar dit jaar niets gunnen.`,
    ]);
  }
  if (highStakes) {
    out.push([
      'Beide ploegen jagen nog volop op een plek in de play-offs.',
      'Voor allebei telt deze wedstrijd zwaar mee in het eindklassement.',
      'Twee ploegen die zich in deze fase geen misstap kunnen permitteren.',
    ]);
  }
  if (game.game_type === 'division' && bothWinning) {
    out.push([
      `Divisieduel in de ${division} tussen twee ploegen met een winnend record.`,
      `Beide ploegen staan er goed voor, en het is een ${division}-duel.`,
    ]);
  }
  if (game.game_type === 'division') {
    out.push([
      `Divisieduel in de ${division}, deze twee treffen elkaar elk seizoen tweemaal.`,
      `Bekende tegenstanders: ${division}, twee keer per jaar op het programma.`,
      `Onderling duel binnen de ${division}.`,
    ]);
  }
  if (game.primetime && bothWinning) {
    out.push([
      `${slot} tussen twee ploegen die allebei aan de goede kant staan.`,
      `${slot}, en allebei komen ze met een winnend record aan de aftrap.`,
    ]);
  }
  if (game.primetime) {
    out.push([
      `${slot}: ${away} op bezoek bij ${home}.`,
      `${slot} met ${away} als bezoeker.`,
    ]);
  }
  if (bothWinning) {
    out.push([
      'Twee ploegen met een winnend record komen elkaar tegen.',
      'Allebei staan ze aan de goede kant van de streep.',
    ]);
  }
  if (bothLosing && lowStakes) {
    out.push([
      'Twee ploegen die de aansluiting naar boven kwijt zijn.',
      'Voor geen van beide ploegen valt er nog veel te halen.',
    ]);
  }
  if (game.game_type === 'interconference') {
    out.push([
      'AFC tegen NFC, deze twee ploegen treffen elkaar zelden.',
      'Een ontmoeting tussen de conferences, en dus een zeldzame.',
    ]);
  }
  if (game.game_type === 'conference' && conference) {
    out.push([
      `Duel binnen de ${conference}, twee ploegen uit verschillende divisies.`,
      `${conference}-onderonsje tussen twee ploegen uit andere divisies.`,
    ]);
  }
  if (mixed) {
    out.push([
      'Een ploeg met een winnend record tegen een die achterloopt.',
      'De een staat er duidelijk beter voor dan de ander.',
    ]);
  }

  return out;
}

export const FALLBACK = (game) =>
  `${game.away?.abbr ?? 'Uit'} op bezoek bij ${game.home?.abbr ?? 'thuis'}.`;

/**
 * @param {object} game public-shaped game (level 0 and 1 fields only)
 * @param {{playerNames?: string[]}} [opts]
 * @returns {{teaser: string|null, source: 'template'|'fallback'}}
 */
export function teaserFor(game, opts = {}) {
  const seed = hash(String(game.game_id ?? ''));
  for (const variants of conditions(game)) {
    const clean = variants.filter((v) => lintTeaser(v, opts).ok);
    if (clean.length) {
      return { teaser: clean[seed % clean.length], source: 'template' };
    }
  }
  const fallback = FALLBACK(game);
  // The fallback is linted too. If even that fails, the game gets no teaser at
  // all rather than an unchecked one.
  return lintTeaser(fallback, opts).ok
    ? { teaser: fallback, source: 'fallback' }
    : { teaser: null, source: 'fallback' };
}
