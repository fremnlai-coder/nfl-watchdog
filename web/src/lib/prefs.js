// Favourites live in localStorage and override the shipped config.
//
// config/preferences.json stays the source of truth for the CLI and the ingest;
// the browser layers your choices on top. Only tier and rank are overridable —
// conference, division and names come from the config, because they are facts
// rather than preferences.

const KEY = 'nfl-watchdog:teams:v1';

export const TIERS = ['favorite', 'watchlist', 'neutral', 'avoid'];

export const TIER_LABEL = {
  favorite: 'Favoriet',
  watchlist: 'Watchlist',
  neutral: 'Neutraal',
  avoid: 'Nooit',
};

// Short forms for the per-team buttons, which sit four abreast in a narrow row.
export const TIER_SHORT = {
  favorite: 'Fav',
  watchlist: 'Watch',
  neutral: '—',
  avoid: 'Nooit',
};

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOverrides(overrides) {
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    // A full or blocked storage is not worth breaking the page over.
  }
}

export function clearOverrides() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Turns the config team list into the override shape, so a first visit starts
// from whatever preferences.json says rather than from an empty slate.
export function overridesFromTeams(teams) {
  return Object.fromEntries(
    teams.map((t) => [t.abbr, { tier: t.tier ?? 'neutral', rank: t.rank ?? null }]),
  );
}

export function mergeTeams(baseTeams, overrides) {
  if (!overrides) return baseTeams;
  return baseTeams.map((t) => {
    const o = overrides[t.abbr];
    if (!o) return { ...t, tier: 'neutral', rank: null };
    return { ...t, tier: o.tier, rank: o.rank ?? null };
  });
}

// Favourites are ranked 1..n with no gaps. Called after every change so the
// numbers stay meaningful when a team is added or dropped.
export function renumber(overrides) {
  const favorites = Object.entries(overrides)
    .filter(([, v]) => v.tier === 'favorite')
    .sort((a, b) => (a[1].rank ?? 99) - (b[1].rank ?? 99));

  const next = { ...overrides };
  favorites.forEach(([abbr, v], i) => {
    next[abbr] = { ...v, rank: i + 1 };
  });
  for (const [abbr, v] of Object.entries(next)) {
    if (v.tier !== 'favorite' && v.rank != null) next[abbr] = { ...v, rank: null };
  }
  return next;
}

export function setTier(overrides, abbr, tier) {
  const current = overrides[abbr] ?? { tier: 'neutral', rank: null };
  const maxRank = Math.max(
    0,
    ...Object.values(overrides).map((v) => (v.tier === 'favorite' ? (v.rank ?? 0) : 0)),
  );
  const next = {
    ...overrides,
    // A team promoted to favourite joins at the end of the order.
    [abbr]: { tier, rank: tier === 'favorite' ? (current.rank ?? maxRank + 1) : null },
  };
  return renumber(next);
}

export function moveFavorite(overrides, abbr, direction) {
  const order = Object.entries(overrides)
    .filter(([, v]) => v.tier === 'favorite')
    .sort((a, b) => (a[1].rank ?? 99) - (b[1].rank ?? 99))
    .map(([a]) => a);

  const i = order.indexOf(abbr);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return overrides;

  [order[i], order[j]] = [order[j], order[i]];
  const next = { ...overrides };
  order.forEach((a, idx) => {
    next[a] = { ...next[a], rank: idx + 1 };
  });
  return next;
}
