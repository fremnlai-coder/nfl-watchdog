// Level 0 tags, derived from the schedule and the records carried into the week.
//
// Shared between the ingest and the browser on purpose. Favourites can be
// changed in the UI, and the moment they are, tags baked at ingest time would be
// describing someone else's preferences. Everything here reads level 0 fields
// only, so recomputing it client-side leaks nothing.

export const FAVORITE = 'own_team';
export const OWN_DIVISION = 'jouw divisie';
export const SEEDING = 'indirect belangrijk';
export const INTERNATIONAL = 'internationaal';

function hasWinningRecord(record) {
  const [w, l, t] = String(record ?? '').split('-').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(l)) return false;
  if (w + l + (t || 0) === 0) return false;
  return w >= l;
}

/**
 * @param {object} game level 0 fields: home/away {abbr, conference, division},
 *   records_before {home, away}, is_international
 * @param {Array<{abbr: string, tier: string, conference?: string, division?: string}>} teams
 * @returns {string[]}
 */
export function computeTags(game, teams) {
  const byAbbr = new Map(teams.map((t) => [t.abbr, t]));
  const favorites = teams.filter((t) => t.tier === 'favorite');
  const favoriteDivisions = new Set(favorites.map((t) => t.division));
  const favoriteConferences = new Set(favorites.map((t) => t.conference));

  // Prefer the conference/division on the game itself: it travels with the
  // public payload, so the browser does not depend on the team list being
  // complete or current.
  const side = (which) => {
    const s = game[which] ?? {};
    const meta = byAbbr.get(s.abbr) ?? {};
    return {
      abbr: s.abbr,
      tier: meta.tier ?? 'neutral',
      conference: s.conference ?? meta.conference,
      division: s.division ?? meta.division,
    };
  };

  const involved = [side('home'), side('away')];
  const tags = [];

  if (involved.some((t) => t.tier === 'favorite')) {
    tags.push(FAVORITE);
  } else {
    if (involved.some((t) => favoriteDivisions.has(t.division))) tags.push(OWN_DIVISION);
    // Two teams in a conference one of your teams competes in, both carrying a
    // winning record into the week: whatever happens moves the seeding around
    // your team. Says nothing about what actually happened.
    if (
      involved.every((t) => favoriteConferences.has(t.conference)) &&
      hasWinningRecord(game.records_before?.home) &&
      hasWinningRecord(game.records_before?.away)
    ) {
      tags.push(SEEDING);
    }
  }

  if (game.is_international) tags.push(INTERNATIONAL);
  return tags;
}

export const isOwnTeam = (game, teams) => computeTags(game, teams).includes(FAVORITE);
