import { GLOSSARY } from '../lib/glossary.js';

// A glossary term with an explanation on hover and on keyboard focus. Focus
// matters: hover-only tooltips are invisible to anyone not using a mouse.
export default function Term({ id, children, className = '' }) {
  const entry = GLOSSARY[id];
  if (!entry) return <>{children ?? id}</>;

  return (
    <span className={`group relative inline-block ${className}`}>
      <span
        tabIndex={0}
        role="button"
        aria-describedby={`glossary-${id}`}
        className="cursor-help border-b border-dotted border-current/50 outline-none"
      >
        {children ?? entry.term}
      </span>
      <span
        id={`glossary-${id}`}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1 w-64 rounded border border-stone-300 bg-white p-2 text-xs leading-snug font-normal text-stone-700 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
      >
        <strong className="block text-stone-900 dark:text-stone-100">{entry.term}</strong>
        {entry.text}
      </span>
    </span>
  );
}
