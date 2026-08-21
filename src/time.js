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
  const p = partsIn(date, ET, { weekday: 'short', hour: 'numeric' });
  return { weekdayIndex: WEEKDAYS[p.weekday], weekday: p.weekday, hour: Number(p.hour) % 24 };
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

// Whether the kickoff is at an hour you could realistically watch live here.
// Being played abroad is not the same thing: the 2025 Sao Paulo game kicked off
// at 02:00 Dutch time, and 2026 adds Melbourne, Rio and Mexico City. Only the
// European host cities land in the afternoon.
export function isLiveFriendly(date, { timeZone = 'Europe/Amsterdam', window = [11, 21] } = {}) {
  const hour = localHour(date, timeZone);
  return hour >= window[0] && hour <= window[1];
}

const WEEKDAY_NL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

export function slotLabel(date, { isInternational, timeZone = 'Europe/Amsterdam', window }) {
  const { weekdayIndex, hour } = easternContext(date);
  // Only call it an international slot when it actually plays out as one here.
  // Otherwise it falls through to the normal slot, which is what it really is.
  if (isInternational && isLiveFriendly(date, { timeZone, window })) return 'International';
  switch (weekdayIndex) {
    // The season opener is a Wednesday night: the 2026 edition is NE at SEA on
    // 9 September, 20:20 ET. Without this it fell through to a generic label.
    case 3: return 'Kickoff Game';
    case 4: return 'Thursday Night';
    case 5: return 'Friday';
    case 6: return 'Saturday';
    case 1: return 'Monday Night';
    case 0:
      if (hour < 16) return 'Sunday early';
      if (hour < 19) return 'Sunday late afternoon';
      return 'Sunday Night';
    // Anything the NFL invents next still gets a usable label instead of
    // "Overig", which told you nothing about when to watch.
    default:
      return `${WEEKDAY_NL[weekdayIndex] ?? 'Overig'}${hour >= 18 ? 'avond' : ''}`;
  }
}

export function isSundaySlate(date, coversWeekdays = [0]) {
  return coversWeekdays.includes(easternContext(date).weekdayIndex);
}
