// Favourites live in localStorage and override the shipped config.
//
// config/preferences.json stays the source of truth for the CLI and the ingest;
// the browser layers your choices on top. Only tier and rank are overridable —
// conference, division and names come from the config, because they are facts
// rather than preferences.

const KEY = 'nfl-watchdog:teams:v1';
const WATCHED_KEY = 'nfl-watchdog:watched:v1';
const SETTINGS_KEY = 'nfl-watchdog:settings:v1';
const VIEWED_KEY = 'nfl-watchdog:viewed:v1';

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


// How far you have watched, per season. Kept in localStorage rather than in the
// config: it changes every week, and re-running the ingest just to move a
// pointer would be absurd. config/preferences.json still supplies the starting
// value on a first visit.
export function loadWatched() {
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWatched(map) {
  try {
    localStorage.setItem(WATCHED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function normalizeQuota(value, strict = false) {
  const fallback = {};
  if (value == null) return fallback;
  if (!value || typeof value !== 'object') {
    if (strict) throw new Error('De weekvorm klopt niet.');
    return fallback;
  }
  const quota = {};
  for (const key of ['full', 'game_in_40']) {
    const n = value[key];
    if (!Number.isInteger(n) || n < 0 || n > 8) {
      if (strict) throw new Error(`Aantal ${key} klopt niet.`);
      continue;
    }
    quota[key] = n;
  }
  return quota;
}

function normalizeSettings(value, strict = false) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (strict) throw new Error('De app-instellingen kloppen niet.');
    return {};
  }

  const out = {};
  const quota = normalizeQuota(value.weekly_quota, strict);
  if (Object.keys(quota).length) out.weekly_quota = quota;

  if (value.with_recap != null) {
    if (typeof value.with_recap !== 'boolean') {
      if (strict) throw new Error('De Sunday in 60-instelling klopt niet.');
    } else {
      out.with_recap = value.with_recap;
    }
  }

  if (value.last_season != null) {
    const season = String(value.last_season);
    if (!/^\d{4}$/.test(season)) {
      if (strict) throw new Error('Het laatst gekozen seizoen klopt niet.');
    } else {
      out.last_season = season;
    }
  }

  const weeks = {};
  for (const [season, week] of Object.entries(value.last_week_by_season ?? {})) {
    if (!/^\d{4}$/.test(season) || !Number.isInteger(week) || week < 1 || week > 18) {
      if (strict) throw new Error(`De laatst gekozen week voor ${season} klopt niet.`);
      continue;
    }
    weeks[season] = week;
  }
  if (Object.keys(weeks).length) out.last_week_by_season = weeks;
  return out;
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // ignore
  }
}

function normalizeViewed(value, strict = false) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (strict) throw new Error('De kijkvoortgang klopt niet.');
    return {};
  }
  const out = {};
  for (const [season, ids] of Object.entries(value)) {
    if (!/^\d{4}$/.test(season) || !Array.isArray(ids)) {
      if (strict) throw new Error(`De kijkvoortgang voor ${season} klopt niet.`);
      continue;
    }
    if (ids.some((id) => typeof id !== 'string' || !/^\d+$/.test(id))) {
      if (strict) throw new Error(`Een wedstrijd-id voor ${season} klopt niet.`);
      continue;
    }
    out[season] = [...new Set(ids)];
  }
  return out;
}

export function loadViewed() {
  try {
    return normalizeViewed(JSON.parse(localStorage.getItem(VIEWED_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function saveViewed(viewed) {
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify(normalizeViewed(viewed)));
  } catch {
    // ignore
  }
}


// --- back-up ---------------------------------------------------------------
//
// Both keys above live in localStorage, which on iOS is a cache rather than a
// store: Safari drops a site's storage after seven days without a visit. A
// home-screen app is exempt, but it gets its own storage — so moving to it
// starts you empty. This is the way back in both cases.

const BACKUP_APP = 'nfl-watchdog';
const BACKUP_VERSION = 2;

export function exportState(now = new Date()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    teams: loadOverrides() ?? {},
    watched: loadWatched(),
    settings: loadSettings(),
    viewed: loadViewed(),
  };
}

// Throws with a message that is meant to be shown as-is. A silently ignored bad
// import would look identical to a successful one.
export function parseBackup(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('Dat is geen leesbare JSON.');
  }

  if (!doc || doc.app !== BACKUP_APP) {
    throw new Error('Dit bestand komt niet van NFL Watchdog.');
  }
  if (![1, BACKUP_VERSION].includes(doc.version)) {
    throw new Error(`Onbekende versie ${doc.version}; deze app leest versie 1 en ${BACKUP_VERSION}.`);
  }

  const teams = {};
  for (const [abbr, v] of Object.entries(doc.teams ?? {})) {
    if (!v || !TIERS.includes(v.tier)) throw new Error(`Onbekende voorkeur bij ${abbr}.`);
    const rank = v.rank ?? null;
    if (rank != null && !Number.isInteger(rank)) throw new Error(`Rang van ${abbr} klopt niet.`);
    teams[abbr] = { tier: v.tier, rank };
  }

  const watched = {};
  for (const [season, week] of Object.entries(doc.watched ?? {})) {
    // A counter that is too high opens weeks you have not watched yet, which is
    // exactly the gate the rest of this project is built around.
    if (!Number.isInteger(week) || week < 0 || week > 18) {
      throw new Error(`Kijkstand voor ${season} klopt niet: ${week}.`);
    }
    watched[season] = week;
  }

  const settings = doc.version >= 2 ? normalizeSettings(doc.settings, true) : {};
  const viewed = doc.version >= 2 ? normalizeViewed(doc.viewed, true) : {};

  return { teams: renumber(teams), watched, settings, viewed };
}
