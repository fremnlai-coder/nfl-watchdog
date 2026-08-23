import { eventLabels } from '../../../src/time.js';

export const VIEW_FORMATS = ['full', 'game_in_40', 'sunday_in_60'];

const PLANNED_FORMATS = [...VIEW_FORMATS, 'skip'];
const GAME_TYPES = ['division', 'conference', 'interconference'];
const EVENT_LABELS = [
  'kickoff', 'international', 'thanksgiving_eve', 'thanksgiving',
  'black_friday', 'christmas', 'mnf', 'snf', 'tnf', 'saturday',
];

const fail = (message, strict) => {
  if (strict) throw new Error(message);
  return null;
};

function isoDate(value, label, strict) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return fail(`${label} klopt niet.`, strict);
  }
  return new Date(value).toISOString();
}

function teamAbbr(value, label, strict) {
  if (typeof value !== 'string' || !/^[A-Z]{2,3}$/.test(value)) {
    return fail(`${label} klopt niet.`, strict);
  }
  return value;
}

export function normalizeViewingEvent(value, strict = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('Een kijkmoment klopt niet.', strict);
  }

  const gameId = typeof value.game_id === 'string' && /^\d+$/.test(value.game_id)
    ? value.game_id
    : fail('Wedstrijd-id in het kijkprofiel klopt niet.', strict);
  const season = typeof value.season === 'string' && /^\d{4}$/.test(value.season)
    ? value.season
    : fail('Seizoen in het kijkprofiel klopt niet.', strict);
  const week = Number.isInteger(value.week) && value.week >= 1 && value.week <= 18
    ? value.week
    : fail('Week in het kijkprofiel klopt niet.', strict);
  const viewedAt = isoDate(value.viewed_at, 'Kijktijd in het kijkprofiel', strict);
  const kickoffUtc = isoDate(value.kickoff_utc, 'Aftraptijd in het kijkprofiel', strict);
  const away = teamAbbr(value.away, 'Uitteam in het kijkprofiel', strict);
  const home = teamAbbr(value.home, 'Thuisteam in het kijkprofiel', strict);
  const viewFormat = VIEW_FORMATS.includes(value.view_format)
    ? value.view_format
    : fail('Kijkformaat in het kijkprofiel klopt niet.', strict);
  const plannedFormat = PLANNED_FORMATS.includes(value.planned_format)
    ? value.planned_format
    : fail('Voorgesteld formaat in het kijkprofiel klopt niet.', strict);
  const gameType = GAME_TYPES.includes(value.game_type)
    ? value.game_type
    : fail('Wedstrijdtype in het kijkprofiel klopt niet.', strict);

  if (typeof value.suggested !== 'boolean') {
    return fail('Voorstelstatus in het kijkprofiel klopt niet.', strict);
  }
  if (typeof value.is_international !== 'boolean') {
    return fail('Internationale status in het kijkprofiel klopt niet.', strict);
  }
  if (!Array.isArray(value.event_labels)
    || value.event_labels.some((label) => !EVENT_LABELS.includes(label))) {
    return fail('Wedstrijdlabels in het kijkprofiel kloppen niet.', strict);
  }

  if ([gameId, season, week, viewedAt, kickoffUtc, away, home, viewFormat, plannedFormat, gameType]
    .some((part) => part == null)) return null;

  return {
    game_id: gameId,
    season,
    week,
    viewed_at: viewedAt,
    view_format: viewFormat,
    suggested: value.suggested,
    planned_format: plannedFormat,
    away,
    home,
    kickoff_utc: kickoffUtc,
    game_type: gameType,
    is_international: value.is_international,
    event_labels: [...new Set(value.event_labels)],
  };
}

export function normalizeViewingLog(value, strict = false) {
  if (value == null) return [];
  if (!Array.isArray(value)) return fail('Het kijkprofiel klopt niet.', strict) ?? [];

  const byGame = new Map();
  for (const raw of value) {
    const event = normalizeViewingEvent(raw, strict);
    if (!event) continue;
    const key = `${event.season}:${event.game_id}`;
    const current = byGame.get(key);
    if (!current || current.viewed_at < event.viewed_at) byGame.set(key, event);
  }
  return [...byGame.values()].sort((a, b) => a.viewed_at.localeCompare(b.viewed_at));
}

export function createViewingEvent(game, {
  season,
  week,
  viewFormat,
  suggested,
  plannedFormat,
  now = new Date(),
}) {
  return normalizeViewingEvent({
    game_id: game.game_id,
    season: String(season),
    week: Number(week),
    viewed_at: now.toISOString(),
    view_format: viewFormat,
    suggested: Boolean(suggested),
    planned_format: plannedFormat,
    away: game.away.abbr,
    home: game.home.abbr,
    kickoff_utc: game.kickoff_utc,
    game_type: game.game_type,
    is_international: Boolean(game.is_international),
    event_labels: eventLabels(new Date(game.kickoff_utc), {
      isInternational: game.is_international,
      week: game.week,
    }),
  }, true);
}

export function upsertViewingEvent(log, event) {
  return normalizeViewingLog([
    ...normalizeViewingLog(log),
    normalizeViewingEvent(event, true),
  ]);
}

export function removeViewingEvent(log, season, gameId) {
  return normalizeViewingLog(log).filter(
    (event) => !(event.season === String(season) && event.game_id === String(gameId)),
  );
}

const WEEKDAY = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const FORMAT_COPY = {
  full: 'Volledige replays',
  game_in_40: 'Game in 40',
  sunday_in_60: 'Sunday in 60',
};

function partsInAmsterdam(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  return { weekday, hour: Number(parts.hour) % 24 };
}

function period(hour) {
  if (hour < 5) return 'nacht';
  if (hour < 12) return 'ochtend';
  if (hour < 18) return 'middag';
  return 'avond';
}

function rankedCounts(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])),
  );
}

export function buildViewingProfile(log, season, teamNames = {}) {
  const events = normalizeViewingLog(log).filter((event) => event.season === String(season));
  const unplanned = events.filter((event) => !event.suggested);
  const profile = {
    count: events.length,
    unplanned_count: unplanned.length,
    ready: events.length >= 3,
    remaining: Math.max(0, 3 - events.length),
    insights: [],
  };

  if (!profile.ready) return profile;

  const moments = events.map((event) => {
    const { weekday, hour } = partsInAmsterdam(event.viewed_at);
    return `${WEEKDAY[weekday]}${period(hour)}`;
  });
  const [topMoment] = rankedCounts(moments);
  if (topMoment?.[1] >= 2) {
    profile.insights.push({
      key: 'time',
      label: 'Tijd',
      text: `Je kijkt het vaakst op ${topMoment[0]} (${topMoment[1]}×).`,
    });
  }

  const [topFormat, secondFormat] = rankedCounts(events.map((event) => event.view_format));
  if (topFormat?.[1] >= 2 && topFormat[1] > (secondFormat?.[1] ?? 0)) {
    profile.insights.push({
      key: 'format',
      label: 'Formaat',
      text: `${FORMAT_COPY[topFormat[0]]} kies je het meest (${topFormat[1]}×).`,
    });
  }

  if (unplanned.length > 0) {
    const [topTeam, secondTeam] = rankedCounts(
      unplanned.flatMap((event) => [event.away, event.home]),
    );
    if (topTeam?.[1] >= 2 && topTeam[1] > (secondTeam?.[1] ?? 0)) {
      const name = teamNames[topTeam[0]] ?? topTeam[0];
      profile.insights.push({
        key: 'interest',
        label: 'Interesse',
        text: `${name} kwam ${topTeam[1]}× terug buiten je kijkplan.`,
      });
    } else {
      const [feature] = [
        ['Internationale wedstrijden', unplanned.filter((event) => event.is_international).length],
        ['Divisieduels', unplanned.filter((event) => event.game_type === 'division').length],
        ['MNF', unplanned.filter((event) => event.event_labels.includes('mnf')).length],
        ['SNF', unplanned.filter((event) => event.event_labels.includes('snf')).length],
        ['TNF', unplanned.filter((event) => event.event_labels.includes('tnf')).length],
      ].sort((a, b) => b[1] - a[1]);

      profile.insights.push(feature?.[1] >= 2 ? {
        key: 'interest',
        label: 'Interesse',
        text: `${feature[0]} koos je ${feature[1]}× buiten je kijkplan.`,
      } : {
        key: 'unplanned',
        label: 'Buiten plan',
        text: `${unplanned.length} ${unplanned.length === 1 ? 'wedstrijd' : 'wedstrijden'} toch bekeken.`,
      });
    }
  }

  if (profile.insights.length === 0) {
    profile.insights.push({
      key: 'learning',
      label: 'Patroon',
      text: 'Nog geen duidelijk patroon; nieuwe keuzes maken dit scherper.',
    });
  }

  return profile;
}
