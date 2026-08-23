// The one spoiler channel that runs *between* weeks instead of inside one.
//
// records_before for week N is the standing after week N-1. So opening week 5
// while you have only watched through week 3 tells you how week 4 went — for all
// 32 teams at once, without a single score being shown. stakes_pre is derived
// from those same records, so it leaks along with them.
//
// The rule that follows: you may always open up to one week past what you have
// watched. If you watched through week 3, week 4 carries the standing after week
// 3, which you already know. Week 5 does not.

export const NEXT_WEEK_IS_SAFE = 1;

export function maxOpenWeek(watchedThrough) {
  return (Number(watchedThrough) || 0) + NEXT_WEEK_IS_SAFE;
}

export function isLocked(week, watchedThrough) {
  return Number(week) > maxOpenWeek(watchedThrough);
}

/**
 * What opening this week would give away, in words. Returned rather than
 * rendered so the CLI and the web UI say the same thing.
 */
export function lockReason(week, watchedThrough) {
  const w = Number(watchedThrough) || 0;
  const first = w + 1;
  const last = Number(week) - 1;
  const leaked = first === last ? `week ${first}` : `week ${first} tot en met ${last}`;
  const progress = w > 0 ? `Je bent bij week ${w}.` : 'Je bent nog niet begonnen.';
  return `Week ${week} bevat de stand na ${leaked}. ${progress}`;
}

// Weeks split into what you can open freely and what is gated.
export function partitionWeeks(weeks, watchedThrough) {
  const max = maxOpenWeek(watchedThrough);
  return {
    open: weeks.filter((w) => w <= max),
    locked: weeks.filter((w) => w > max),
  };
}
