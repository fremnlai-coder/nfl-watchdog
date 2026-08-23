import { useEffect, useMemo, useState } from 'react';
import { planBoth } from '../../src/planner.js';
import { computeTags } from '../../src/tags.js';
import { isLocked, maxOpenWeek } from '../../src/watched.js';
import { loadHints, loadIndex, loadPrefs, loadResults, loadWeek } from './lib/data.js';
import {
  clearOverrides,
  loadOverrides,
  loadSettings,
  loadViewed,
  loadViewingLog,
  loadWatched,
  mergeTeams,
  overridesFromTeams,
  saveOverrides,
  saveSettings,
  saveViewed,
  saveViewingLog,
  saveWatched,
} from './lib/prefs.js';
import { createViewingEvent, removeViewingEvent, upsertViewingEvent } from './lib/viewing.js';
import Backup from './components/Backup.jsx';
import Controls from './components/Controls.jsx';
import GameCard from './components/GameCard.jsx';
import TeamGuide from './components/TeamGuide.jsx';
import TeamSettings from './components/TeamSettings.jsx';
import Term from './components/Term.jsx';
import ViewingProfile from './components/ViewingProfile.jsx';
import WeekGate from './components/WeekGate.jsx';

const DEFAULT_QUOTA = { full: 2, game_in_40: 3 };

function preferredWeek(weeks, watchedThrough, savedWeek) {
  if (weeks.includes(savedWeek) && !isLocked(savedWeek, watchedThrough)) return savedWeek;
  return weeks.find((candidate) => candidate > watchedThrough) ?? weeks.at(-1);
}

function Timeline({ title, note, games, rowProps, empty = 'Geen wedstrijden.' }) {
  return (
    <section className="mt-5 max-w-3xl">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-semibold tracking-wide text-stone-400 uppercase">{title}</h2>
        {note && <p className="text-xs text-stone-500">{note}</p>}
      </div>
      {games.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {games.map((game) => {
            const skip = game.format_advice === 'skip';
            return (
              <GameCard
                key={game.game_id}
                game={game}
                compact={skip}
                dense={skip}
                {...rowProps(game)}
              />
            );
          })}
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
  const [quota, setQuota] = useState(DEFAULT_QUOTA);
  const [withRecap, setWithRecap] = useState(false);
  const [lastWeeks, setLastWeeks] = useState({});
  const [settingsReady, setSettingsReady] = useState(false);
  const [overrides, setOverrides] = useState(null);
  const [watched, setWatched] = useState(null);
  const [viewed, setViewed] = useState(null);
  const [viewingLog, setViewingLog] = useState(null);
  const [override, setOverride] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const [hints, setHints] = useState({});
  const [results, setResults] = useState({});
  const [revealErrors, setRevealErrors] = useState({});
  const [revealBusy, setRevealBusy] = useState({});

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSettingsReady(false);

    Promise.all([loadIndex(), loadPrefs()])
      .then(([idx, basePrefs]) => {
        if (cancelled) return;
        const storedWatched = loadWatched();
        const initialWatched = Object.keys(storedWatched).length
          ? storedWatched
          : { [idx.current]: basePrefs.watched_through_week ?? 0 };
        const storedSettings = loadSettings();
        const seasons = Object.keys(idx.seasons);
        const current = seasons.includes(storedSettings.last_season)
          ? storedSettings.last_season
          : (seasons.includes(idx.current) ? idx.current : seasons.sort().at(-1));
        const startWeek = preferredWeek(
          idx.seasons[current],
          initialWatched[current] ?? 0,
          storedSettings.last_week_by_season?.[current],
        );

        setIndex(idx);
        setPrefs(basePrefs);
        setOverrides(loadOverrides() ?? overridesFromTeams(basePrefs.teams));
        setWatched(initialWatched);
        setViewed(loadViewed());
        setViewingLog(loadViewingLog());
        setQuota({
          ...(basePrefs.weekly_quota ?? DEFAULT_QUOTA),
          ...(storedSettings.weekly_quota ?? {}),
        });
        setWithRecap(storedSettings.with_recap ?? false);
        setLastWeeks({ ...(storedSettings.last_week_by_season ?? {}), [current]: startWeek });
        setSeason(current);
        setWeek(startWeek);
        setSettingsReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (overrides) saveOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    if (watched) saveWatched(watched);
  }, [watched]);

  useEffect(() => {
    if (viewed) saveViewed(viewed);
  }, [viewed]);

  useEffect(() => {
    if (viewingLog) saveViewingLog(viewingLog);
  }, [viewingLog]);

  useEffect(() => {
    if (!settingsReady || !season || !week) return;
    saveSettings({
      weekly_quota: quota,
      with_recap: withRecap,
      last_season: season,
      last_week_by_season: { ...lastWeeks, [season]: week },
    });
  }, [settingsReady, quota, withRecap, season, week, lastWeeks]);

  const watchedThrough = watched?.[season] ?? 0;
  const gated = week != null
    && watched != null
    && isLocked(week, watchedThrough)
    && override !== `${season}:${week}`;

  useEffect(() => {
    if (!settingsReady || week == null || season == null || watched == null) return undefined;
    let cancelled = false;
    setData(null);
    setHints({});
    setResults({});
    setRevealErrors({});
    setRevealBusy({});
    setError(null);
    if (gated) return () => { cancelled = true; };

    loadWeek(season, week)
      .then((doc) => {
        if (!cancelled) setData(doc);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [settingsReady, season, week, gated, attempt]);

  const teams = useMemo(
    () => (prefs ? mergeTeams(prefs.teams, overrides) : []),
    [prefs, overrides],
  );

  const planned = useMemo(() => {
    if (!data || !prefs) return null;
    const retagged = data.games.map((game) => {
      const tags = computeTags(game, teams);
      return {
        ...game,
        tags,
        watchability: tags.includes('own_team') ? null : game.watchability,
      };
    });
    const packages = planBoth(retagged, { ...prefs, teams, weekly_quota: quota });
    const byId = new Map(packages.a.games.map((pick) => [pick.game_id, pick]));
    return {
      packages,
      games: retagged.map((game) => ({ ...game, ...byId.get(game.game_id) })),
    };
  }, [data, prefs, teams, quota]);

  const viewedIds = useMemo(
    () => new Set(viewed?.[season] ?? []),
    [viewed, season],
  );

  function chooseWeek(nextWeek) {
    setWeek(nextWeek);
    setOverride(null);
    setLastWeeks((previous) => ({ ...previous, [season]: nextWeek }));
  }

  function chooseSeason(nextSeason) {
    const nextWeek = preferredWeek(
      index.seasons[nextSeason],
      watched?.[nextSeason] ?? 0,
      lastWeeks[nextSeason],
    );
    setSeason(nextSeason);
    setWeek(nextWeek);
    setOverride(null);
    setLastWeeks((previous) => ({ ...previous, [nextSeason]: nextWeek }));
  }

  function updateOverrides(fn) {
    setOverrides((previous) => fn(previous));
  }

  function resetOverrides() {
    clearOverrides();
    setOverrides(overridesFromTeams(prefs.teams));
  }

  function markViewed(game, viewFormat, { recapped = false } = {}) {
    setViewed((previous) => {
      const ids = new Set(previous?.[season] ?? []);
      ids.add(game.game_id);
      return { ...(previous ?? {}), [season]: [...ids].sort() };
    });
    setViewingLog((previous) => upsertViewingEvent(previous, createViewingEvent(game, {
      season,
      week,
      viewFormat,
      suggested: game.format_advice !== 'skip' || recapped,
      plannedFormat: recapped ? 'sunday_in_60' : game.format_advice,
    })));
  }

  function unmarkViewed(gameId) {
    setViewed((previous) => {
      const ids = new Set(previous?.[season] ?? []);
      ids.delete(gameId);
      return { ...(previous ?? {}), [season]: [...ids].sort() };
    });
    setViewingLog((previous) => removeViewingEvent(previous, season, gameId));
  }

  function restoreBackup({
    teams: restoredTeams,
    watched: restoredWatched,
    settings,
    viewed: restoredViewed,
    viewing_log: restoredViewingLog,
  }) {
    const restoredSeason = index.seasons[settings.last_season] ? settings.last_season : season;
    const restoredWeek = preferredWeek(
      index.seasons[restoredSeason],
      restoredWatched[restoredSeason] ?? 0,
      settings.last_week_by_season?.[restoredSeason],
    );
    setOverrides(restoredTeams);
    setWatched(restoredWatched);
    setViewed(restoredViewed);
    setViewingLog(restoredViewingLog);
    setQuota({ ...(prefs.weekly_quota ?? DEFAULT_QUOTA), ...(settings.weekly_quota ?? {}) });
    setWithRecap(settings.with_recap ?? false);
    setLastWeeks({ ...(settings.last_week_by_season ?? {}), [restoredSeason]: restoredWeek });
    setSeason(restoredSeason);
    setWeek(restoredWeek);
    setOverride(null);
  }

  async function revealHints(game) {
    const id = game.game_id;
    setRevealBusy((previous) => ({ ...previous, [id]: 'hints' }));
    setRevealErrors((previous) => ({ ...previous, [id]: null }));
    try {
      const gameHints = await loadHints(season, week, id);
      setHints((previous) => ({ ...previous, [id]: { hints: gameHints, rating: null } }));
    } catch (err) {
      setRevealErrors((previous) => ({ ...previous, [id]: err.message }));
    } finally {
      setRevealBusy((previous) => ({ ...previous, [id]: null }));
    }
  }

  async function revealResult(game) {
    const id = game.game_id;
    setRevealBusy((previous) => ({ ...previous, [id]: 'result' }));
    setRevealErrors((previous) => ({ ...previous, [id]: null }));
    try {
      const result = await loadResults(season, week, id);
      setResults((previous) => ({ ...previous, [id]: result }));
      setHints((previous) => ({
        ...previous,
        [id]: { ...previous[id], rating: result.watchability },
      }));
    } catch (err) {
      setRevealErrors((previous) => ({ ...previous, [id]: err.message }));
    } finally {
      setRevealBusy((previous) => ({ ...previous, [id]: null }));
    }
  }

  if (error) {
    return (
      <main className="app-shell mx-auto max-w-5xl">
        <h1 className="text-xl font-bold">NFL Watchdog</h1>
        <p className="mt-4 text-sm text-red-400">Laden mislukt.</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-3 min-h-11 rounded border border-stone-700 px-4 text-sm"
        >
          Opnieuw
        </button>
      </main>
    );
  }

  const controls = index && season && week ? (
    <Controls
      seasons={Object.keys(index.seasons).sort().reverse()}
      season={season}
      onSeason={chooseSeason}
      weeks={index.seasons[season]}
      week={week}
      onWeek={chooseWeek}
      quota={quota}
      onQuota={setQuota}
      durations={prefs?.format_durations_minutes}
      withRecap={withRecap}
      onRecap={setWithRecap}
      recapMinutes={prefs?.slate_recap?.minutes ?? 60}
      maxOpen={maxOpenWeek(watchedThrough)}
    />
  ) : null;

  if (gated && prefs && index) {
    return (
      <main className="app-shell mx-auto max-w-5xl">
        <h1 className="text-xl font-bold">NFL Watchdog</h1>
        <div className="mt-3">{controls}</div>
        <WeekGate
          week={week}
          watchedThrough={watchedThrough}
          onAdvance={(value) => setWatched((previous) => ({
            ...previous,
            [season]: Math.max(previous[season] ?? 0, value),
          }))}
          onOverride={() => setOverride(`${season}:${week}`)}
        />
        <Backup onRestore={restoreBackup} />
      </main>
    );
  }

  if (!planned || !prefs || !overrides || !index || !watched || !viewed || !viewingLog) {
    return <main className="app-shell mx-auto max-w-5xl text-stone-500">Laden…</main>;
  }

  const rankOf = new Map(
    teams.filter((team) => team.tier === 'favorite').map((team) => [team.abbr, team.rank ?? 99]),
  );
  const timeline = [...planned.games].sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
  const picks = timeline.filter((game) => game.format_advice !== 'skip');
  const skipped = timeline.filter((game) => game.format_advice === 'skip');
  const seenCount = picks.filter((game) => viewedIds.has(game.game_id)).length;
  const extraSeenCount = skipped.filter((game) => viewedIds.has(game.game_id)).length;
  const nextGame = picks.find((game) => !viewedIds.has(game.game_id));
  const recap = planned.packages.b.summary;
  const recapActive = withRecap && recap.recap_included;
  const allSeen = picks.length > 0 && seenCount === picks.length;
  const viewingEvents = new Map(
    viewingLog
      .filter((event) => event.season === String(season))
      .map((event) => [event.game_id, event]),
  );
  const legacyViewedCount = [...viewedIds]
    .filter((gameId) => !viewingEvents.has(gameId)).length;

  const rowProps = (game) => {
    const recapped = recapActive && game.format_advice === 'skip' && game.in_sunday_slate;
    return {
      rank: rankOf.get(game.home.abbr) ?? rankOf.get(game.away.abbr) ?? null,
      hints: hints[game.game_id],
      result: results[game.game_id],
      revealError: revealErrors[game.game_id],
      busy: revealBusy[game.game_id],
      viewed: viewedIds.has(game.game_id),
      viewedFormat: viewingEvents.get(game.game_id)?.view_format ?? null,
      next: nextGame?.game_id === game.game_id,
      recapped,
      onMarkViewed: (format) => markViewed(game, format, { recapped }),
      onUnmarkViewed: () => unmarkViewed(game.game_id),
      onRevealHints: () => revealHints(game),
      onRevealResult: () => revealResult(game),
    };
  };

  const progress = [
    `${picks.length} gepland`,
    `${seenCount}/${picks.length} gezien`,
    extraSeenCount > 0 && `${extraSeenCount} extra gezien`,
    `${skipped.length} overslaan`,
    recapActive && `${recap.recap_covers} via S60`,
  ].filter(Boolean).join(' · ');

  return (
    <main className="app-shell mx-auto max-w-5xl">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-xl font-bold">NFL Watchdog</h1>
        <p className="text-xs text-stone-500">
          {data.season}
          {data.teams_on_bye.length > 0 && (
            <> · <Term id="bye">bye</Term>: {data.teams_on_bye.join(', ')}</>
          )}
        </p>
      </header>

      <div className="mt-3">{controls}</div>

      <Timeline
        title={`Week ${data.week}`}
        note={progress}
        games={timeline}
        rowProps={rowProps}
      />

      {watchedThrough < week && (
        <button
          type="button"
          onClick={() => setWatched((previous) => ({
            ...previous,
            [season]: Math.max(previous[season] ?? 0, week),
          }))}
          className={`mt-5 min-h-11 rounded border px-4 text-sm ${
            allSeen
              ? 'border-emerald-700 bg-emerald-950/50 text-emerald-200'
              : 'border-stone-700 text-stone-400'
          }`}
        >
          Week afronden →
        </button>
      )}

      <div className="mt-10">
        <ViewingProfile
          log={viewingLog}
          season={season}
          teams={prefs.teams}
          legacyCount={legacyViewedCount}
          onClear={() => setViewingLog([])}
        />
        <TeamSettings
          teams={prefs.teams}
          overrides={overrides}
          onChange={updateOverrides}
          onReset={resetOverrides}
        />
        <Backup onRestore={restoreBackup} />
      </div>

      <TeamGuide season={index.current} />

      <footer className="mt-10 border-t border-stone-800 pt-4 text-xs text-stone-500">
        Spoilervrij · hints en uitslagen laden alleen na jouw keuze.
      </footer>
    </main>
  );
}
