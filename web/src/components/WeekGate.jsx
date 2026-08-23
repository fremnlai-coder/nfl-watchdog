import { lockReason } from '../../../src/watched.js';

export default function WeekGate({ week, watchedThrough, onAdvance, onOverride }) {
  return (
    <section className="mt-6 rounded-lg border border-amber-900 bg-amber-950/40 p-4">
      <h2 className="text-sm font-semibold text-amber-100">Week {week} is op slot</h2>
      <p className="mt-1 text-sm text-amber-100/80">{lockReason(week, watchedThrough)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAdvance(week - 1)}
          className="min-h-11 rounded bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800"
        >
          Tot week {week - 1} gekeken
        </button>
        <button
          type="button"
          onClick={onOverride}
          className="min-h-11 rounded border border-amber-800 px-3 text-xs text-amber-100 hover:bg-amber-900/40"
        >
          Toch openen · spoilers
        </button>
      </div>
    </section>
  );
}
