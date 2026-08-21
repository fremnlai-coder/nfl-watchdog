function Stepper({ label, value, onChange, min = 0, max = 8 }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-stone-600 dark:text-stone-400">{label}</span>
      <span className="inline-flex items-center rounded border border-stone-300 dark:border-stone-700">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-900"
          aria-label={`${label} minder`}
        >
          −
        </button>
        <span className="w-6 text-center font-mono">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-900"
          aria-label={`${label} meer`}
        >
          +
        </button>
      </span>
    </label>
  );
}

export default function Controls({ seasons, season, onSeason, weeks, week, onWeek, quota, onQuota, maxOpen }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-stone-200 py-3 dark:border-stone-800">
      {seasons?.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-600 dark:text-stone-400">Seizoen</span>
          <select
            value={season}
            onChange={(e) => onSeason(e.target.value)}
            className="rounded border border-stone-300 bg-transparent px-2 py-1.5 dark:border-stone-700"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <span className="text-stone-600 dark:text-stone-400">Week</span>
        <select
          value={week}
          onChange={(e) => onWeek(Number(e.target.value))}
          className="rounded border border-stone-300 bg-transparent px-2 py-1.5 dark:border-stone-700"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              {w}
              {maxOpen != null && w > maxOpen ? ' · nog niet gekeken' : ''}
            </option>
          ))}
        </select>
      </label>

      <Stepper
        label="Full replays"
        value={quota.full}
        onChange={(v) => onQuota({ ...quota, full: v })}
      />
      <Stepper
        label="Game in 40"
        value={quota.game_in_40}
        onChange={(v) => onQuota({ ...quota, game_in_40: v })}
      />

      <span className="text-sm text-stone-500 dark:text-stone-400">
        = {quota.full * 185 + quota.game_in_40 * 40} min per week
      </span>
    </div>
  );
}
