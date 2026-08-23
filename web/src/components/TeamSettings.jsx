import TeamLogo from './TeamLogo.jsx';
import { TIERS, TIER_LABEL, TIER_SHORT, setTier, moveFavorite } from '../lib/prefs.js';

// Wit op -600 haalt 3,65 (emerald) en 4,02 (sky) tegen een eis van 4,5, en wit
// op stone-400 blijft op 2,59 steken. Dezelfde correctie als eerder op de
// format-badges in GameCard; die was hier nog niet doorgevoerd.
const TIER_STYLE = {
  favorite: 'bg-emerald-700 text-white',
  watchlist: 'bg-sky-700 text-white',
  neutral: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  avoid: 'bg-stone-600 text-white',
};

function TeamRow({ team, override, favoriteCount, onChange }) {
  const tier = override?.tier ?? 'neutral';
  const rank = override?.rank ?? null;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
      <TeamLogo abbr={team.abbr} size={22} />
      <span className="w-10 shrink-0 font-mono text-xs text-stone-500 dark:text-stone-400">
        {team.abbr}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>

      <span className={`flex w-24 shrink-0 items-center justify-end gap-0.5 ${tier === 'favorite' ? '' : 'invisible'}`}>
          <span className="w-5 text-center font-mono text-xs text-emerald-700 dark:text-emerald-400">
            #{rank}
          </span>
          <button
            type="button"
            aria-label={`${team.name} hoger`}
            disabled={rank === 1}
            onClick={() => onChange((o) => moveFavorite(o, team.abbr, -1))}
            className="min-h-11 min-w-11 rounded text-xs leading-none disabled:opacity-25 hover:bg-stone-800"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`${team.name} lager`}
            disabled={rank === favoriteCount}
            onClick={() => onChange((o) => moveFavorite(o, team.abbr, 1))}
            className="min-h-11 min-w-11 rounded text-xs leading-none disabled:opacity-25 hover:bg-stone-800"
          >
            ↓
          </button>
      </span>

      <span className="ml-auto flex shrink-0 gap-0.5">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange((o) => setTier(o, team.abbr, t))}
            aria-pressed={tier === t}
            title={TIER_LABEL[t]}
            className={`min-h-11 w-14 rounded px-1 text-center text-xs ${
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
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
        Teams
        <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
          {favorites.length
            ? favorites.map((t) => t.abbr).join(' · ')
            : 'geen favorieten gekozen'}
        </span>
      </summary>

      <div className="border-t border-stone-200 px-3 py-3 dark:border-stone-800">
        <p className="text-xs text-stone-500">
          Favoriet krijgt voorrang · Watch helpt bij gelijke inzet · Nooit slaat over.
        </p>

        <div className="mt-3 grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {[...divisions.entries()].map(([label, group]) => (
            <div key={label}>
              <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
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
          className="mt-4 min-h-11 rounded border border-stone-700 px-3 text-xs text-stone-400 hover:bg-stone-900"
        >
          Standaard herstellen
        </button>
      </div>
    </details>
  );
}
