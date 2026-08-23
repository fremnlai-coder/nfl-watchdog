function Stepper({ label, value, onChange, min = 0, max = 8 }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-20 text-stone-400">{label}</span>
      <span className="inline-flex items-center rounded border border-stone-700">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="min-h-11 min-w-11 hover:bg-stone-900"
          aria-label={`${label} minder`}
        >
          −
        </button>
        <span className="w-7 text-center font-mono">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="min-h-11 min-w-11 hover:bg-stone-900"
          aria-label={`${label} meer`}
        >
          +
        </button>
      </span>
    </div>
  );
}

export default function Controls({
  seasons,
  season,
  onSeason,
  weeks,
  week,
  onWeek,
  quota,
  onQuota,
  durations = { full: 185, game_in_40: 40 },
  withRecap,
  onRecap,
  recapMinutes = 60,
  maxOpen,
}) {
  const minutes = quota.full * durations.full
    + quota.game_in_40 * durations.game_in_40
    + (withRecap ? recapMinutes : 0);

  return (
    <div className="border-y border-stone-800">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
        <label className="flex items-center gap-2 text-sm text-stone-400">
          Week
          <select
            value={week}
            onChange={(event) => onWeek(Number(event.target.value))}
            className="min-h-11 w-20 rounded border border-stone-700 bg-transparent px-2 text-stone-100"
          >
            {weeks.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}{maxOpen != null && candidate > maxOpen ? ' · op slot' : ''}
              </option>
            ))}
          </select>
        </label>

        {seasons?.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-stone-400">
            Seizoen
            <select
              value={season}
              onChange={(event) => onSeason(event.target.value)}
              className="min-h-11 rounded border border-stone-700 bg-transparent px-2 text-stone-100"
            >
              {seasons.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <details className="border-t border-stone-800">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm">
          <span className="text-stone-400">Weekvorm</span>
          <span className="ml-2">{quota.full} Full · {quota.game_in_40}×40</span>
          {withRecap && <span className="ml-1 text-amber-300">· S60</span>}
          <span className="ml-2 text-stone-500">{minutes}m</span>
        </summary>
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <Stepper
            label="Full"
            value={quota.full}
            onChange={(value) => onQuota({ ...quota, full: value })}
          />
          <Stepper
            label="Game in 40"
            value={quota.game_in_40}
            onChange={(value) => onQuota({ ...quota, game_in_40: value })}
          />
          <button
            type="button"
            aria-pressed={withRecap}
            onClick={() => onRecap(!withRecap)}
            className={`min-h-11 rounded border px-3 text-sm ${
              withRecap
                ? 'border-amber-700 bg-amber-950/50 text-amber-200'
                : 'border-stone-700 text-stone-400'
            }`}
          >
            Sunday in 60 · +{recapMinutes}m
          </button>
        </div>
      </details>
    </div>
  );
}
