// Twee regels in plaats van twee kaders. Het pakket is context bij de
// wedstrijden eronder, geen eigen blok: als samenvatting van 284px duwde het de
// eerste wedstrijd onder de vouw, en dat is precies de verkeerde ruil.
function Line({ label, qualifier, summary, recapName }) {
  if (!summary) return null;

  const bits = [
    `${summary.counts.full}× full`,
    `${summary.counts.game_in_40}× Game in 40`,
    summary.recap_included ? `${summary.recap_minutes}m ${recapName}` : null,
    `${summary.total_minutes} min`,
  ].filter(Boolean);

  const tail = summary.recap_included
    ? `${summary.recap_covers}× samenvatting, ${summary.unseen} ongezien`
    : `${summary.unseen} ongezien`;

  return (
    <li className="py-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <span className="ml-1.5 text-stone-600 dark:text-stone-400">{qualifier}</span>
      <span className="mx-1.5 text-stone-500 dark:text-stone-400">·</span>
      {bits.join(' · ')}
      <span className="ml-1.5 text-xs text-stone-600 dark:text-stone-400">{tail}</span>
    </li>
  );
}

export default function PackageSummary({ packages, recapName }) {
  const a = packages.a.summary;
  const b = packages.b.summary;

  return (
    <section className="mt-4">
      <h2 className="sr-only">Kijkpakket</h2>
      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        <Line label="A" qualifier="zonder recap" summary={a} recapName={recapName} />
        {b.recap_dropped ? (
          <li className="py-1.5 text-sm">
            <span className="font-semibold">B</span>
            <span className="mx-1.5 text-stone-500 dark:text-stone-400">·</span>
            <span className="text-stone-600 dark:text-stone-400">
              met recap niet mogelijk: na je eigen teams blijft er te weinig ruimte over
            </span>
          </li>
        ) : (
          <Line label="B" qualifier="met recap" summary={b} recapName={recapName} />
        )}
      </ul>
      {(a.own_team_skipped > 0 || b.own_team_skipped > 0) && (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
          Let op: {Math.max(a.own_team_skipped, b.own_team_skipped)} wedstrijd van een eigen
          team valt buiten het pakket.
        </p>
      )}
    </section>
  );
}
