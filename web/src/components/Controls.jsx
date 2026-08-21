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

// De weekkiezer staat altijd open; de weekvorm zit erachter. Die twee stappers
// zet je één keer per seizoen, en ze kostten bovenaan de ruimte die de eerste
// wedstrijd nodig had. De samenvatting op de summary houdt de stand zichtbaar
// zonder dat je hem hoeft open te klappen.
export default function Controls({ seasons, season, onSeason, weeks, week, onWeek, quota, onQuota, maxOpen }) {
  const minutes = quota.full * 185 + quota.game_in_40 * 40;

  return (
    <div className="border-y border-stone-200 dark:border-stone-800">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-600 dark:text-stone-400">Week</span>
          <select
            value={week}
            onChange={(e) => onWeek(Number(e.target.value))}
            // Vaste breedte: de optie "nog niet gekeken" bepaalde anders de
            // breedte van het hele veld, en dan past Seizoen er niet meer naast.
            // De lijst zelf toont de volledige tekst gewoon.
            className="w-20 rounded border border-stone-300 bg-transparent px-2 py-1.5 dark:border-stone-700"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
                {maxOpen != null && w > maxOpen ? ' · nog niet gekeken' : ''}
              </option>
            ))}
          </select>
        </label>

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
      </div>

      <details className="border-t border-stone-200 dark:border-stone-800">
        <summary className="cursor-pointer py-2 text-sm">
          <span className="text-stone-600 dark:text-stone-400">Weekvorm</span>
          <span className="ml-2">
            {quota.full}× full · {quota.game_in_40}× Game in 40
          </span>
          <span className="ml-2 text-stone-500 dark:text-stone-400">{minutes} min</span>
        </summary>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-3">
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
        </div>
      </details>
    </div>
  );
}
