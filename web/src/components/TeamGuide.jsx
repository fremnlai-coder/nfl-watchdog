import { useState } from 'react';
import TeamLogo from './TeamLogo.jsx';
import { loadTeams } from '../lib/data.js';

// Wie speelt er, wie coacht, waar spelen ze. Vervangt de uitleglaag over de
// competitie: die legde de regels uit, dit legt de deelnemers uit.
//
// Twee dingen die hier bewust ontbreken, en die je in elke andere teamgids wél
// vindt: het seizoensrecord en de statistieken van de spelers. Beide zeggen hoe
// het tot nu toe ging, en dat is precies wat deze app niet vertelt. Wat er staat
// ligt vast vóór er gespeeld wordt: namen, nummers, colleges, dienstjaren.

const SIDE_LABEL = {
  offense: 'Aanval',
  defense: 'Verdediging',
  special: 'Speciale teams',
};

function Player({ player }) {
  return (
    <li className="flex items-baseline gap-2 py-0.5">
      <span className="w-9 shrink-0 font-mono text-xs text-stone-500 dark:text-stone-400">
        {player.slot}
      </span>
      <span className="text-sm">{player.name}</span>
      {player.jersey && (
        <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
          #{player.jersey}
        </span>
      )}
      <span className="ml-auto shrink-0 text-xs text-stone-500 dark:text-stone-400">
        {player.experience_years === 0 ? 'rookie' : `${player.experience_years}e jaar`}
      </span>
    </li>
  );
}

function Team({ team }) {
  const sides = ['offense', 'defense', 'special'].filter((s) =>
    team.key_players.some((p) => p.side === s),
  );

  return (
    <details className="border-t border-stone-200 first:border-t-0 dark:border-stone-800">
      <summary className="flex cursor-pointer items-center gap-2 py-2">
        <TeamLogo abbr={team.abbr} size={22} />
        <span className="w-10 shrink-0 font-mono text-xs text-stone-500 dark:text-stone-400">
          {team.abbr}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
        {/* Op 375px kostte de coach hier zoveel ruimte dat "Los Angeles
            Chargers" en "Washington Commanders" halverwege afbraken. Hij staat
            een tik verderop toch voluit. */}
        <span className="hidden shrink-0 text-xs text-stone-500 sm:inline dark:text-stone-400">
          {team.coach?.name}
        </span>
      </summary>

      <div className="pb-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
          <dt className="text-stone-500 dark:text-stone-400">Coach</dt>
          <dd>
            {team.coach?.name}
            {team.coach?.experience_years ? ` · ${team.coach.experience_years} jaar in de NFL` : ''}
          </dd>

          <dt className="text-stone-500 dark:text-stone-400">Stadion</dt>
          <dd>
            {team.venue?.name}
            {team.venue?.city ? `, ${team.venue.city}` : ''}
            {team.venue?.indoor ? ' · overdekt' : ''}
          </dd>

          <dt className="text-stone-500 dark:text-stone-400">Selectie</dt>
          <dd>
            {team.roster_facts.players} spelers · {team.roster_facts.rookies} rookies ·
            gemiddeld {team.roster_facts.average_age} jaar
          </dd>
        </dl>

        {sides.map((side) => (
          <div key={side} className="mt-3">
            <h4 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
              {SIDE_LABEL[side]}
            </h4>
            <ul className="mt-1">
              {team.key_players
                .filter((p) => p.side === side)
                .map((p) => (
                  <Player key={`${p.slot}-${p.name}`} player={p} />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function TeamGuide({ season }) {
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState(null);

  // Bijna 100 kB aan namen. Die hoort niet in de eerste payload van een pagina
  // die je opent om te zien wat je gaat kijken, dus hij komt pas bij het openen.
  function open(e) {
    if (!e.currentTarget.open || guide || error) return;
    loadTeams(season).then(setGuide).catch((err) => setError(err.message));
  }

  const divisions = new Map();
  for (const team of Object.values(guide?.teams ?? {})) {
    if (!divisions.has(team.division)) divisions.set(team.division, []);
    divisions.get(team.division).push(team);
  }

  return (
    <details onToggle={open} className="mt-8 rounded border border-stone-200 dark:border-stone-800">
      {/* "Teamgids" en niet "Teams": het paneel met je favorieten heet al Teams,
          en twee panelen met dezelfde naam op één pagina is geen keuze maar een
          vergissing. */}
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Teamgids
        <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
          spelers, coaches en feiten
        </span>
      </summary>

      <div className="border-t border-stone-200 px-3 py-3 dark:border-stone-800">
        {error && <p className="text-sm text-red-700 dark:text-red-400">Laden mislukt: {error}</p>}
        {!guide && !error && <p className="text-sm text-stone-500 dark:text-stone-400">Laden…</p>}

        {guide && (
          <>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Namen, nummers en feiten die vaststaan vóór er gespeeld wordt. Geen
              standen en geen statistieken — die zouden vertellen hoe het tot nu
              toe ging.
            </p>

            <div className="mt-3 grid gap-x-8 gap-y-4 lg:grid-cols-2">
              {[...divisions.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([label, teams]) => (
                  <div key={label}>
                    <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
                      {label}
                    </h3>
                    <div className="mt-1">
                      {teams
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((team) => (
                          <Team key={team.abbr} team={team} />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
