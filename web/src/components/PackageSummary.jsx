function Package({ label, summary, recapName }) {
  if (!summary) return null;
  const bits = [
    `${summary.counts.full}× full`,
    `${summary.counts.game_in_40}× Game in 40`,
    summary.recap_included ? `${summary.recap_minutes}m ${recapName}` : null,
    `${summary.total_minutes} min`,
  ].filter(Boolean);

  const tail = summary.recap_included
    ? `${summary.recap_covers} wedstrijden alleen als ~5 min samenvatting, ${summary.unseen} helemaal ongezien`
    : `${summary.unseen} wedstrijden helemaal ongezien`;

  return (
    <div className="rounded border border-stone-200 p-3 dark:border-stone-800">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-sm">{bits.join(' · ')}</p>
      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{tail}</p>
    </div>
  );
}

export default function PackageSummary({ packages, recapName }) {
  const a = packages.a.summary;
  const b = packages.b.summary;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
        Kijkpakket
      </h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Package label="A — zonder recap" summary={a} recapName={recapName} />
        {b.recap_dropped ? (
          <div className="rounded border border-stone-200 p-3 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <p className="font-semibold text-stone-700 dark:text-stone-300">B — met recap</p>
            <p className="mt-1">
              Niet mogelijk: na je eigen teams blijft er te weinig ruimte over.
            </p>
          </div>
        ) : (
          <Package label="B — met recap" summary={b} recapName={recapName} />
        )}
      </div>
      {(a.own_team_skipped > 0 || b.own_team_skipped > 0) && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          Let op: {Math.max(a.own_team_skipped, b.own_team_skipped)} wedstrijd van een eigen
          team valt buiten het pakket.
        </p>
      )}
    </section>
  );
}
