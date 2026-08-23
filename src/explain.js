// Explains why a game landed where it did in the week's plan.
//
// Everything here is built from level 0 fields: the records both teams carried
// into the week, the schedule, and the position the planner gave the game. None
// of it looks at how the game actually went.
//
// The wording matters. "Why this is a good game" would be a verdict on a game
// that has already been played, and a verdict like that is outcome information —
// exactly what the rest of this project is built to withhold. So this explains
// the *pick*, not the game.

const STAKES_WORD = {
  5: 'zeer hoog',
  4: 'hoog',
  3: 'gemiddeld',
  2: 'laag',
  1: 'zeer laag',
};

function recordShape(record) {
  const [w, l] = String(record ?? '').split('-').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(l)) return 'unknown';
  if (w > l) return 'winning';
  if (l > w) return 'losing';
  return 'even';
}

/**
 * @param {object} game public-shaped game with a plan applied
 * @param {{rank?: number|null, quota?: {full: number, game_in_40: number}}} ctx
 * @returns {{reasons: string[], caveat: string}}
 */
export function explainPick(game, ctx = {}) {
  const reasons = [];
  const own = game.tags?.includes('own_team');
  const both = [recordShape(game.records_before?.home), recordShape(game.records_before?.away)];

  // --- Why it is in this section at all ---
  if (own && ctx.rank) {
    reasons.push(`Hier speelt favoriet nummer ${ctx.rank}. Favorieten krijgen als eerste een plek in het kijkplan.`);
  }

  // --- Why this format ---
  switch (game.format_reason) {
    case 'own_team':
      reasons.push(
        game.format_advice === 'full'
          ? 'Er was nog een plek voor een volledige replay.'
          : 'Deze wedstrijd past in een Game in 40-plek.',
      );
      break;
    case 'own_team_degraded':
      reasons.push(
        'De volledige plekken waren al toegewezen aan hogere favorieten, dus dit wordt Game in 40.',
      );
      break;
    case 'quality':
      reasons.push(
        `Deze wedstrijd stond hoog op basis van het belang vooraf (${game.stakes_pre ?? '?'} van 5).`,
      );
      break;
    case 'quota_full':
      reasons.push('Je kijkplan zat vol toen deze aan de beurt was.');
      break;
    case 'avoid':
      reasons.push('Een van beide ploegen staat op Nooit.');
      break;
    case 'budget':
      reasons.push('Het minutenbudget was op toen deze aan de beurt was.');
      break;
    default:
      break;
  }

  // --- What was riding on it, going in ---
  if (game.stakes_pre && !own) {
    reasons.push(`Belang vooraf: ${STAKES_WORD[game.stakes_pre] ?? 'onbekend'}.`);
  }
  if (both.every((s) => s === 'winning')) {
    reasons.push('Beide ploegen gingen de week in met een winnend record.');
  } else if (both.every((s) => s === 'losing')) {
    reasons.push('Geen van beide ploegen stond er goed voor.');
  }
  if (game.game_type === 'division') {
    reasons.push('Divisieduel, en die tellen zwaar voor wie de divisie wint.');
  } else if (game.game_type === 'interconference') {
    reasons.push('AFC tegen NFC — deze ploegen treffen elkaar zelden.');
  }
  if (game.tags?.includes('indirect belangrijk')) {
    reasons.push('Deze wedstrijd kan invloed hebben op de play-offrace in de conference van een favoriet.');
  }
  if (game.tags?.includes('jouw divisie')) {
    reasons.push('Een van de ploegen speelt in dezelfde divisie als een van je favorieten.');
  }

  // --- When you can watch it ---
  if (game.live_friendly_nl) {
    reasons.push('De aftrap valt binnen je livevenster.');
  } else if (game.primetime) {
    reasons.push('Amerikaanse primetimewedstrijd; de aftrap is hier midden in de nacht.');
  }

  return {
    reasons,
    caveat:
      'Dit gaat over het belang vooraf en je kijkplan, niet over hoe de wedstrijd verliep.',
  };
}
