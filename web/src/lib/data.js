// All network access lives here so the spoiler boundary is visible in one file.
//
// loadWeek() runs on page load and touches only data/public.
// loadHints() and loadResults() are called from a click handler and never
// before — that is the level 2 and level 3 mechanism.

const base = import.meta.env.BASE_URL;

const cache = new Map();

async function getJson(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(`${base}${path}`).then((res) => {
    if (!res.ok) throw new Error(`${res.status} bij ${path}`);
    return res.json();
  });
  cache.set(path, promise);
  return promise;
}

export const loadIndex = () => getJson('data/index.json');
export const loadPrefs = () => getJson('config/preferences.json');

// Level 0 and 1 only.
export const loadWeek = (season, week) =>
  getJson(`data/public/${season}/week-${week}.json`);

// Level 2. Vague qualifications, no direction.
export const loadHints = (season, week) =>
  getJson(`data/private/${season}/week-${week}.hints.json`);

// Level 3. Scores and winners. Only ever called after an explicit confirmation.
export const loadResults = (season, week) =>
  getJson(`data/private/${season}/week-${week}.results.json`);
