import { useState } from 'react';

// Crests are stored locally (scripts/fetch-logos.js) rather than hotlinked, so
// the page makes no third-party requests. If one is missing the abbreviation
// takes its place — the row must never depend on an image to be readable.
export default function TeamLogo({ abbr, size = 20, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (failed || !abbr) {
    return (
      <span
        className={`inline-block text-center font-mono text-[10px] text-stone-400 ${className}`}
        style={{ width: size }}
        aria-hidden="true"
      >
        {abbr}
      </span>
    );
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}logos/${abbr}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
