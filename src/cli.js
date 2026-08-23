// Prints a spoiler-free week overview.
//
// Usage: node src/cli.js --week 14 [--hints] [--result <game_id>]
//
// Reads data/public/ only. The private files are opened solely for the explicit
// --hints and --result flags, which are the CLI equivalent of the two clicks in
// the web UI.

import { readFile } from 'node:fs/promises';
import { planBoth } from './planner.js';
import { isLocked, lockReason, maxOpenWeek } from './watched.js';

const ROOT = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const prefs = JSON.parse(await readFile(new URL('config/preferences.json', ROOT), 'utf8'));
const week = Number(argValue('week', 1));
const season = Number(argValue('season', prefs.season ?? 2025));

// The between-weeks leak: records in week N are the standing after week N-1.
// Reading the file at all is the leak, so this refuses before opening it.
const watchedThrough = Number(argValue('watched', prefs.watched_through_week ?? 0));
if (isLocked(week, watchedThrough) && !hasFlag('force')) {
  console.error(`\n${lockReason(week, watchedThrough)}`);
  console.error(
    `\nZonder die weken te kijken open je hiermee de stand van alle 32 ploegen.` +
    `\nJe kunt nu tot en met week ${maxOpenWeek(watchedThrough)}.` +
    `\n\nWil je het toch: voeg --force toe.` +
    `\nAl verder gekeken: zet watched_through_week in config/preferences.json,` +
    `\nof geef --watched <week> mee.\n`,
  );
  process.exit(1);
}

const data = JSON.parse(
  await readFile(new URL(`data/public/${season}/week-${week}.json`, ROOT), 'utf8'),
);

// The watchability rating is outcome-derived: measured across the 2025 season it
// correlates -0.70 with the final margin, so it tells you a game stayed close
// without ever telling you who won. Turn it off to plan on pre-game stakes only,
// which leaks nothing at all.
const showWatchability = !hasFlag('no-rating') && prefs.show_watchability !== false;

// The planner needs nothing but public fields, so the budget stays a display-time
// knob instead of being baked into the data. The web UI in a later phase runs the
// same function client-side.
const budget = Number(argValue('budget', prefs.weekly_budget_minutes));
const ownFormat = argValue('own-format', prefs.own_team_default_format ?? 'full');
const quota = {
  full: Number(argValue('full', prefs.weekly_quota?.full ?? 2)),
  game_in_40: Number(argValue('in40', prefs.weekly_quota?.game_in_40 ?? 3)),
};
const packages = planBoth(data.games, {
  ...prefs,
  weekly_budget_minutes: budget,
  own_team_default_format: ownFormat,
  weekly_quota: quota,
  planning_basis: showWatchability ? (prefs.planning_basis ?? 'watchability') : 'pre_game_only',
});
const planA = new Map(packages.a.games.map((p) => [p.game_id, p]));
for (const g of data.games) Object.assign(g, planA.get(g.game_id));

const rankOf = new Map(
  prefs.teams.filter((t) => t.tier === 'favorite').map((t) => [t.abbr, t.rank ?? 99]),
);

const FORMAT_LABEL = {
  full: 'Volledig',
  game_in_40: 'Game in 40',
  skip: 'Overslaan',
};
const quotaMode = (prefs.planning_mode ?? 'budget') === 'quota';
const REASON_LABEL = {
  own_team: 'eigen team',
  own_team_degraded: quotaMode
    ? 'eigen team, geen volledige plek meer over'
    : 'eigen team, ingekort voor budget',
  quality: 'belang vooraf',
  budget: 'budget op',
  quota_full: 'kijkplan vol',
  avoid: 'op Nooit',
};

const pad = (s, n) => String(s).padEnd(n);
const stars = (n) => (n == null ? '     ' : '*'.repeat(n).padEnd(5));
const signalOf = (g) => (showWatchability ? stars(g.watchability) : `belang ${g.stakes_pre ?? '-'}`);

function line(g, { showRating }) {
  const matchup = `${g.away.abbr} (${g.records_before.away}) @ ${g.home.abbr} (${g.records_before.home})`;
  const badges = [];
  if (g.game_type === 'division') badges.push('divisie');
  if (g.primetime) badges.push('primetime');
  for (const t of g.tags) if (t !== 'own_team') badges.push(t);
  const advice = `${FORMAT_LABEL[g.format_advice]}${g.runtime_minutes ? ` ${g.runtime_minutes} min` : ''}`;
  return [
    '  ',
    pad(g.kickoff_nl, 17),
    pad(g.slot, 22),
    pad(matchup, 26),
    showRating ? pad(signalOf(g), 8) : pad('', 8),
    pad(advice, 18),
    badges.length ? `[${badges.join(', ')}]` : '',
  ].join('');
}

const teaserLine = (g) => (g.teaser ? `${' '.repeat(19)}${g.teaser}` : null);

// --- Explicit spoiler reveals -------------------------------------------------

if (hasFlag('result')) {
  const id = argValue('result');
  const results = JSON.parse(
    await readFile(new URL(`data/private/${season}/week-${week}.results.json`, ROOT), 'utf8'),
  );
  const r = results[id];
  if (!r) {
    console.error(`Geen uitslag gevonden voor ${id} in week ${week}.`);
    process.exit(1);
  }
  console.log(`\nUITSLAG (level 3) — ${r.score_line}   winnaar: ${r.winner}\n`);
  process.exit(0);
}

if (hasFlag('hints')) {
  const hints = JSON.parse(
    await readFile(new URL(`data/private/${season}/week-${week}.hints.json`, ROOT), 'utf8'),
  );
  const results = JSON.parse(
    await readFile(new URL(`data/private/${season}/week-${week}.results.json`, ROOT), 'utf8'),
  );
  console.log(`\nHINTS (level 2) — week ${week}\n`);
  for (const g of data.games) {
    const r = results[g.game_id]?.watchability;
    console.log(
      `  ${pad(`${g.away.abbr} @ ${g.home.abbr}`, 14)}${pad(r ? stars(r) : '', 7)}` +
      `${(hints[g.game_id] ?? []).join(', ')}`,
    );
  }
  console.log();
  process.exit(0);
}

// --- Week overview ------------------------------------------------------------

const own = data.games
  .filter((g) => g.tags.includes('own_team'))
  .sort((a, b) => {
    const ra = Math.min(rankOf.get(a.home.abbr) ?? 99, rankOf.get(a.away.abbr) ?? 99);
    const rb = Math.min(rankOf.get(b.home.abbr) ?? 99, rankOf.get(b.away.abbr) ?? 99);
    return ra - rb;
  });

const others = data.games.filter((g) => !g.tags.includes('own_team'));
const signalValue = (g) => (showWatchability ? g.watchability : g.stakes_pre) ?? 0;
const worth = others
  .filter((g) => g.format_advice !== 'skip')
  .sort((a, b) => signalValue(b) - signalValue(a));
const rest = others
  .filter((g) => g.format_advice === 'skip')
  .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));

console.log(`\nNFL week ${data.week} · seizoen ${data.season}`);
console.log(
  `Tijden in ${data.timezone} · verschil met New York deze week: ${data.nl_et_offset_hours} uur`,
);
if (data.teams_on_bye.length) console.log(`Bye: ${data.teams_on_bye.join(', ')}`);

console.log('\nJOUW TEAMS  (op voorkeursrang, geen rating — die kijk je toch)');
if (!own.length) console.log('  geen van je teams speelt deze week');
for (const g of own) {
  console.log(line(g, { showRating: false }));
  console.log(`${' '.repeat(19)}${REASON_LABEL[g.format_reason] ?? g.format_reason}`);
  const t = teaserLine(g);
  if (t) console.log(t);
}

console.log(`\nKIJKWAARDIG  (op ${showWatchability ? 'rating' : 'belang vooraf'})`);
if (!worth.length) console.log('  budget volledig opgegaan aan je eigen teams');
for (const g of worth) {
  console.log(line(g, { showRating: true }));
  const t = teaserLine(g);
  if (t) console.log(t);
}

console.log('\nREST VAN DE WEEK');
for (const g of rest) console.log(line(g, { showRating: true }));

// --- Packages -----------------------------------------------------------------

const a = packages.a.summary;
const b = packages.b.summary;
const describe = (p) => {
  const unused = p.unused_slots
    ? Object.entries(p.unused_slots).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}-plek over`)
    : [];
  const bits = [
    `${p.counts.full}x volledig`,
    `${p.counts.game_in_40}x Game in 40`,
    ...unused,
    p.recap_included ? `${p.recap_minutes} min ${prefs.slate_recap.name}` : null,
    `${p.total_minutes} min`,
  ].filter(Boolean);
  const tail = p.recap_included
    ? `${p.recap_covers} wedstrijden alleen als ~5 min samenvatting, ${p.unseen} helemaal ongezien`
    : `${p.unseen} wedstrijden helemaal ongezien`;
  return `${bits.join(' · ')}\n     ${tail}`;
};

console.log('\nKIJKPAKKET');
console.log(`  A  zonder recap    ${describe(a)}`);
if (b.recap_dropped) {
  console.log(
    `  B  met recap       niet mogelijk: na je eigen teams blijven er geen ${prefs.slate_recap.minutes} minuten over`,
  );
} else {
  console.log(`  B  met recap       ${describe(b)}`);
}
if (a.overflow_minutes || b.overflow_minutes) {
  console.log(
    `\n  Let op: je eigen teams passen niet in het budget (${Math.max(a.overflow_minutes, b.overflow_minutes)} min over).`,
  );
}
if (a.own_team_skipped || b.own_team_skipped) {
  console.log(`  Let op: ${Math.max(a.own_team_skipped, b.own_team_skipped)} wedstrijd van een eigen team valt buiten het pakket.`);
}

console.log(showWatchability
  ? '\n  Wat de rating wel en niet zegt: hij meet hoe lang het spannend bleef, niet\n' +
    '  wie er won. Een hoge rating betekent dus dat het verschil klein bleef, een\n' +
    '  lage dat het uit elkaar liep. Wie er won staat er nooit bij. Wil je ook die\n' +
    '  vormindicatie niet zien, draai dan met --no-rating.\n'
  : '\n  Rating verborgen. Er wordt gepland op belang vooraf: de records waarmee beide\n' +
    '  teams de week in gingen. Dat is level 0 en zegt niets over het verloop.\n');
console.log(`  Hints (level 2):     node src/cli.js --week ${week} --hints`);
console.log(`  Uitslag (level 3):   node src/cli.js --week ${week} --result <game_id>\n`);
