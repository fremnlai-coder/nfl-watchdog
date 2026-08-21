import { useRef, useState } from 'react';
import { exportState, parseBackup } from '../lib/prefs.js';

// Copy and file download both exist on purpose. On iOS the download lands in
// Files, which survives a storage wipe but takes taps to retrieve; the clipboard
// is one tap and enough to paste into a note. Neither is reliable enough alone.
export default function Backup({ onRestore }) {
  const [status, setStatus] = useState(null); // { tone: 'ok' | 'error', text }
  const [pasting, setPasting] = useState(false);
  const fileInput = useRef(null);

  const doc = () => JSON.stringify(exportState(), null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc());
      setStatus({ tone: 'ok', text: 'Back-up staat op het klembord.' });
    } catch {
      setStatus({ tone: 'error', text: 'Kopiëren mag niet in deze browser; gebruik het bestand.' });
    }
  }

  function download() {
    const blob = new Blob([doc()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nfl-watchdog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ tone: 'ok', text: 'Bestand opgeslagen.' });
  }

  function restore(text) {
    try {
      const state = parseBackup(text);
      onRestore(state);
      const seasons = Object.entries(state.watched)
        .map(([s, w]) => `${s} t/m week ${w}`)
        .join(', ');
      setStatus({
        tone: 'ok',
        text: `Teruggezet: ${Object.keys(state.teams).length} teams${seasons ? `, ${seasons}` : ''}.`,
      });
      setPasting(false);
    } catch (e) {
      setStatus({ tone: 'error', text: `Niet teruggezet: ${e.message}` });
    }
  }

  const button =
    'rounded border border-stone-300 px-2.5 py-2 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800';

  return (
    <details className="mt-4 rounded border border-stone-200 dark:border-stone-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Back-up
        <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
          favorieten en kijkstand
        </span>
      </summary>

      <div className="border-t border-stone-200 px-3 py-3 dark:border-stone-800">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Je voorkeuren en je kijkstand staan in deze browser, niet op een server.
          Safari op iPhone wist die opslag na zeven dagen waarin je de site niet
          opent; als webapp op je beginscherm gebeurt dat niet, maar dan begin je
          daar wel met een lege stand. Zet 'm dan hiermee terug.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={button}>
            Kopieer back-up
          </button>
          <button type="button" onClick={download} className={button}>
            Bewaar als bestand
          </button>
          {/* Forces the wrap between making a back-up and putting one back,
              instead of leaving a stray divider at the end of a wrapped row. */}
          <span className="basis-full" aria-hidden="true" />
          <button type="button" onClick={() => fileInput.current?.click()} className={button}>
            Uit bestand terugzetten
          </button>
          <button type="button" onClick={() => setPasting((v) => !v)} className={button}>
            Plakken
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            restore(await file.text());
            // Reset, or picking the same file twice fires no change event.
            e.target.value = '';
          }}
        />

        {pasting && (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              restore(new FormData(e.currentTarget).get('backup'));
            }}
          >
            <textarea
              name="backup"
              rows={4}
              placeholder="Plak hier de gekopieerde back-up"
              className="w-full rounded border border-stone-300 bg-transparent p-2 font-mono text-xs dark:border-stone-700"
            />
            <button type="submit" className={`mt-2 ${button}`}>
              Terugzetten
            </button>
          </form>
        )}

        {status && (
          <p
            className={`mt-3 text-xs ${
              status.tone === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {status.text}
          </p>
        )}
      </div>
    </details>
  );
}
