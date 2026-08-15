import Term from './Term.jsx';
import PlayoffBracket from './PlayoffBracket.jsx';
import { GLOSSARY, GLOSSARY_ORDER } from '../lib/glossary.js';

// Everything in here is rules-of-the-game, not season data, so it can sit in the
// initial payload. Kept collapsed by default: it is reference material for the
// weeks you need it, not something to scroll past every time.

function Fact({ children }) {
  return (
    <li className="text-sm text-stone-600 dark:text-stone-400">{children}</li>
  );
}

export default function Explainer({ timezone, offsetHours }) {
  return (
    <details className="mt-8 rounded border border-stone-200 dark:border-stone-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Hoe de NFL werkt
        <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
          competitie, play-offs, tijden en begrippen
        </span>
      </summary>

      <div className="space-y-6 border-t border-stone-200 px-3 py-4 dark:border-stone-800">
        <section>
          <h3 className="text-sm font-semibold">De competitie</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <Fact>
              32 ploegen in twee <Term id="conference">conferences</Term>, de AFC en de
              NFC. Elke conference heeft vier <Term id="division">divisies</Term> van
              vier ploegen.
            </Fact>
            <Fact>
              Achttien weken, zeventien wedstrijden. Elke ploeg heeft één{' '}
              <Term id="bye">bye</Term>, de week waarin ze niet spelen.
            </Fact>
            <Fact>
              Divisiegenoten treffen elkaar twee keer per seizoen. Een{' '}
              <Term id="interconference">interconference</Term>-duel is zeldzaam.
            </Fact>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Wanneer het hier is</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <Fact>
              Alle tijden staan in {timezone}. Het verschil met New York is deze week{' '}
              <strong>{offsetHours} uur</strong> — dat wisselt, want Europa gaat een week
              eerder over op wintertijd dan de Verenigde Staten.
            </Fact>
            <Fact>
              Sunday early begint hier rond 19:00, Sunday late rond 22:25. De{' '}
              <Term id="primetime">primetime</Term>-wedstrijden beginnen tussen 02:00 en
              02:20 's nachts.
            </Fact>
            <Fact>
              Wedstrijden in Londen, Madrid, Berlijn of Dublin vallen in de Nederlandse
              middag. Die zijn als enige comfortabel live te kijken — een wedstrijd in
              São Paulo of Melbourne juist niet, ook al is die ook overzees.
            </Fact>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Van competitie naar Super Bowl</h3>
          <div className="mt-2">
            <PlayoffBracket />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Begrippen</h3>
          <dl className="mt-2 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {GLOSSARY_ORDER.map((id) => (
              <div key={id}>
                <dt className="text-sm font-medium">{GLOSSARY[id].term}</dt>
                <dd className="text-xs text-stone-500 dark:text-stone-400">
                  {GLOSSARY[id].text}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </details>
  );
}
