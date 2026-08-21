// De teamgids: coach, stadion, opstelling, feiten. Geen enkele statistiek.
//
// Dit bestand is voor de teamdata wat schema.js voor de wedstrijden is: de enige
// plek waar een veld publiek wordt, en het plukt uit de ESPN-payloads in plaats
// van ze te spreaden. Dat is hier niet theoretisch. Drie voorbeelden uit de
// werkelijke antwoorden:
//
//   team.record.items[].summary   -> "0-1", en in de stats zitten avgPointsFor
//                                    en avgPointsAgainst. Direct de uitslag.
//   roster.team.seasonSummary     -> buiten het voorseizoen het W-L-record.
//   roster.athletes[]             -> bevat de groep injuredReserveOrOut, plus
//                                    per speler status en injuries.
//
// Die laatste is de subtielste: wie halverwege het seizoen op IR staat, raakte
// geblesseerd in een wedstrijd die je misschien nog moet kijken. Vandaar dat
// alleen de groepen offense, defense en specialTeam meedoen, en dat status en
// injuries nergens worden overgenomen.

// Welke plekken de gids toont. Meer dan dit wordt een opstelling in plaats van
// een kennismaking, en op een telefoon leest niemand 53 namen.
const OFFENSE = [
  ['qb', 'QB', 1],
  ['rb', 'RB', 1],
  ['wr', 'WR', 3],
  ['te', 'TE', 1],
];

// Per linie één naam, niet de eerste vier die bestaan. Zonder deze indeling
// leverde 4-3 vier keer de defensive line op en geen enkele linebacker of back.
// Per team verschilt de basisformatie (4-3 of 3-4), dus binnen een linie is het
// een voorkeurslijst: de eerste sleutel die bestaat wint.
const DEFENSE = [
  ['edge', ['lde', 'rde', 'de', 'olb', 'rolb', 'lolb']],
  ['interior', ['ldt', 'rdt', 'dt', 'ng', 'nt']],
  ['linebacker', ['mlb', 'wlb', 'slb', 'ilb', 'lb']],
  ['secondary', ['lcb', 'rcb', 'cb', 'ss', 'fs', 'nb']],
];

const SPECIAL = [['pk', 'K', 1]];

function athleteId(ref) {
  return /\/athletes\/(\d+)/.exec(ref ?? '')?.[1] ?? null;
}

// Naam-en-nummer per speler. Alles wat over prestaties gaat blijft achter.
function publicAthlete(athlete, slot) {
  return {
    slot,
    name: athlete.fullName ?? athlete.displayName,
    jersey: athlete.jersey ?? null,
    college: athlete.college?.name ?? null,
    experience_years: athlete.experience?.years ?? null,
    age: athlete.age ?? null,
  };
}

// De roster komt in groepen binnen. injuredReserveOrOut en suspended blijven
// buiten de index: wie daarin staat, staat er om een reden die iets zegt over
// een wedstrijd die je nog moet kijken.
function rosterIndex(roster) {
  const byId = new Map();
  for (const group of roster.athletes ?? []) {
    if (!['offense', 'defense', 'specialTeam'].includes(group.position)) continue;
    for (const athlete of group.items ?? []) byId.set(String(athlete.id), athlete);
  }
  return byId;
}

function formation(depth, predicate) {
  return (depth.items ?? []).find(predicate) ?? null;
}

function startersAt(unit, key, label, count, byId) {
  const spot = unit?.positions?.[key];
  if (!spot) return [];

  return (spot.athletes ?? [])
    .filter((a) => a.rank <= count)
    .sort((a, b) => a.rank - b.rank)
    .map((a) => byId.get(athleteId(a.athlete?.$ref)))
    .filter(Boolean)
    .map((athlete) => publicAthlete(athlete, label));
}

export function keyPlayers(depth, roster) {
  const byId = rosterIndex(roster);
  // De aanvalsformatie is die met een quarterback; de naam ervan verschilt per
  // team ("3WR 1TE", "2WR 2TE"), de quarterback niet.
  const offense = formation(depth, (i) => i.positions?.qb);
  const defense = formation(depth, (i) => /\bD$/.test(i.name ?? '') || i.positions?.mlb || i.positions?.lde);
  const special = formation(depth, (i) => i.positions?.pk);

  const players = [];

  for (const [key, label, count] of OFFENSE) {
    players.push(...startersAt(offense, key, label, count, byId).map((p) => ({ ...p, side: 'offense' })));
  }

  for (const [, keys] of DEFENSE) {
    for (const key of keys) {
      // De positieafkorting uit de payload zelf, zodat er NT staat waar een
      // team een nose tackle opstelt en DT waar het er geen heeft.
      const label = defense?.positions?.[key]?.position?.abbreviation ?? key.toUpperCase();
      const found = startersAt(defense, key, label, 1, byId)
        .filter((p) => !players.some((q) => q.name === p.name))
        .map((p) => ({ ...p, side: 'defense' }));
      if (found.length) {
        players.push(found[0]);
        break;
      }
    }
  }

  for (const [key, label, count] of SPECIAL) {
    players.push(...startersAt(special, key, label, count, byId).map((p) => ({ ...p, side: 'special' })));
  }

  return players;
}

// Feiten die uit de selectie zelf volgen. Leeftijd en ervaring gaan over wie er
// speelt, niet over hoe het ging.
export function rosterFacts(roster) {
  const players = [...rosterIndex(roster).values()];
  const ages = players.map((p) => p.age).filter((a) => typeof a === 'number');

  return {
    players: players.length,
    rookies: players.filter((p) => (p.experience?.years ?? null) === 0).length,
    average_age: ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null,
  };
}

export function buildPublicTeam({ profile, roster, depth, config }) {
  const team = profile.team;
  const coach = (roster.coach ?? [])[0] ?? null;
  const venue = team.franchise?.venue ?? null;

  return {
    abbr: config.abbr,
    name: config.name,
    location: team.location ?? null,
    nickname: team.nickname ?? null,
    conference: config.conference,
    division: config.division,
    colors: {
      primary: team.color ? `#${team.color}` : null,
      secondary: team.alternateColor ? `#${team.alternateColor}` : null,
    },
    coach: coach
      ? {
          name: [coach.firstName, coach.lastName].filter(Boolean).join(' '),
          // Jaren als coach in de NFL. Bewust niet zijn staat van dienst: die
          // bestaat uit gewonnen en verloren wedstrijden.
          experience_years: coach.experience ?? null,
        }
      : null,
    venue: venue
      ? {
          name: venue.fullName ?? null,
          city: venue.address?.city ?? null,
          state: venue.address?.state ?? null,
          indoor: venue.indoor ?? null,
        }
      : null,
    roster_facts: rosterFacts(roster),
    key_players: keyPlayers(depth, roster),
  };
}
