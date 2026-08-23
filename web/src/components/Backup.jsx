import { useRef, useState } from 'react';
import { exportState, parseBackup } from '../lib/prefs.js';

// Clipboard and file export both exist because iOS storage can be cleared.
export default function Backup({ onRestore }) {
  const [status, setStatus] = useState(null); // { tone: 'ok' | 'error', text }
  const [pasting, setPasting] = useState(false);
  const fileInput = useRef(null);

  const doc = () => JSON.stringify(exportState(), null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc());
      setStatus({ tone: 'ok', text: 'Gekopieerd.' });
    } catch {
      setStatus({ tone: 'error', text: 'Kopiëren lukt niet. Gebruik download.' });
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
    setStatus({ tone: 'ok', text: 'Gedownload.' });
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
        text: `Hersteld: ${Object.keys(state.teams).length} teams${seasons ? ` · ${seasons}` : ''}.`,
      });
      setPasting(false);
    } catch (e) {
      setStatus({ tone: 'error', text: `Niet teruggezet: ${e.message}` });
    }
  }

  const button =
    'min-h-11 rounded border border-stone-700 px-3 text-xs text-stone-300 hover:bg-stone-800';

  return (
    <details className="mt-4 rounded border border-stone-200 dark:border-stone-800">
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
        Back-up
        <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
          lokale stand
        </span>
      </summary>

      <div className="border-t border-stone-200 px-3 py-3 dark:border-stone-800">
        <p className="text-xs text-stone-500">
          Teams, weekvorm en kijkstand. Handig bij wisselen naar de beginschermapp.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={button}>
            Kopiëren
          </button>
          <button type="button" onClick={download} className={button}>
            Download
          </button>
          {/* Forces the wrap between making a back-up and putting one back,
              instead of leaving a stray divider at the end of a wrapped row. */}
          <span className="basis-full" aria-hidden="true" />
          <button type="button" onClick={() => fileInput.current?.click()} className={button}>
            Bestand kiezen
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
              Herstellen
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
