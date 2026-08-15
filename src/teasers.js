// One sentence per game, at most 15 words, built from level 0 and level 1 fields
// only. No model, no play-by-play, no score: templates are filled from the
// schedule, the records carried into the week and the pre-game stakes.
//
// Every candidate is linted before it is accepted. The first one that passes
// wins; if all of them fail, the hard fallback is used. The fallback names the
// two teams and nothing else, so it cannot leak.

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

function candidates(game) {
  const home = game.home?.name ?? game.home?.abbr ?? 'de thuisploeg';
  const away = game.away?.name ?? game.away?.abbr ?? 'de bezoekers';
  const division = game.home?.division ?? '';
  const venue = game.venue ?? 'het buitenland';
  const slot = game.slot ?? '';
  const both = [recordShape(game.records_before?.home), recordShape(game.records_before?.away)];
  const bothWinning = both.every((s) => s === 'winning');
  const bothLosing = both.every((s) => s === 'losing');
  const highStakes = (game.stakes_pre ?? 0) >= 4;
  const lowStakes = (game.stakes_pre ?? 0) <= 2;

  const out = [];

  if (game.is_international && game.live_friendly_nl) {
    out.push(`Overzees duel in ${venue}, hier gewoon op een normaal tijdstip te kijken.`);
  }
  if (game.is_international && !game.live_friendly_nl) {
    out.push(`Overzees duel in ${venue}, maar midden in de nacht Nederlandse tijd.`);
  }
  if (highStakes && game.game_type === 'division') {
    out.push(`Divisieduel in de ${division} met veel op het spel voor beide ploegen.`);
  }
  if (highStakes) {
    out.push('Beide ploegen jagen nog volop op een plek in de play-offs.');
  }
  if (game.game_type === 'division' && bothWinning) {
    out.push(`Divisieduel in de ${division} tussen twee ploegen met een winnend record.`);
  }
  if (game.game_type === 'division') {
    out.push(`Divisieduel in de ${division}, deze twee treffen elkaar elk seizoen tweemaal.`);
  }
  if (game.primetime && bothWinning) {
    out.push(`${slot} tussen twee ploegen die allebei aan de goede kant staan.`);
  }
  if (game.primetime) {
    out.push(`${slot}: ${away} op bezoek bij ${home}.`);
  }
  if (bothWinning) {
    out.push('Twee ploegen met een winnend record komen elkaar tegen.');
  }
  if (bothLosing && lowStakes) {
    out.push('Twee ploegen die de aansluiting naar boven kwijt zijn.');
  }
  if (game.game_type === 'interconference') {
    out.push('AFC tegen NFC, deze twee ploegen treffen elkaar zelden.');
  }
  if (game.game_type === 'conference' && game.home?.conference) {
    out.push(`Duel binnen de ${game.home.conference}, twee ploegen uit verschillende divisies.`);
  }
  // One up, one down: still purely the records carried into the week.
  if (both.includes('winning') && both.includes('losing')) {
    out.push('Een ploeg met een winnend record tegen een die achterloopt.');
  }

  return out;
}

export const FALLBACK = (game) =>
  `${game.away?.abbr ?? 'Uit'} op bezoek bij ${game.home?.abbr ?? 'thuis'}.`;

/**
 * @param {object} game public-shaped game (level 0 and 1 fields only)
 * @param {{playerNames?: string[]}} [opts]
 * @returns {{teaser: string, source: 'template'|'fallback'}}
 */
export function teaserFor(game, opts = {}) {
  for (const candidate of candidates(game)) {
    if (lintTeaser(candidate, opts).ok) {
      return { teaser: candidate, source: 'template' };
    }
  }
  const fallback = FALLBACK(game);
  // The fallback is linted too. If even that fails, the game gets no teaser at
  // all rather than an unchecked one.
  return lintTeaser(fallback, opts).ok
    ? { teaser: fallback, source: 'fallback' }
    : { teaser: null, source: 'fallback' };
}
