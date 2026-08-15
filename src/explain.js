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
  1: 'nauwelijks iets',
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
    reasons.push(`Dit is je nummer ${ctx.rank}. Eigen teams krijgen als eerste een plek in de weekvorm.`);
  }

  // --- Why this format ---
  switch (game.format_reason) {
    case 'own_team':
      reasons.push(
        game.format_advice === 'full'
          ? 'Er was nog een full-plek vrij, dus deze kun je volledig terugkijken.'
          : 'Hij past in de ingekorte plekken van je weekvorm.',
      );
      break;
    case 'own_team_degraded':
      reasons.push(
        'De full-plekken waren al vergeven aan een hogere voorkeursrang, dus dit wordt de ingekorte versie.',
      );
      break;
    case 'quality':
      reasons.push(
        `Van de wedstrijden buiten je eigen teams stond hier vooraf het meeste op het spel (${game.stakes_pre ?? '?'} van 5).`,
      );
      break;
    case 'quota_full':
      reasons.push('Je weekvorm zat vol toen deze aan de beurt was.');
      break;
    case 'avoid':
      reasons.push('Een van beide ploegen staat op je nooit-lijst.');
      break;
    case 'budget':
      reasons.push('Het minutenbudget was op toen deze aan de beurt was.');
      break;
    default:
      break;
  }

  // --- What was riding on it, going in ---
  if (game.stakes_pre && !own) {
    reasons.push(`Inzet vooraf: ${STAKES_WORD[game.stakes_pre] ?? 'onbekend'}.`);
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
    reasons.push('Dit schuift aan de play-offplaatsen rond een van je eigen teams.');
  }
  if (game.tags?.includes('jouw divisie')) {
    reasons.push('Speelt zich af in de divisie van een van je teams.');
  }

  // --- When you can watch it ---
  if (game.live_friendly_nl) {
    reasons.push('Aftrap op een tijdstip dat je hier gewoon live kunt kijken.');
  } else if (game.primetime) {
    reasons.push('Primetime in de Verenigde Staten, dus hier midden in de nacht.');
  }

  return {
    reasons,
    caveat:
      'Dit gaat over wat er vooraf op het spel stond en hoe je weekvorm is verdeeld — niet over hoe de wedstrijd verliep.',
  };
}
