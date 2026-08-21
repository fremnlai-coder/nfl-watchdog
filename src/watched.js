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
  const leaked = w === 0
    ? `week 1 tot en met ${Number(week) - 1}`
    : `week ${w + 1} tot en met ${Number(week) - 1}`;
  return (
    `De records in week ${week} zijn de stand ná ${leaked}. ` +
    `Je hebt gekeken tot en met week ${w}.`
  );
}

// Weeks split into what you can open freely and what is gated.
export function partitionWeeks(weeks, watchedThrough) {
  const max = maxOpenWeek(watchedThrough);
  return {
    open: weeks.filter((w) => w <= max),
    locked: weeks.filter((w) => w > max),
  };
}
