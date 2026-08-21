// Turns raw metrics into a 1-5 watchability rating.
//
// Anti-leak note: the bottom of the scale is deliberately compressed. A raw
// rating of 1 would reliably mean "never close", which is the blowout signal the
// spoiler rules forbid at level 1. So a 1 is only reachable when the game was
// also low-stakes going in — then it reads "nothing was riding on this", which is
// pre-game information and safe. Everything else floors at 2.

const METRICS = ['excitement', 'tension', 'volatility', 'pace', 'stakes'];

// Fraction of the field this value beats, averaging ties so equal inputs get
// equal percentiles.
function percentileRanks(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    const below = lowerBound(sorted, v);
    const equal = upperBound(sorted, v) - below;
    return (below + equal / 2) / sorted.length;
  });
}

function lowerBound(arr, v) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr, v) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function bucket(p) {
  if (p < 0.15) return 1;
  if (p < 0.4) return 2;
  if (p < 0.65) return 3;
  if (p < 0.85) return 4;
  return 5;
}

// Pre-game stakes, bucketed 1-5 across every game in the season — including the
// ones that have not been played yet. Stakes only needs the records both teams
// carried in, the week number and the matchup type, so an upcoming week can be
// ranked just as well as a finished one. Without this a future week had no
// signal at all and the planner filled its slots in game-id order.
// entries: [{ game_id, stakes }]
export function bucketStakes(entries) {
  const ranks = percentileRanks(entries.map((e) => e.stakes));
  return new Map(entries.map((e, i) => [e.game_id, bucket(ranks[i])]));
}

// games: [{ game_id, metrics: {excitement, tension, volatility, pace, stakes} }]
// Percentiles are computed across the whole season, so ratings are relative to
// the season rather than to an absolute scale.
export function scoreSeason(games, weights) {
  const pct = {};
  for (const metric of METRICS) {
    pct[metric] = percentileRanks(games.map((g) => g.metrics[metric]));
  }

  return games.map((game, i) => {
    let composite = 0;
    let totalWeight = 0;
    const percentiles = {};
    for (const metric of METRICS) {
      const w = weights[metric] ?? 0;
      percentiles[metric] = pct[metric][i];
      composite += w * pct[metric][i];
      totalWeight += w;
    }
    composite /= totalWeight || 1;

    let rating = bucket(composite);
    // The compression described at the top of this file.
    if (rating === 1 && percentiles.stakes >= 0.35) rating = 2;

    return {
      game_id: game.game_id,
      watchability: rating,
      // Pre-game only, so it is level 0 and carries no information about how the
      // game actually went. Used as the planning basis when you would rather not
      // see an outcome-derived rating at all.
      stakes_pre: bucket(percentiles.stakes),
      // Private-side diagnostics. Never enters the public payload — volatility
      // of 0 alone would say "one team led wire to wire".
      _composite: Number(composite.toFixed(4)),
      _percentiles: Object.fromEntries(
        Object.entries(percentiles).map(([k, v]) => [k, Number(v.toFixed(4))]),
      ),
    };
  });
}
