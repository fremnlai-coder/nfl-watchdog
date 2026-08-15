// Deterministic spoiler linter for teasers.
//
// Every teaser is checked before it is written to the public payload. There is
// no model in this path and no randomness: the same text always produces the
// same verdict. A teaser that fails is replaced by a fixed fallback template
// rather than being repaired, because repairing text is exactly where a leak
// would slip back in.
//
// Over-blocking is the intended bias. A false positive costs a generic teaser;
// a false negative costs the whole point of the project.

export const MAX_WORDS = 15;

// Outcome, direction and shape. Dutch first, English second, because ESPN copy
// and half-translated phrasing both end up in this pipeline.
const SPOILER_WORDS = [
  // Winning and losing. Note that "winnend" and "verliezend" are deliberately
  // absent: "een winnend record" describes the state a team carried into the
  // week, which is level 0. Past tense about this game is the leak.
  'win', 'wint', 'winst', 'winnaar', 'winnen', 'won', 'wonnen', 'gewonnen',
  'verlies', 'verliest', 'verloor', 'verloren', 'nederlaag', 'verliezer',
  'versloeg', 'verslaat', 'klopte', 'klopt', 'walste', 'vernederde',
  'zege', 'overwinning', 'triomf', 'onderuit', 'inpakte',
  'loss', 'lost', 'beat', 'beats', 'defeat', 'defeated', 'victory', 'winner',
  // margin and shape
  'blowout', 'thriller', 'shootout', 'upset', 'stunt', 'sensatie', 'stunner',
  'comeback', 'remonte', 'terugkomst', 'ommekeer', 'omslag',
  'ruim', 'ruime', 'nipt', 'nipte', 'krap', 'krappe', 'kansloos', 'eenzijdig',
  'domineerde', 'dominant', 'walkover', 'rout', 'demolished',
  'spannend', 'spannende', 'spectaculair', 'spectaculaire', 'dramatisch',
  'dramatische', 'waanzinnig', 'ongelooflijk', 'onwaarschijnlijk',
  // overtime and the clock
  'overtime', 'verlenging', 'ot', 'buzzer', 'slotseconde', 'slotseconden',
  'laatste seconde', 'laatste seconden', 'walk-off', 'walkoff',
  // scoring and results
  'eindstand', 'uitslag', 'score', 'scoorde', 'scoreboard', 'stand',
  'punt', 'punten', 'voorsprong', 'achterstand', 'gelijkspel', 'remise',
  'touchdown', 'touchdowns', 'fieldgoal', 'safety', 'pick-six', 'pick six',
  'interceptie', 'interception', 'fumble', 'turnover', 'sack',
  // qualifying and elimination, which imply a result
  'uitgeschakeld', 'geplaatst', 'plaatste', 'elimineerde', 'clinched',
  'eliminated', 'knock-out',
];

// Dutch inflects adjectives and participles, so "kansloos" also shows up as
// "kansloze" and "spannend" as "spannende". Enumerating every form is brittle,
// so these are matched as prefixes. Only stems that cannot start an innocent
// word belong here — "win" stays in the exact list above, because prefix
// matching would fire it on "winter".
const SPOILER_STEMS = [
  'kanslo', 'spannend', 'spectaculair', 'dramatisch', 'sensatione',
  'domineer', 'gedomineer', 'verneder', 'vermorzel', 'overklas',
  'blowout', 'thriller', 'comeback', 'overtim', 'touchdown',
  'interceptie', 'nederlaag', 'overwinning', 'uitgeschakeld',
  'eindstand', 'zegevier', 'triomfeer',
];

// "49ers" is the one legitimate digit-bearing token in the whole vocabulary.
const SAFE_DIGIT_TOKENS = ['49ers'];

const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function words(text) {
  return strip(text).split(/[^a-z0-9'’-]+/).filter(Boolean);
}

/**
 * @param {string} text
 * @param {{playerNames?: string[]}} [opts] playerNames are surnames pulled from
 *   the play-by-play of that specific game; naming anyone who appeared in it is
 *   treated as a leak regardless of what is said about them.
 * @returns {{ok: boolean, violations: {rule: string, match: string}[]}}
 */
export function lintTeaser(text, opts = {}) {
  const violations = [];
  const add = (rule, match) => violations.push({ rule, match });

  if (typeof text !== 'string' || !text.trim()) {
    add('empty', String(text));
    return { ok: false, violations };
  }

  const tokens = words(text);

  if (tokens.length > MAX_WORDS) {
    add('max_words', `${tokens.length} woorden`);
  }

  // Digits carry scores, records, yardage and clock. None of it belongs here.
  for (const token of tokens) {
    if (SAFE_DIGIT_TOKENS.includes(token)) continue;
    if (/\d/.test(token)) add('digits', token);
  }

  const haystack = ` ${tokens.join(' ')} `;
  for (const word of SPOILER_WORDS) {
    const needle = strip(word);
    // Multi-word entries are matched as a phrase, single words on boundaries.
    if (needle.includes(' ')) {
      if (haystack.includes(` ${needle} `)) add('spoiler_word', word);
    } else if (tokens.includes(needle)) {
      add('spoiler_word', word);
    }
  }

  for (const stem of SPOILER_STEMS) {
    const hit = tokens.find((t) => t.startsWith(stem));
    if (hit) add('spoiler_word', hit);
  }

  for (const name of opts.playerNames ?? []) {
    const needle = strip(name);
    if (needle.length < 3) continue;
    if (tokens.includes(needle)) add('player_name', name);
  }

  return { ok: violations.length === 0, violations };
}

// Surnames as they appear in ESPN play text ("Z.Gonzalez", "Center-L.McCullough").
// Used to build the per-game blocklist the linter checks against.
export function playerNamesFromPlays(playsDoc) {
  const names = new Set();
  for (const play of playsDoc.items ?? []) {
    for (const m of String(play.text ?? '').matchAll(/\b[A-Z]\.([A-Z][a-zA-Z'’-]{2,})/g)) {
      names.add(m[1]);
    }
  }
  return [...names];
}
