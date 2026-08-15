import TeamLogo from './TeamLogo.jsx';
import { TIERS, TIER_LABEL, TIER_SHORT, setTier, moveFavorite } from '../lib/prefs.js';

const TIER_STYLE = {
  favorite: 'bg-emerald-600 text-white',
  watchlist: 'bg-sky-600 text-white',
  neutral: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  avoid: 'bg-stone-400 text-white dark:bg-stone-600',
};

function TeamRow({ team, override, favoriteCount, onChange }) {
  const tier = override?.tier ?? 'neutral';
  const rank = override?.rank ?? null;

  return (
    <li className="flex items-center gap-2 py-1">
      <TeamLogo abbr={team.abbr} size={22} />
      <span className="w-10 shrink-0 font-mono text-xs text-stone-500 dark:text-stone-400">
        {team.abbr}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>

      <span className={`flex w-14 shrink-0 items-center justify-end gap-0.5 ${tier === 'favorite' ? '' : 'invisible'}`}>
          <span className="w-5 text-center font-mono text-xs text-emerald-600 dark:text-emerald-400">
            #{rank}
          </span>
          <button
            type="button"
            aria-label={`${team.name} hoger`}
            disabled={rank === 1}
            onClick={() => onChange((o) => moveFavorite(o, team.abbr, -1))}
            className="rounded px-1 text-xs disabled:opacity-25 hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`${team.name} lager`}
            disabled={rank === favoriteCount}
            onClick={() => onChange((o) => moveFavorite(o, team.abbr, 1))}
            className="rounded px-1 text-xs disabled:opacity-25 hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            ↓
          </button>
      </span>

      <span className="flex shrink-0 gap-0.5">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange((o) => setTier(o, team.abbr, t))}
            aria-pressed={tier === t}
            title={TIER_LABEL[t]}
            className={`w-12 rounded px-1 py-0.5 text-center text-xs ${
              tier === t
                ? TIER_STYLE[t]
                : 'text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            {TIER_SHORT[t]}
          </button>
        ))}
      </span>
    </li>
  );
}

export default function TeamSettings({ teams, overrides, onChange, onReset }) {
  const favoriteCount = Object.values(overrides).filter((v) => v.tier === 'favorite').length;

  const divisions = new Map();
  for (const team of teams) {
    const key = `${team.conference} — ${team.division}`;
    if (!divisions.has(key)) divisions.set(key, []);
    divisions.get(key).push(team);
  }

  const favorites = teams
    .filter((t) => overrides[t.abbr]?.tier === 'favorite')
    .sort((a, b) => (overrides[a.abbr].rank ?? 99) - (overrides[b.abbr].rank ?? 99));

  return (
    <details className="mt-4 rounded border border-stone-200 dark:border-stone-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Teams
        <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
          {favorites.length
            ? favorites.map((t) => t.abbr).join(' · ')
            : 'geen favorieten gekozen'}
        </span>
      </summary>

      <div className="border-t border-stone-200 px-3 py-3 dark:border-stone-800">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Favorieten krijgen als eerste een plek in de weekvorm, op de volgorde die je
          hier zet. Watchlist telt mee bij gelijke inzet, Nooit krijgt nooit een plek.
          Je keuze blijft in deze browser bewaard.
        </p>

        <div className="mt-3 grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {[...divisions.entries()].map(([label, group]) => (
            <div key={label}>
              <h3 className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
                {label}
              </h3>
              <ul className="mt-1">
                {group.map((team) => (
                  <TeamRow
                    key={team.abbr}
                    team={team}
                    override={overrides[team.abbr]}
                    favoriteCount={favoriteCount}
                    onChange={onChange}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900"
        >
          Terug naar de instellingen uit preferences.json
        </button>
      </div>
    </details>
  );
}
