// Glossary for a Dutch viewer who did not grow up with this sport.
//
// Definitions are deliberately free of anything season-specific: no standings,
// no teams, no results. They are rules-of-the-game facts, so they can sit in the
// initial payload without any spoiler risk.

export const GLOSSARY = {
  down: {
    term: 'down',
    text: 'Een poging. Je krijgt er vier om tien yards te winnen; lukt dat, dan begin je weer bij de eerste. Lukt het niet, dan gaat de bal naar de tegenstander.',
  },
  drive: {
    term: 'drive',
    text: 'Een aaneengesloten reeks aanvallen van dezelfde ploeg, van de eerste snap tot het moment dat de bal wisselt of er gescoord wordt.',
  },
  red_zone: {
    term: 'red zone',
    text: 'De laatste twintig yards voor de endzone van de tegenstander. Scoren wordt daar makkelijker, verdedigen ook — de ruimte is op.',
  },
  turnover: {
    term: 'turnover',
    text: 'De bal wisselt van ploeg zonder dat de aanval hem vrijwillig afstaat, door een onderschepping of een verloren bal.',
  },
  two_minute_warning: {
    term: 'two-minute warning',
    text: 'Verplichte klokstop twee minuten voor het einde van de tweede en de vierde periode. Vanaf dat moment gaat het spel merkbaar sneller.',
  },
  bye: {
    term: 'bye',
    text: 'De ene week in het seizoen waarin een ploeg niet speelt. Elke ploeg speelt zeventien wedstrijden in achttien weken.',
  },
  seed: {
    term: 'seed',
    text: 'De plaats waarop een ploeg de play-offs in gaat, één tot en met zeven per conference. Hoe hoger, hoe vaker je thuis speelt.',
  },
  wildcard: {
    term: 'wildcard',
    text: 'Een play-offplek voor een ploeg die haar divisie niet won maar wel bij de beste overgeblevenen hoort. Drie per conference.',
  },
  spread: {
    term: 'spread',
    text: 'Het puntenverschil dat bookmakers vooraf verwachten. Puur een voorspelling; deze tool gebruikt hem niet.',
  },
  division: {
    term: 'divisie',
    text: 'Groep van vier ploegen die elkaar twee keer per seizoen treffen. De winnaar plaatst zich altijd voor de play-offs.',
  },
  conference: {
    term: 'conference',
    text: 'De AFC en de NFC, elk zestien ploegen in vier divisies. Ze treffen elkaar zelden, en pas in de Super Bowl weer.',
  },
  interconference: {
    term: 'interconference',
    text: 'Een wedstrijd tussen een AFC- en een NFC-ploeg. Die staan maar zelden op het programma.',
  },
  all22: {
    term: 'All-22',
    text: 'De tactische camera waarop alle tweeëntwintig spelers tegelijk in beeld staan. Verschijnt pas een dag tot anderhalve dag na afloop.',
  },
  game_in_40: {
    term: 'Game in 40',
    text: 'De ingekorte versie van één wedstrijd op DAZN: alle relevante acties zonder de dode tijd, ongeveer veertig minuten.',
  },
  sunday_in_60: {
    term: 'Sunday in 60',
    text: 'Samenvatting van de hele zondag in ongeveer een uur. Let op: die dekt elke zondagwedstrijd, dus kijk hem als laatste.',
  },
  seeding_impact: {
    term: 'indirect belangrijk',
    text: 'Twee ploegen uit een conference waarin een van jouw teams meedoet, allebei met een winnend record. Wat hier gebeurt schuift de play-offplaatsen rond jouw team. Wát er gebeurde staat er niet bij.',
  },
  own_division: {
    term: 'jouw divisie',
    text: 'Een wedstrijd tussen ploegen uit de divisie van een van jouw teams. Direct van invloed op wie die divisie wint.',
  },
  full_replay: {
    term: 'Full replay',
    text: 'De volledige wedstrijd op DAZN, ongeveer drie uur. DAZN heeft daarbij een eigen spoilerbescherming die de stand verbergt.',
  },
  primetime: {
    term: 'primetime',
    text: 'De losstaande avondwedstrijden: Thursday Night, Sunday Night en Monday Night. Hier beginnen ze midden in de nacht.',
  },
};

export const GLOSSARY_ORDER = [
  'down', 'drive', 'red_zone', 'turnover', 'two_minute_warning',
  'division', 'conference', 'interconference', 'bye', 'seed', 'wildcard', 'spread',
  'full_replay', 'game_in_40', 'sunday_in_60', 'all22', 'primetime',
  'own_division', 'seeding_impact',
];
