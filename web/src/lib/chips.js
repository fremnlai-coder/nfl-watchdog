import { eventLabels } from '../../../src/time.js';

const EVENT_CHIP = {
  kickoff: { label: 'NFL Kickoff', tone: 'sky', priority: 20 },
  international: { label: 'Internationaal', tone: 'amber', priority: 20 },
  thanksgiving_eve: { label: 'Thanksgiving Eve', tone: 'amber', priority: 20 },
  thanksgiving: { label: 'Thanksgiving', tone: 'amber', priority: 20 },
  black_friday: { label: 'Black Friday', tone: 'amber', priority: 20 },
  christmas: { label: 'Kerst', tone: 'amber', priority: 20 },
  mnf: { label: 'MNF', tone: 'sky', term: 'mnf', priority: 30 },
  snf: { label: 'SNF', tone: 'sky', term: 'snf', priority: 30 },
  tnf: { label: 'TNF', tone: 'sky', term: 'tnf', priority: 30 },
  saturday: { label: 'Zaterdag', tone: 'neutral', priority: 35 },
};

export function contextChips(game, { rank = null, next = false } = {}) {
  const chips = [];
  if (next) chips.push({ key: 'next', label: 'Volgende', tone: 'emerald', priority: 0 });
  if (rank != null) {
    chips.push({ key: 'favorite', label: `Favoriet #${rank}`, tone: 'emerald', priority: 10 });
  }

  for (const id of eventLabels(new Date(game.kickoff_utc), {
    isInternational: game.is_international,
    week: game.week,
  })) {
    const meta = EVENT_CHIP[id];
    if (meta) chips.push({ key: id, ...meta });
  }

  if (game.tags?.includes('jouw divisie')) {
    chips.push({
      key: 'own-division', label: 'Jouw divisie', tone: 'sky', term: 'own_division', priority: 40,
    });
  }
  if (game.tags?.includes('indirect belangrijk')) {
    chips.push({
      key: 'playoff-race', label: 'Play-offrace', tone: 'amber', term: 'seeding_impact', priority: 50,
    });
  }
  if (game.game_type === 'division') {
    chips.push({
      key: 'division', label: 'Divisieduel', tone: 'neutral', term: 'division', priority: 60,
    });
  }

  return chips.sort((a, b) => a.priority - b.priority).slice(0, 3);
}
