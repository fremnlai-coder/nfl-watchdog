import Term from './Term.jsx';

// Deliberately drawn on seed numbers rather than teams.
//
// A filled bracket is the single biggest spoiler this tool could contain: it
// gives away who won each division, who took the wildcards, and in later rounds
// who advanced — the whole season in one glance. As a format diagram it is level
// 0, because none of it depends on a result.

const ROUNDS = [
  {
    name: 'Wild Card',
    note: 'Zes ploegen spelen, de nummer 1 is vrij.',
    pairs: [['2', '7'], ['3', '6'], ['4', '5']],
  },
  {
    name: 'Divisional',
    note: 'De vrije nummer 1 komt erbij en speelt tegen de laagste die overbleef.',
    pairs: [['1', 'laagste over'], ['rest', 'rest']],
  },
  {
    name: 'Conference Championship',
    note: 'De twee winnaars. Wie hier wint gaat naar de Super Bowl.',
    pairs: [['winnaar', 'winnaar']],
  },
];

function Seed({ label }) {
  const isNumber = /^\d$/.test(label);
  return (
    <span
      className={`inline-flex min-w-8 items-center justify-center rounded px-1.5 py-0.5 text-xs ${
        isNumber
          ? 'bg-stone-200 font-semibold text-stone-800 dark:bg-stone-800 dark:text-stone-200'
          : 'text-stone-500 italic dark:text-stone-400'
      }`}
    >
      {isNumber ? `#${label}` : label}
    </span>
  );
}

function Conference({ name }) {
  return (
    <div className="rounded border border-stone-200 p-3 dark:border-stone-800">
      <h4 className="text-sm font-semibold">{name}</h4>
      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
        Zeven <Term id="seed">seeds</Term>: vier divisiewinnaars plus drie{' '}
        <Term id="wildcard">wildcards</Term>.
      </p>
      <ol className="mt-3 space-y-3">
        {ROUNDS.map((round) => (
          <li key={round.name}>
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
              {round.name}
            </p>
            <ul className="mt-1 space-y-1">
              {round.pairs.map((pair, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Seed label={pair[0]} />
                  <span className="text-xs text-stone-500 dark:text-stone-400">tegen</span>
                  <Seed label={pair[1]} />
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{round.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function PlayoffBracket() {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Conference name="AFC" />
        <Conference name="NFC" />
      </div>

      <div className="mt-3 rounded border border-stone-300 bg-stone-100 p-3 text-center dark:border-stone-700 dark:bg-stone-900">
        <p className="text-sm font-semibold">Super Bowl</p>
        <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
          De AFC-kampioen tegen de NFC-kampioen, op neutraal terrein.
        </p>
      </div>

      <p className="mt-3 text-xs text-stone-600 dark:text-stone-400">
        Dit schema staat bewust op seednummers en niet op ploegen. Een ingevulde
        bracket zou in één oogopslag verraden wie de divisies won, wie de wildcards
        pakte en wie er per ronde doorging — het hele seizoen tegelijk.
      </p>
    </div>
  );
}
