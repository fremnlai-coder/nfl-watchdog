import { useState } from 'react';
import { explainPick } from '../../../src/explain.js';
import { contextChips } from '../lib/chips.js';
import TeamLogo from './TeamLogo.jsx';
import Term from './Term.jsx';

const FORMAT_LABEL = {
  full: 'Volledig',
  game_in_40: 'Game in 40',
  skip: 'Overslaan',
};

const REASON_LABEL = {
  own_team: 'favoriet',
  own_team_degraded: 'favoriet · ingekort',
  quality: 'belang vooraf',
  budget: 'geen plek',
  quota_full: 'geen plek',
  avoid: 'op Nooit',
};

const FORMAT_TERM = {
  full: 'full_replay',
  game_in_40: 'game_in_40',
};

const FORMAT_STYLE = {
  full: 'bg-emerald-700 text-white',
  game_in_40: 'bg-sky-700 text-white',
  skip: 'bg-stone-800 text-stone-300',
  recap: 'bg-amber-800 text-amber-50',
};

const BADGE_STYLE = {
  neutral: 'bg-stone-800 text-stone-300',
  emerald: 'bg-emerald-950 text-emerald-200 ring-1 ring-inset ring-emerald-800',
  sky: 'bg-sky-950 text-sky-200 ring-1 ring-inset ring-sky-800',
  amber: 'bg-amber-950 text-amber-100 ring-1 ring-inset ring-amber-800',
};

function Badge({ children, tone = 'neutral' }) {
  const style = BADGE_STYLE[tone] ?? BADGE_STYLE.neutral;
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}

function TeamLine({ team, record, size }) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamLogo abbr={team.abbr} size={size} />
      <span className="text-lg leading-tight font-semibold">{team.abbr}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-stone-400">{team.name}</span>
      <span className="shrink-0 font-mono text-sm text-stone-400 tabular-nums">{record}</span>
    </div>
  );
}

export default function GameCard({
  game,
  hints,
  result,
  onRevealHints,
  onRevealResult,
  compact,
  dense,
  rank,
  viewed,
  next,
  recapped,
  onToggleViewed,
  revealError,
  busy,
}) {
  const [confirming, setConfirming] = useState(false);
  const [why, setWhy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const explanation = explainPick(game, { rank });
  const chips = contextChips(game, { rank, next });

  const formatLabel = recapped ? 'Sunday in 60' : FORMAT_LABEL[game.format_advice];
  const formatTerm = recapped ? 'sunday_in_60' : FORMAT_TERM[game.format_advice];
  const formatStyle = recapped ? FORMAT_STYLE.recap : FORMAT_STYLE[game.format_advice];
  const shortReason = recapped ? 'Sunday in 60' : (REASON_LABEL[game.format_reason] ?? game.format_reason);
  const logoSize = compact ? 24 : 30;

  if (dense && !expanded) {
    return (
      <li className="rounded-lg border border-stone-800 bg-stone-900">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left"
        >
          <span className="shrink-0 font-mono text-xs text-stone-400">{game.kickoff_nl}</span>
          <span className="shrink-0 text-sm font-semibold">
            {game.away.abbr}<span className="mx-1 font-normal text-stone-500">@</span>{game.home.abbr}
          </span>
          <span className={`ml-auto min-w-0 truncate text-xs ${recapped ? 'text-amber-300' : 'text-stone-500'}`}>
            {shortReason}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li className={`flex flex-col overflow-hidden rounded-lg border bg-stone-900 shadow-sm ${
      next ? 'border-emerald-700 ring-1 ring-emerald-900' : 'border-stone-800'
    }`}>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-stone-800 bg-stone-950/40 px-3">
        {dense ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-expanded={true}
            className="min-h-11 min-w-0 truncate font-mono text-xs text-stone-400"
          >
            {game.kickoff_nl}<span className="ml-1.5 font-sans">· minder</span>
          </button>
        ) : (
          <span className="min-w-0 truncate font-mono text-xs text-stone-400">{game.kickoff_nl}</span>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${formatStyle}`}>
            {formatTerm ? <Term id={formatTerm}>{formatLabel}</Term> : formatLabel}
            {!recapped && game.runtime_minutes ? ` · ${game.runtime_minutes} min` : ''}
          </span>
        </div>
      </div>

      <div className="px-3 py-3">
        <TeamLine team={game.away} record={game.records_before.away} size={logoSize} />
        <div className="my-1 flex items-center gap-2">
          <span className="w-[30px] text-center text-xs text-stone-500" aria-hidden="true">@</span>
          <span className="h-px flex-1 bg-stone-800" />
        </div>
        <TeamLine team={game.home} record={game.records_before.home} size={logoSize} />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
        {!compact && game.teaser && <p className="text-sm text-stone-300">{game.teaser}</p>}

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            {chips.map((chip) => (
              <Badge key={chip.key} tone={chip.tone}>
                {chip.term ? <Term id={chip.term}>{chip.label}</Term> : chip.label}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setWhy((value) => !value)}
            aria-expanded={why}
            className="min-h-11 rounded border border-stone-700 px-3 text-xs text-stone-300 hover:bg-stone-800"
          >
            {why ? 'Sluiten' : 'Waarom?'}
          </button>

          {game.format_advice !== 'skip' && (
            <button
              type="button"
              aria-pressed={viewed}
              onClick={onToggleViewed}
              className={`min-h-11 rounded border px-3 text-xs ${
                viewed
                  ? 'border-emerald-700 bg-emerald-950 text-emerald-200'
                  : 'border-stone-700 text-stone-300 hover:bg-stone-800'
              }`}
            >
              {viewed ? '✓ Gezien' : 'Gezien'}
            </button>
          )}

          {game.hints_ready && !hints && (
            <button
              type="button"
              disabled={busy === 'hints'}
              onClick={onRevealHints}
              className="min-h-11 rounded border border-stone-700 px-3 text-xs text-stone-300 disabled:opacity-50 hover:bg-stone-800"
            >
              {busy === 'hints' ? 'Laden…' : 'Hints'}
            </button>
          )}

          {hints && (
            <span className="text-sm text-stone-300">
              {hints.rating ? `${'★'.repeat(hints.rating)} · ` : ''}{hints.hints.join(' · ')}
            </span>
          )}

          {hints && game.outcome_ready && !result && !confirming && (
            <button
              type="button"
              disabled={busy === 'result'}
              onClick={() => setConfirming(true)}
              className="min-h-11 rounded border border-red-800 px-3 text-xs text-red-300 disabled:opacity-50 hover:bg-red-950"
            >
              {busy === 'result' ? 'Laden…' : 'Uitslag'}
            </button>
          )}

          {confirming && !result && (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-red-300">Eindstand tonen?</span>
              <button
                type="button"
                onClick={() => { setConfirming(false); onRevealResult(); }}
                className="min-h-11 rounded bg-red-700 px-3 font-semibold text-white hover:bg-red-800"
              >
                Eindstand tonen
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded border border-stone-700 px-3"
              >
                Annuleer
              </button>
            </span>
          )}

          {result && (
            <span className="rounded bg-red-950 px-2 py-1 font-mono text-sm text-red-200">
              {result.score_line} · {result.winner}
            </span>
          )}

          {revealError && <span className="text-xs text-red-300" title={revealError}>Niet geladen · probeer opnieuw</span>}
        </div>

        {why && (
          <div className="rounded border border-stone-800 bg-stone-950/50 p-2.5">
            <ul className="list-disc space-y-1 pl-4 text-xs text-stone-300">
              {explanation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <p className="mt-2 text-xs text-stone-500">All-22 vanaf {game.all22_from_nl}</p>
            <p className="mt-1 text-xs text-stone-500 italic">{explanation.caveat}</p>
          </div>
        )}
      </div>
    </li>
  );
}
