// All network access lives here so the spoiler boundary is visible in one file.
//
// loadWeek() runs on page load and touches only data/public.
// loadHints() and loadResults() are called from a click handler and never
// before — that is the level 2 and level 3 mechanism.

const base = import.meta.env?.BASE_URL ?? './';

const cache = new Map();

async function getJson(path) {
  if (cache.has(path)) return cache.get(path);

  const promise = fetch(`${base}${path}`).then((res) => {
    if (!res.ok) throw new Error(`${res.status} bij ${path}`);
    return res.json();
  });
  cache.set(path, promise);

  // Alleen geslaagde antwoorden blijven staan. De cache werd gevuld vóórdat
  // bekend was of de fetch lukte, dus één seconde zonder bereik — op een
  // telefoon geen uitzondering — maakte dat pad kapot voor de rest van de
  // sessie: elke volgende poging kreeg dezelfde afwijzing terug, ook nadat de
  // verbinding er weer was. De promise zelf gaat ongewijzigd naar de aanroeper;
  // die handelt de fout af.
  promise.catch(() => {
    if (cache.get(path) === promise) cache.delete(path);
  });

  return promise;
}

export const loadIndex = () => getJson('data/index.json');
export const loadPrefs = () => getJson('config/preferences.json');

function segment(label, value, pattern) {
  const text = String(value);
  if (!pattern.test(text)) throw new Error(`Ongeldige ${label}: ${text}`);
  return text;
}

export function weekPath(season, week) {
  const safeSeason = segment('seizoen', season, /^\d{4}$/);
  const safeWeek = segment('week', week, /^(?:[1-9]|1[0-8])$/);
  return `data/public/${safeSeason}/week-${safeWeek}.json`;
}

export function revealPath(season, week, gameId, kind) {
  const publicPath = weekPath(season, week);
  const safeGame = segment('wedstrijd-id', gameId, /^\d+$/);
  const safeKind = segment('revealtype', kind, /^(?:hints|results)$/);
  const [, safeSeason, weekFile] = /^data\/public\/(\d{4})\/(week-\d+)\.json$/.exec(publicPath);
  return `data/private/${safeSeason}/${weekFile}/${safeGame}.${safeKind}.json`;
}

// Level 0 and 1 only.
export const loadWeek = (season, week) =>
  getJson(weekPath(season, week));

// De teamgids. Level 0 en niet weekgebonden: namen, coaches, stadions. Wordt
// pas opgehaald als het paneel opengaat, want het is bijna 100 kB. Er is er
// maar één, van het actieve seizoen — de rosterdata van ESPN is de stand van nu
// en bestaat niet met terugwerkende kracht.
export const loadTeams = (season) =>
  getJson(`data/public/${segment('seizoen', season, /^\d{4}$/)}/teams.json`);

// Level 2. Vague qualifications, no direction.
export const loadHints = (season, week, gameId) =>
  getJson(revealPath(season, week, gameId, 'hints'));

// Level 3. Scores and winners. Only ever called after an explicit confirmation.
export const loadResults = (season, week, gameId) =>
  getJson(revealPath(season, week, gameId, 'results'));
