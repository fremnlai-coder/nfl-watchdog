import { useMemo, useState } from 'react';
import { buildViewingProfile } from '../lib/viewing.js';

export default function ViewingProfile({ log, season, teams, legacyCount = 0, onClear }) {
  const [confirming, setConfirming] = useState(false);
  const teamNames = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.abbr, team.name])),
    [teams],
  );
  const profile = useMemo(
    () => buildViewingProfile(log, season, teamNames),
    [log, season, teamNames],
  );

  return (
    <details className="rounded border border-stone-800">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 py-3 text-sm font-medium">
        <span>Kijkprofiel</span>
        <span className="ml-2 font-normal text-stone-500">
          {profile.count} {profile.count === 1 ? 'registratie' : 'registraties'} · lokaal
        </span>
      </summary>

      <div className="border-t border-stone-800 px-3 py-3">
        {profile.count === 0 && (
          <p className="text-sm text-stone-400">
            {legacyCount > 0
              ? 'Je bestaande voortgang blijft staan. Nieuwe registraties bouwen het profiel op.'
              : 'Nog geen gegevens. Markeer een wedstrijd als gezien.'}
          </p>
        )}

        {profile.count > 0 && !profile.ready && (
          <p className="text-sm text-stone-300">
            Nog {profile.remaining} {profile.remaining === 1 ? 'wedstrijd' : 'wedstrijden'} voor je eerste patroon.
          </p>
        )}

        {profile.ready && (
          <dl className="grid gap-2 sm:grid-cols-3">
            {profile.insights.map((insight) => (
              <div key={insight.key} className="rounded bg-stone-950/60 px-2.5 py-2">
                <dt className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                  {insight.label}
                </dt>
                <dd className="mt-0.5 text-sm text-stone-300">{insight.text}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-3 text-xs text-stone-500">
          Gebaseerd op wanneer je ‘Gezien’ markeert. Beïnvloedt je kijkplan nog niet.
        </p>

        {profile.count > 0 && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 min-h-11 rounded border border-stone-700 px-3 text-xs text-stone-400 hover:bg-stone-900"
          >
            Kijkprofiel wissen
          </button>
        )}

        {confirming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="basis-full text-stone-300">Je voortgang blijft behouden.</span>
            <button
              type="button"
              onClick={() => { onClear(); setConfirming(false); }}
              className="min-h-11 rounded bg-red-800 px-3 font-semibold text-white hover:bg-red-900"
            >
              Profiel wissen
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded border border-stone-700 px-3 text-stone-300"
            >
              Behouden
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
