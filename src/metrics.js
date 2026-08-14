// Win-probability metrics. Pure functions over a joined play series; nothing in
// here reads the score, so the outputs describe the *shape* of a game, never who
// won. The raw values stay private — only the bucketed 1-5 becomes public.

// Joins plays (period, clock, scoringPlay) to probabilities (homeWinPercentage)
// on the play id that both endpoints expose.
export function joinSeries(playsDoc, probsDoc) {
  const byId = new Map();
  for (const p of playsDoc.items ?? []) {
    byId.set(String(p.id), {
      playId: String(p.id),
      period: p.period?.number ?? 0,
      clock: p.clock?.value ?? 0,
      scoringPlay: Boolean(p.scoringPlay),
      homeScore: p.homeScore ?? 0,
      awayScore: p.awayScore ?? 0,
      seq: Number(p.sequenceNumber ?? 0),
    });
  }
  const rows = [];
  for (const q of probsDoc.items ?? []) {
    const id = String(q.play?.$ref ?? '').split('/').pop()?.split('?')[0];
    const play = byId.get(id);
    if (!play) continue;
    rows.push({ ...play, hwp: q.homeWinPercentage });
  }
  rows.sort((a, b) => a.seq - b.seq);
  return rows;
}

// Sum of the 10 largest single-play swings in win probability.
function excitement(rows) {
  const swings = [];
  for (let i = 1; i < rows.length; i++) {
    swings.push(Math.abs(rows[i].hwp - rows[i - 1].hwp));
  }
  swings.sort((a, b) => b - a);
  return swings.slice(0, 10).reduce((s, v) => s + v, 0);
}

// How close to a coin flip the fourth quarter (and overtime) stayed.
// 1 = dead even throughout, 0 = decided.
function tension(rows) {
  const late = rows.filter((r) => r.period >= 4);
  const sample = late.length >= 5 ? late : rows;
  if (!sample.length) return 0;
  const mean = sample.reduce((s, r) => s + Math.abs(r.hwp - 0.5), 0) / sample.length;
  return Math.max(0, Math.min(1, 1 - 2 * mean));
}

// How often the lead in win probability actually changed hands.
function volatility(rows) {
  let crossings = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].hwp - 0.5;
    const b = rows[i].hwp - 0.5;
    if (a === 0 || b === 0) continue;
    if (Math.sign(a) !== Math.sign(b)) crossings++;
  }
  return crossings;
}

// Scoring plays per minute of regulation.
function pace(rows) {
  const scores = rows.filter((r) => r.scoringPlay).length;
  return scores / 60;
}

// Pre-game only: how much the matchup was worth going in. Built from the records
// carried into the week and how late in the season it is. Never reads results.
export function stakes({ recordBefore, week, gameType, totalWeeks = 18 }) {
  const pct = (r) => {
    const played = r.w + r.l + r.t;
    return played === 0 ? 0.5 : (r.w + 0.5 * r.t) / played;
  };
  const home = pct(recordBefore.home);
  const away = pct(recordBefore.away);
  const quality = (home + away) / 2;
  // Two evenly matched teams matter more than a mismatch of the same average.
  const balance = 1 - Math.abs(home - away);
  const lateness = 0.5 + 0.5 * (week / totalWeeks);
  const divisionBonus = gameType === 'division' ? 0.1 : 0;
  return Math.min(1, (0.6 * quality + 0.4 * balance) * lateness + divisionBonus);
}

export function rawMetrics(rows) {
  return {
    excitement: excitement(rows),
    tension: tension(rows),
    volatility: volatility(rows),
    pace: pace(rows),
  };
}

// Private-side only. Used to build the level 3 file and to give the leak-scan
// test the ground truth it checks the public payload against.
export function finalScore(rows) {
  const last = rows[rows.length - 1];
  if (!last) return null;
  return { home: last.homeScore, away: last.awayScore };
}
