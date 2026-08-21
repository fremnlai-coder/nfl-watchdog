import { useEffect, useMemo, useState } from 'react';
// The same planner the CLI uses. It only ever reads public fields, which is why
// it can run in the browser at all.
import { planBoth } from '../../src/planner.js';
// Tags are recomputed here rather than read from the payload: favourites can be
// changed in the UI, and tags baked at ingest time would describe the old ones.
import { computeTags } from '../../src/tags.js';
import { loadIndex, loadPrefs, loadWeek, loadHints, loadResults } from './lib/data.js';
import {
  loadOverrides, saveOverrides, clearOverrides, overridesFromTeams, mergeTeams,
  loadWatched, saveWatched,
} from './lib/prefs.js';
import { isLocked, maxOpenWeek } from '../../src/watched.js';
import Controls from './components/Controls.jsx';
import GameCard from './components/GameCard.jsx';
import PackageSummary from './components/PackageSummary.jsx';
import TeamSettings from './components/TeamSettings.jsx';
import Explainer from './components/Explainer.jsx';
import Term from './components/Term.jsx';
import WeekGate from './components/WeekGate.jsx';
import Backup from './components/Backup.jsx';

function Section({ title, note, games, rowProps, empty = 'Niets deze week.', compact, dense }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
        {title}
        <span className="ml-2 font-normal normal-case">{games.length}</span>
      </h2>
      {note && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{note}</p>}
      {games.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{empty}</p>
      ) : (
        <ul className={`mt-3 grid items-stretch ${dense ? 'gap-1.5' : 'gap-3 sm:grid-cols-2'}`}>
          {games.map((g) => (
            <GameCard key={g.game_id} game={g} compact={compact} dense={dense} {...rowProps(g)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const [index, setIndex] = useState(null);
  const [season, setSeason] = useState(null);
  const [week, setWeek] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [data, setData] = useState(null);
  const [quota, setQuota] = useState({ full: 2, game_in_40: 3 });
  const [overrides, setOverrides] = useState(null);
  const [watched, setWatched] = useState(null);
  const [override, setOverride] = useState(null); // season:week you chose to unlock anyway
  const [error, setError] = useState(null);

  // Revealed level 2 / level 3 data, keyed by game id. Empty on load, and it
  // stays empty until a button is pressed.
  const [hints, setHints] = useState({});
  const [results, setResults] = useState({});

  useEffect(() => {
    Promise.all([loadIndex(), loadPrefs()])
      .then(([idx, p]) => {
        setIndex(idx);
        setPrefs(p);
        setQuota(p.weekly_quota ?? { full: 2, game_in_40: 3 });
        // A first visit starts from preferences.json; after that your own
        // choices win.
        setOverrides(loadOverrides() ?? overridesFromTeams(p.teams));
        const stored = loadWatched();
        setWatched(
          Object.keys(stored).length ? stored : { [idx.current]: p.watched_through_week ?? 0 },
        );
        const current = idx.current in idx.seasons ? idx.current : Object.keys(idx.seasons).sort().pop();
        setSeason(current);
        setWeek(idx.seasons[current][0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Persisting belongs in an effect, not in the state updater: StrictMode calls
  // updaters twice on purpose to surface impure ones, and a write to storage
  // from inside one is exactly that.
  useEffect(() => {
    if (overrides) saveOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    if (watched) saveWatched(watched);
  }, [watched]);

  function updateOverrides(fn) {
    setOverrides((prev) => fn(prev));
  }

  function resetOverrides() {
    clearOverrides();
    setOverrides(overridesFromTeams(prefs.teams));
  }

  // A restore replaces both halves at once. Anything half-applied would leave
  // the watched counter and the favourites describing different moments.
  function restoreBackup({ teams, watched: restored }) {
    setOverrides(teams);
    setWatched(restored);
    setOverride(null);
  }

  const watchedThrough = watched?.[season] ?? 0;
  const gated =
    watched != null && isLocked(week, watchedThrough) && override !== `${season}:${week}`;

  useEffect(() => {
    if (week == null || season == null || watched == null) return;
    setData(null);
    // Revealing a game in one week must not carry over to the next.
    setHints({});
    setResults({});
    // The gate blocks the fetch, not just the render: this file carries the
    // standings going into the week, which is the leak it exists to stop.
    if (gated) return;
    loadWeek(season, week).then(setData).catch((e) => setError(e.message));
  }, [season, week, watched, gated]);

  const teams = useMemo(
    () => (prefs ? mergeTeams(prefs.teams, overrides) : []),
    [prefs, overrides],
  );

  const planned = useMemo(() => {
    if (!data || !prefs) return null;
    // Retag first, then plan: everything downstream depends on who counts as
    // your team right now, not on who did at ingest time.
    const retagged = data.games.map((g) => {
      const tags = computeTags(g, teams);
      return {
        ...g,
        tags,
        // Your own teams never show a rating, whichever teams those are today.
        watchability: tags.includes('own_team') ? null : g.watchability,
      };
    });
    const packages = planBoth(retagged, { ...prefs, teams, weekly_quota: quota });
    const byId = new Map(packages.a.games.map((p) => [p.game_id, p]));
    return {
      packages,
      games: retagged.map((g) => ({ ...g, ...byId.get(g.game_id) })),
    };
  }, [data, prefs, teams, quota]);

  async function revealHints(game) {
    const doc = await loadHints(season, week);
    // Only the game that was clicked is lifted out of the file.
    setHints((prev) => ({
      ...prev,
      [game.game_id]: { hints: doc[game.game_id] ?? [], rating: null },
    }));
  }

  async function revealResult(game) {
    const doc = await loadResults(season, week);
    const r = doc[game.game_id];
    if (!r) return;
    setResults((prev) => ({ ...prev, [game.game_id]: r }));
    // The rating is level 2 material; once the score is out it can come along.
    setHints((prev) => ({
      ...prev,
      [game.game_id]: { ...prev[game.game_id], rating: r.watchability },
    }));
  }

  if (error) {
    return (
      <main className="app-shell mx-auto max-w-5xl">
        <p className="text-red-700 dark:text-red-400">Laden mislukt: {error}</p>
      </main>
    );
  }

  if (gated && prefs && index) {
    return (
      <main className="app-shell mx-auto max-w-5xl">
        <header>
          <h1 className="text-2xl font-bold">NFL Watchdog</h1>
        </header>
        <div className="mt-4">
          <Controls
            seasons={Object.keys(index.seasons).sort().reverse()}
            season={season}
            onSeason={(s) => { setSeason(s); setWeek(index.seasons[s][0]); }}
            weeks={index.seasons[season]}
            week={week}
            onWeek={setWeek}
            quota={quota}
            onQuota={setQuota}
            maxOpen={maxOpenWeek(watchedThrough)}
          />
        </div>
        <WeekGate
          season={season}
          week={week}
          watchedThrough={watchedThrough}
          onAdvance={(w) => setWatched((prev) => ({ ...prev, [season]: w }))}
          onOverride={() => setOverride(`${season}:${week}`)}
        />
        {/* Here as well, because this is the screen you land on once iOS has
            wiped the storage: the counter is back to zero and every week you had
            already watched sits behind the gate. */}
        <Backup onRestore={restoreBackup} />
      </main>
    );
  }

  if (!planned || !prefs || !overrides || !index || !watched) {
    return (
      <main className="app-shell mx-auto max-w-5xl">
        <p className="text-stone-500">Laden…</p>
      </main>
    );
  }

  const rankOf = new Map(
    teams.filter((t) => t.tier === 'favorite').map((t) => [t.abbr, t.rank ?? 99]),
  );
  const rankFor = (g) =>
    Math.min(rankOf.get(g.home.abbr) ?? 99, rankOf.get(g.away.abbr) ?? 99);

  const own = planned.games
    .filter((g) => g.tags.includes('own_team'))
    .sort((a, b) => rankFor(a) - rankFor(b));
  const others = planned.games.filter((g) => !g.tags.includes('own_team'));
  const signal = (g) => (g.watchability ?? g.stakes_pre ?? 0);
  const worth = others
    .filter((g) => g.format_advice !== 'skip')
    .sort((a, b) => signal(b) - signal(a));
  const rest = others
    .filter((g) => g.format_advice === 'skip')
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));

  const rowProps = (g) => ({
    rank: rankOf.get(g.home.abbr) ?? rankOf.get(g.away.abbr) ?? null,
    hints: hints[g.game_id],
    result: results[g.game_id],
    onRevealHints: () => revealHints(g),
    onRevealResult: () => revealResult(g),
  });

  return (
    <main className="app-shell mx-auto max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold">NFL Watchdog</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Week {data.week} · seizoen {data.season} · tijden in {data.timezone} ·
          verschil met New York deze week: {data.nl_et_offset_hours} uur
        </p>
        {data.teams_on_bye.length > 0 && (
          <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
            <Term id="bye">Bye</Term>: {data.teams_on_bye.join(', ')}
          </p>
        )}
      </header>

      <div className="mt-4">
        <Controls
          seasons={Object.keys(index.seasons).sort().reverse()}
          season={season}
          onSeason={(s) => { setSeason(s); setWeek(index.seasons[s][0]); }}
          weeks={index.seasons[season]}
          week={week}
          onWeek={setWeek}
          quota={quota}
          onQuota={setQuota}
          maxOpen={maxOpenWeek(watchedThrough)}
        />
      </div>

      <PackageSummary packages={planned.packages} recapName={prefs.slate_recap?.name} />

      <Section
        title="Jouw teams"
        note="Op voorkeursrang, nooit op rating — die volgorde zou de uitkomst verraden."
        games={own}
        rowProps={rowProps}
        empty="Geen van je teams speelt deze week."
      />

      <Section
        title="Kijkwaardig"
        note={
          prefs.show_watchability === false
            ? 'Op inzet vooraf: de records waarmee beide teams de week in gingen.'
            : 'Op rating.'
        }
        games={worth}
        rowProps={rowProps}
        empty="De weekvorm is volledig opgegaan aan je eigen teams."
      />

      <Section
        title="Rest van de week"
        note="Buiten je weekvorm gevallen. Eén regel per wedstrijd; tik voor de kaart."
        games={rest}
        rowProps={rowProps}
        compact
        dense
      />

      {watchedThrough < week && (
        <p className="mt-6 text-sm">
          <button
            type="button"
            onClick={() => setWatched((prev) => ({ ...prev, [season]: week }))}
            className="rounded border border-stone-300 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Week {week} afgevinkt — deze heb ik gekeken
          </button>
          {/* Op een eigen regel: naast de knop wikkelde deze zin op 375px om de
              knop heen en brak hij midden in de zin af. */}
          <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">
            Daarmee gaat week {week + 1} open.
          </span>
        </p>
      )}

      {/* Instellingen staan onder de wedstrijden. Ze worden zelden aangeraakt en
          namen bovenaan de ruimte in die de eerste wedstrijd nodig had om nog
          boven de vouw uit te komen; de samenvatting van je week is wél elke keer
          relevant en staat daarom wel bovenaan. */}
      <div className="mt-10">
        <TeamSettings
          teams={prefs.teams}
          overrides={overrides}
          onChange={updateOverrides}
          onReset={resetOverrides}
        />
        <Backup onRestore={restoreBackup} />
      </div>

      <Explainer timezone={data.timezone} offsetHours={data.nl_et_offset_hours} />

      <footer className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <p>
          Deze pagina bevat geen enkele eindstand. Hints en uitslagen worden pas
          opgehaald op het moment dat je erop klikt, niet bij het laden.
        </p>
        <p className="mt-1">
          Bekijk je een afgelopen week, open dan geen latere week: de records daar zijn
          de stand ná deze speelronde.
        </p>
      </footer>
    </main>
  );
}
