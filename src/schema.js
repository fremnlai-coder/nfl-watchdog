// SPOILER BOUNDARY — single source of truth for what may leave the build.
//
// The public payload is built by picking from this allowlist, never by spreading
// an ESPN object. Adding a field here is the only way to make it public, which
// makes every widening of the boundary a visible one-line diff.

export const PUBLIC_KEYS = [
  'game_id',
  'season',
  'week',
  'kickoff_utc',
  'kickoff_nl',
  'slot',
  'is_international',
  'venue',
  'home',
  'away',
  'records_before',
  'game_type',
  'primetime',
  'tags',
  'in_sunday_slate',
  'live_friendly_nl',
  'all22_from_nl',
  'stakes_pre',
  'watchability',
  // Availability only. These booleans reveal no score, winner, direction or
  // quality; they stop the UI offering dead reveal actions before a game exists.
  'hints_ready',
  'outcome_ready',
  'teaser',
  'format_advice',
  'format_reason',
  'runtime_minutes',
];

// Nested objects that are allowed inside public fields, with their own allowlists.
const NESTED = {
  home: ['abbr', 'name', 'conference', 'division'],
  away: ['abbr', 'name', 'conference', 'division'],
  records_before: ['home', 'away'],
};

export const FORMATS = ['full', 'game_in_40', 'skip'];

export function buildPublicGame(source) {
  const out = {};
  for (const key of PUBLIC_KEYS) {
    if (source[key] === undefined) continue;
    const nestedKeys = NESTED[key];
    if (nestedKeys) {
      const nested = {};
      for (const nk of nestedKeys) {
        if (source[key][nk] !== undefined) nested[nk] = source[key][nk];
      }
      out[key] = nested;
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// Throws on any key that is not on the allowlist. Called by ingest before write
// and again by the leak-scan test, so a regression fails the build twice.
export function assertPublicShape(game, where = 'public game') {
  for (const key of Object.keys(game)) {
    if (!PUBLIC_KEYS.includes(key)) {
      throw new Error(`${where}: forbidden key "${key}" in public payload`);
    }
    const nestedKeys = NESTED[key];
    if (nestedKeys && game[key] && typeof game[key] === 'object') {
      for (const nk of Object.keys(game[key])) {
        if (!nestedKeys.includes(nk)) {
          throw new Error(`${where}: forbidden nested key "${key}.${nk}"`);
        }
      }
    }
  }
  if (game.format_advice !== undefined && !FORMATS.includes(game.format_advice)) {
    throw new Error(`${where}: invalid format_advice "${game.format_advice}"`);
  }
  for (const key of ['hints_ready', 'outcome_ready']) {
    if (game[key] !== undefined && typeof game[key] !== 'boolean') {
      throw new Error(`${where}: invalid ${key}`);
    }
  }
  if (game.game_id !== undefined && !/^\d+$/.test(String(game.game_id))) {
    throw new Error(`${where}: invalid game_id`);
  }
  return true;
}
