import { useState } from 'react';
import TeamLogo from './TeamLogo.jsx';

const FORMAT_LABEL = {
  full: 'Full replay',
  game_in_40: 'Game in 40',
  skip: 'Overslaan',
};

const REASON_LABEL = {
  own_team: 'eigen team',
  own_team_degraded: 'eigen team, geen full-plek meer over',
  quality: 'op inzet vooraf',
  budget: 'budget op',
  quota_full: 'weekvorm vol',
  avoid: 'op je avoid-lijst',
};

const FORMAT_STYLE = {
  full: 'bg-emerald-600 text-white',
  game_in_40: 'bg-sky-600 text-white',
  skip: 'bg-stone-300 text-stone-700 dark:bg-stone-800 dark:text-stone-400',
};

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    accent: 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function GameRow({ game, hints, result, onRevealHints, onRevealResult }) {
  const [confirming, setConfirming] = useState(false);

  const badges = [];
  if (game.game_type === 'division') badges.push('divisie');
  if (game.primetime) badges.push('primetime');
  if (game.live_friendly_nl && game.is_international) badges.push('live te doen');
  for (const t of game.tags) if (t !== 'own_team') badges.push(t);

  return (
    <li className="border-b border-stone-200 py-4 last:border-0 dark:border-stone-800">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Kickoff first, matchup underneath it — the time is how you find the
              game back in the DAZN app, the matchup is what you are choosing. */}
          <p className="font-mono text-sm text-stone-500 dark:text-stone-400">
            {game.kickoff_nl}
            <span className="mx-2 text-stone-300 dark:text-stone-700">·</span>
            <span className="font-sans">{game.slot}</span>
          </p>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold">
            <span className="flex items-center gap-2">
              <TeamLogo abbr={game.away.abbr} size={34} />
              {game.away.abbr}
              <span className="text-base font-normal text-stone-400">
                ({game.records_before.away})
              </span>
            </span>
            <span className="text-base font-normal text-stone-400">@</span>
            <span className="flex items-center gap-2">
              <TeamLogo abbr={game.home.abbr} size={34} />
              {game.home.abbr}
              <span className="text-base font-normal text-stone-400">
                ({game.records_before.home})
              </span>
            </span>
          </p>
        </div>

        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${FORMAT_STYLE[game.format_advice]}`}
        >
          {FORMAT_LABEL[game.format_advice]}
          {game.runtime_minutes ? ` · ${game.runtime_minutes}m` : ''}
        </span>
      </div>

      {game.teaser && (
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{game.teaser}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {badges.map((b) => (
          <Badge key={b} tone={b === 'indirect belangrijk' ? 'accent' : 'neutral'}>
            {b}
          </Badge>
        ))}
        <span className="text-xs text-stone-400">
          {REASON_LABEL[game.format_reason] ?? game.format_reason}
        </span>
        <span className="text-xs text-stone-400">· All-22 vanaf {game.all22_from_nl}</span>
      </div>

      {/* Level 2 and 3. Nothing below this line exists until it is clicked. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!hints && (
          <button
            type="button"
            onClick={onRevealHints}
            className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900"
          >
            Toon hints
          </button>
        )}

        {hints && (
          <span className="text-sm text-stone-700 dark:text-stone-300">
            {hints.rating ? '★'.repeat(hints.rating) + ' · ' : ''}
            {hints.hints.join(' · ')}
          </span>
        )}

        {hints && !result && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Toon uitslag
          </button>
        )}

        {confirming && !result && (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-red-700 dark:text-red-400">
              Dit toont de eindstand. Zeker weten?
            </span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onRevealResult();
              }}
              className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700"
            >
              Ja, toon
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-stone-300 px-2 py-1 dark:border-stone-700"
            >
              Nee
            </button>
          </span>
        )}

        {result && (
          <span className="rounded bg-red-100 px-2 py-1 font-mono text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
            {result.score_line} — winnaar {result.winner}
          </span>
        )}
      </div>
    </li>
  );
}
