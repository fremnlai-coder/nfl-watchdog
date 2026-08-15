import { useState } from 'react';
import TeamLogo from './TeamLogo.jsx';
import Term from './Term.jsx';
import { explainPick } from '../../../src/explain.js';

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

const BADGE_TERM = {
  divisie: 'division',
  primetime: 'primetime',
  'jouw divisie': 'own_division',
  'indirect belangrijk': 'seeding_impact',
};

const FORMAT_TERM = {
  full: 'full_replay',
  game_in_40: 'game_in_40',
};

// emerald-700 and sky-700 rather than -600: white on -600 measures 3.65 and 4.02
// against a 4.5 requirement for 12px semibold.
const FORMAT_STYLE = {
  full: 'bg-emerald-700 text-white',
  game_in_40: 'bg-sky-700 text-white',
  skip: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
};

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    accent: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Away on top, home below, with the @ in the gutter. Stacking them is what keeps
// the block from breaking apart at 375px, where a single line wrapped into three
// and left the @ stranded on its own.
function TeamLine({ team, record, size }) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamLogo abbr={team.abbr} size={size} />
      <span className="text-lg leading-tight font-semibold">{team.abbr}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-stone-500 dark:text-stone-400">
        {team.name}
      </span>
      <span className="shrink-0 font-mono text-sm text-stone-500 tabular-nums dark:text-stone-400">
        {record}
      </span>
    </div>
  );
}

export default function GameCard({ game, hints, result, onRevealHints, onRevealResult, compact, rank }) {
  const [confirming, setConfirming] = useState(false);
  const [why, setWhy] = useState(false);
  const explanation = explainPick(game, { rank });

  const badges = [];
  if (game.game_type === 'division') badges.push('divisie');
  if (game.primetime) badges.push('primetime');
  if (game.live_friendly_nl && game.is_international) badges.push('live te doen');
  for (const t of game.tags) if (t !== 'own_team') badges.push(t);

  const logoSize = compact ? 24 : 30;

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-950/40">
        <span className="min-w-0 truncate font-mono text-xs text-stone-600 dark:text-stone-400">
          {game.kickoff_nl}
        </span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${FORMAT_STYLE[game.format_advice]}`}
        >
          {FORMAT_TERM[game.format_advice] ? (
            <Term id={FORMAT_TERM[game.format_advice]}>{FORMAT_LABEL[game.format_advice]}</Term>
          ) : (
            FORMAT_LABEL[game.format_advice]
          )}
          {game.runtime_minutes ? ` · ${game.runtime_minutes}m` : ''}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setWhy((v) => !v)}
        aria-expanded={why}
        className="w-full cursor-pointer px-3 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/40"
      >
        <TeamLine team={game.away} record={game.records_before.away} size={logoSize} />
        <div className="my-1 flex items-center gap-2">
          <span className="w-[30px] text-center text-xs text-stone-500 dark:text-stone-400" aria-hidden="true">
            @
          </span>
          <span className="h-px flex-1 bg-stone-100 dark:bg-stone-800" />
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {why ? 'verberg waarom' : 'waarom?'}
          </span>
        </div>
        <TeamLine team={game.home} record={game.records_before.home} size={logoSize} />
      </button>

      {why && (
        <div className="mx-3 mb-3 rounded border border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-950/50">
          <ul className="list-disc space-y-1 pl-4 text-xs text-stone-700 dark:text-stone-300">
            {explanation.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500 italic dark:text-stone-400">
            {explanation.caveat}
          </p>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
        {!compact && game.teaser && (
          <p className="text-sm text-stone-600 dark:text-stone-300">{game.teaser}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-stone-500 dark:text-stone-400">{game.slot}</span>
          {badges.map((b) => (
            <Badge key={b} tone={b === 'indirect belangrijk' ? 'accent' : 'neutral'}>
              {BADGE_TERM[b] ? <Term id={BADGE_TERM[b]}>{b}</Term> : b}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          {REASON_LABEL[game.format_reason] ?? game.format_reason}
          <span className="mx-1.5 text-stone-300 dark:text-stone-700">·</span>
          <Term id="all22">All-22</Term> vanaf {game.all22_from_nl}
        </p>

        {/* Level 2 and 3. Nothing below this line exists until it is clicked. */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {!hints && (
            <button
              type="button"
              onClick={onRevealHints}
              className="rounded border border-stone-300 px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
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
              className="rounded border border-red-400 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
            >
              Toon uitslag
            </button>
          )}

          {confirming && !result && (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-red-700 dark:text-red-300">
                Dit toont de eindstand. Zeker weten?
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onRevealResult();
                }}
                className="rounded bg-red-700 px-2.5 py-1.5 font-semibold text-white hover:bg-red-800"
              >
                Ja, toon
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded border border-stone-300 px-2.5 py-1.5 dark:border-stone-700"
              >
                Nee
              </button>
            </span>
          )}

          {result && (
            <span className="rounded bg-red-50 px-2 py-1 font-mono text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
              {result.score_line} — winnaar {result.winner}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
