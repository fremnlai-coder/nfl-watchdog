import { lockReason } from '../../../src/watched.js';

// Shown instead of the week overview when you skip ahead. Deliberately blocks
// the fetch, not just the rendering: the file it would load carries the
// standings, and "loaded but hidden" is not a spoiler guarantee.
export default function WeekGate({ season, week, watchedThrough, onAdvance, onOverride }) {
  return (
    <section className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        Week {week} zit verder dan je gekeken hebt
      </h2>
      <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
        {lockReason(week, watchedThrough)}
      </p>
      <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-100/70">
        Er staat geen enkele eindstand op deze pagina, maar een record van 3-1 in
        plaats van 2-1 vertelt je alsnog hoe de tussenliggende week afliep — voor
        alle 32 ploegen tegelijk. Daarom is dit weekoverzicht nog niet opgehaald.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAdvance(week - 1)}
          className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
        >
          Ik heb tot en met week {week - 1} gekeken
        </button>
        <button
          type="button"
          onClick={onOverride}
          className="rounded border border-amber-400 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40"
        >
          Toon toch, ik accepteer de spoiler
        </button>
      </div>

      <p className="mt-2 text-xs text-amber-900/60 dark:text-amber-100/60">
        Seizoen {season}. Je stand wordt in deze browser bewaard.
      </p>
    </section>
  );
}
