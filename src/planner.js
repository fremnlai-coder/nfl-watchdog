// Fits a week into a minute budget and produces two packages to choose between.
//
// Design note on format_advice: non-favourite games are only ever offered as
// game_in_40 or skip. Letting the optimiser hand out a full replay would make
// "full" a reliable marker for "high rating", which is exactly the level-1 leak
// the spoiler rules are trying to avoid. It is also simply the better advice —
// at 40 versus 185 minutes a condensed game is ~4.6x more game per minute, so a
// budget optimiser picks it every time anyway. Full replays are reserved for
// your own teams, where the choice is loyalty rather than quality.
// Set allow_full_for_non_favorites to override, accepting that leak.

const LADDER = ['full', 'game_in_40', 'skip'];

function tierOf(game, teamsByAbbr) {
  const home = teamsByAbbr.get(game.home.abbr);
  const away = teamsByAbbr.get(game.away.abbr);
  const tiers = [home?.tier, away?.tier];
  if (tiers.includes('favorite')) return 'favorite';
  if (tiers.includes('avoid')) return 'avoid';
  if (tiers.includes('watchlist')) return 'watchlist';
  return 'neutral';
}

function favoriteRank(game, teamsByAbbr) {
  const ranks = [game.home.abbr, game.away.abbr]
    .map((a) => teamsByAbbr.get(a))
    .filter((t) => t?.tier === 'favorite')
    .map((t) => t.rank ?? 99);
  return ranks.length ? Math.min(...ranks) : null;
}

export function planWeek(games, prefs, { withRecap }) {
  const teamsByAbbr = new Map(prefs.teams.map((t) => [t.abbr, t]));
  const dur = prefs.format_durations_minutes;
  const recapMinutes = prefs.slate_recap?.minutes ?? 60;
  const allowFull = prefs.allow_full_for_non_favorites === true;

  // Your own teams are allocated against the full budget. The recap is a
  // nice-to-have and only takes minutes that are still free afterwards —
  // reserving for it first would sacrifice an own-team game to make room for a
  // roundup that may not even cover it (a Thursday game is not in Sunday's).
  const budget = prefs.weekly_budget_minutes;
  const decisions = new Map();

  // --- Own teams first, at rank order ---
  const own = games
    .filter((g) => tierOf(g, teamsByAbbr) === 'favorite')
    .map((g) => ({ game: g, rank: favoriteRank(g, teamsByAbbr) }))
    .sort((a, b) => a.rank - b.rank);

  // Three favourites at a full replay each is 555 minutes, and in this schedule
  // all three play in 14 of 18 weeks. Left at "full" the own-team block eats any
  // realistic budget whole and nothing else is ever planned, so the default
  // format is a lever rather than a constant.
  const ownDefault = prefs.own_team_default_format ?? 'full';
  for (const { game } of own) {
    decisions.set(game.game_id, { format: ownDefault, reason: 'own_team' });
  }

  const ownMinutes = () =>
    own.reduce((s, { game }) => s + (dur[decisions.get(game.game_id).format] ?? 0), 0);

  // Degrade from the lowest rank upward. Rank 1 is never touched automatically —
  // if it alone busts the budget that is reported, not silently solved.
  let overflow = 0;
  const startStep = Math.max(0, LADDER.indexOf(ownDefault));
  for (let step = startStep; step < LADDER.length - 1 && ownMinutes() > budget; step++) {
    const target = LADDER[step];
    const next = LADDER[step + 1];
    const degradable = own
      .filter(({ game, rank }) => rank > 1 && decisions.get(game.game_id).format === target)
      .sort((a, b) => b.rank - a.rank); // lowest priority first
    for (const { game } of degradable) {
      if (ownMinutes() <= budget) break;
      decisions.set(game.game_id, { format: next, reason: 'own_team_degraded' });
    }
  }
  if (ownMinutes() > budget) overflow = ownMinutes() - budget;

  // --- Reserve for the recap only from what own teams left behind ---
  let remaining = Math.max(0, budget - ownMinutes());
  const anySundayGame = games.some((g) => g.in_sunday_slate);
  const recapWanted = withRecap && prefs.slate_recap?.enabled !== false && anySundayGame;
  const recapActive = recapWanted && remaining >= recapMinutes;
  if (recapActive) remaining -= recapMinutes;

  const rest = games
    .filter((g) => !decisions.has(g.game_id))
    .map((g) => ({ game: g, tier: tierOf(g, teamsByAbbr) }));

  // Which signal drives the picks. "watchability" is outcome-derived: it measures
  // how close a game stayed, so it never reveals the winner but does reveal the
  // shape. "pre_game_only" ranks on stakes carried into the week instead, which
  // is level 0 and leaks nothing at all — at the cost of planning on expectation
  // rather than on what actually happened.
  const basis = prefs.planning_basis ?? 'watchability';
  const rank = (g) => (basis === 'pre_game_only' ? g.stakes_pre : g.watchability) ?? 0;

  const watchlistBonus = prefs.watchlist_bonus ?? 0.5;
  const candidates = rest
    .filter(({ tier }) => tier !== 'avoid')
    .sort((a, b) => {
      const sa = rank(a.game) + (a.tier === 'watchlist' ? watchlistBonus : 0);
      const sb = rank(b.game) + (b.tier === 'watchlist' ? watchlistBonus : 0);
      if (sb !== sa) return sb - sa;
      return a.game.game_id.localeCompare(b.game.game_id); // deterministic tiebreak
    });

  for (const { game, tier } of rest) {
    if (tier === 'avoid') decisions.set(game.game_id, { format: 'skip', reason: 'avoid' });
  }

  for (const { game } of candidates) {
    if (decisions.has(game.game_id)) continue;
    const top = rank(game) === 5;
    const cost = allowFull && top ? dur.full : dur.game_in_40;
    const format = allowFull && top ? 'full' : 'game_in_40';
    if (cost <= remaining) {
      decisions.set(game.game_id, { format, reason: 'quality' });
      remaining -= cost;
    } else {
      decisions.set(game.game_id, { format: 'skip', reason: 'budget' });
    }
  }

  // --- Assemble ---
  const planned = games.map((g) => {
    const d = decisions.get(g.game_id);
    return {
      game_id: g.game_id,
      format_advice: d.format,
      format_reason: d.reason,
      runtime_minutes: dur[d.format] ?? 0,
    };
  });

  const minutes = planned.reduce((s, p) => s + p.runtime_minutes, 0);
  const skipped = games.filter((g) => decisions.get(g.game_id).format === 'skip');
  const recapCovers = recapActive ? skipped.filter((g) => g.in_sunday_slate) : [];
  const unseen = skipped.filter((g) => !recapCovers.includes(g));

  const ownSkipped = own.filter(({ game }) => decisions.get(game.game_id).format === 'skip').length;

  return {
    games: planned,
    summary: {
      package: withRecap ? 'B' : 'A',
      recap_included: recapActive,
      // Set when a recap was wanted but there were not 60 free minutes left
      // after your own teams. Package B then collapses back onto package A.
      recap_dropped: recapWanted && !recapActive,
      budget_minutes: budget,
      own_team_minutes: ownMinutes(),
      own_team_skipped: ownSkipped,
      picked_minutes: minutes - ownMinutes(),
      recap_minutes: recapActive ? recapMinutes : 0,
      total_minutes: minutes + (recapActive ? recapMinutes : 0),
      overflow_minutes: overflow,
      counts: {
        full: planned.filter((p) => p.format_advice === 'full').length,
        game_in_40: planned.filter((p) => p.format_advice === 'game_in_40').length,
        skip: skipped.length,
      },
      recap_covers: recapCovers.length,
      unseen: unseen.length,
    },
  };
}

// Runs both packages so the CLI can show the trade-off rather than pick for you.
export function planBoth(games, prefs) {
  return {
    a: planWeek(games, prefs, { withRecap: false }),
    b: planWeek(games, prefs, { withRecap: true }),
  };
}
