import { useEffect, useRef, useState } from 'react';
import { GLOSSARY } from '../lib/glossary.js';

// A glossary term. On a mouse it explains itself on hover and on keyboard focus
// — focus matters, because a hover-only tooltip is invisible to anyone without a
// pointer. On a touchscreen neither exists, so a tap opens it.
//
// The panel is fixed to the bottom of the screen below sm, not absolutely
// positioned next to the term. Two reasons, both measured at 375px: the 16rem
// tooltip runs off the right edge from a term halfway across the row, and
// GameCard clips it anyway — the card carries overflow-hidden for its rounded
// corners, and no repositioning escapes an ancestor's clip. Fixed does.
export default function Term({ id, children, className = '' }) {
  const entry = GLOSSARY[id];
  const wrap = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    // A tap inside our own wrapper is the toggle below; anything else dismisses.
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!entry) return <>{children ?? id}</>;

  return (
    <span ref={wrap} className={`group relative inline-block ${className}`}>
      <span
        tabIndex={0}
        role="button"
        aria-describedby={`glossary-${id}`}
        aria-expanded={open}
        onPointerDown={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="cursor-help border-b border-dotted border-current/50 outline-none"
      >
        {children ?? entry.term}
      </span>
      <span
        id={`glossary-${id}`}
        role="tooltip"
        className={`term-panel pointer-events-none fixed inset-x-3 bottom-3 z-50 rounded border border-stone-300 bg-white p-3 text-xs leading-snug font-normal text-stone-700 shadow-lg transition-opacity sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-1 sm:w-64 sm:p-2 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        } group-hover:visible group-hover:opacity-100`}
      >
        <strong className="block text-stone-900 dark:text-stone-100">{entry.term}</strong>
        {entry.text}
      </span>
    </span>
  );
}
