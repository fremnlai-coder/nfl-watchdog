// All timezone work goes through Intl with named zones. Never a fixed offset:
// the EU switches to winter time a week before the US does, so for that one week
// the gap is 5 hours instead of 6 and every hardcoded offset is wrong.

const ET = 'America/New_York';
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partsIn(date, timeZone, opts) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', ...opts });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

export function easternContext(date) {
  const p = partsIn(date, ET, {
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: 'numeric',
  });
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    weekdayIndex: WEEKDAYS[p.weekday],
    weekday: p.weekday,
    hour: Number(p.hour) % 24,
  };
}

export function formatNL(date, timeZone = 'Europe/Amsterdam') {
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

// Real offset between the two zones at that instant, so the DST mismatch week
// shows up as 5 rather than being silently wrong.
export function offsetHours(date, timeZone = 'Europe/Amsterdam') {
  const read = (tz) => {
    const p = partsIn(date, tz, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  return (read(timeZone) - read(ET)) / 3600000;
}

export function localHour(date, timeZone = 'Europe/Amsterdam') {
  return Number(partsIn(date, timeZone, { hour: 'numeric' }).hour) % 24;
}

// Neutral time-of-day classification for international-game copy. Being played
// abroad is not the same as a daytime kickoff: the 2025 Sao Paulo game started
// at 02:00 Dutch time. This flag must not become a live-viewing recommendation.
export function isLiveFriendly(date, { timeZone = 'Europe/Amsterdam', window = [11, 21] } = {}) {
  const hour = localHour(date, timeZone);
  return hour >= window[0] && hour <= window[1];
}

const WEEKDAY_NL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

function thanksgivingDay(year) {
  const first = new Date(Date.UTC(year, 10, 1));
  const firstThursday = 1 + ((4 - first.getUTCDay() + 7) % 7);
  return firstThursday + 21;
}

// Context chips are derived from the US calendar, where the broadcast labels
// originate. Weekday alone is not enough: 2026 has both the Wednesday Kickoff
// Game and a Wednesday Thanksgiving Eve game, while only the late Thanksgiving
// game is TNF.
export function eventLabels(date, { isInternational = false, week = null } = {}) {
  const { year, month, day, weekdayIndex, hour } = easternContext(date);
  const thanksgiving = thanksgivingDay(year);
  const labels = [];

  if (isInternational) labels.push('international');

  if (month === 11 && day === thanksgiving - 1) labels.push('thanksgiving_eve');
  else if (month === 11 && day === thanksgiving) labels.push('thanksgiving');
  else if (month === 11 && day === thanksgiving + 1) labels.push('black_friday');

  if (month === 12 && day === 25) labels.push('christmas');

  if (
    Number(week) === 1
    && [3, 4].includes(weekdayIndex)
    && hour >= 19
    && !isInternational
  ) labels.push('kickoff');

  if (labels.includes('kickoff')) return [...new Set(labels)];
  if (weekdayIndex === 1) labels.push('mnf');
  else if (weekdayIndex === 0 && hour >= 19) labels.push('snf');
  else if (
    weekdayIndex === 4
    && hour >= 19
    && !isInternational
    && !(month === 12 && day === 25)
  ) labels.push('tnf');
  else if (weekdayIndex === 6) labels.push('saturday');

  return [...new Set(labels)];
}

export function isPrimeTime(date) {
  return easternContext(date).hour >= 19;
}

export function slotLabel(date, {
  isInternational,
  timeZone = 'Europe/Amsterdam',
  window,
  week = null,
} = {}) {
  const { weekdayIndex, hour } = easternContext(date);
  const events = eventLabels(date, { isInternational, week });

  if (events.includes('kickoff')) return 'NFL Kickoff';
  if (events.includes('thanksgiving_eve')) return 'Thanksgiving Eve';
  if (events.includes('thanksgiving')) return 'Thanksgiving';
  if (events.includes('black_friday')) return 'Black Friday';
  if (events.includes('christmas')) return 'Kerst';
  // Only call it an international slot when it actually plays out as one here.
  if (isInternational && isLiveFriendly(date, { timeZone, window })) return 'Internationaal';
  if (events.includes('mnf')) return 'Monday Night';
  if (events.includes('snf')) return 'Sunday Night';
  if (events.includes('tnf')) return 'Thursday Night';

  switch (weekdayIndex) {
    case 3: return hour >= 18 ? 'Woensdagavond' : 'Woensdag';
    case 4: return hour >= 18 ? 'Donderdagavond' : 'Donderdagmiddag';
    case 5: return hour >= 18 ? 'Vrijdagavond' : 'Vrijdagmiddag';
    case 6: return 'Zaterdag';
    case 1: return 'Maandag';
    case 0:
      if (hour < 16) return 'Zondag vroeg';
      if (hour < 19) return 'Zondag laat';
      return 'Zondagavond';
    // Anything the NFL invents next still gets a usable label instead of
    // "Overig", which told you nothing about when to watch.
    default:
      return `${WEEKDAY_NL[weekdayIndex] ?? 'Overig'}${hour >= 18 ? 'avond' : ''}`;
  }
}

export function isSundaySlate(date, coversWeekdays = [0]) {
  return coversWeekdays.includes(easternContext(date).weekdayIndex);
}
