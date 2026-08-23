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
    text: 'Automatische klokstop aan het einde van de laatste actie die vóór de twee minuten begint, in het tweede en vierde kwart.',
  },
  bye: {
    term: 'bye',
    text: 'De ene week in het seizoen waarin een ploeg niet speelt. Elke ploeg speelt zeventien wedstrijden in achttien weken.',
  },
  seed: {
    term: 'seed',
    text: 'De plaatsing voor de play-offs, één tot en met zeven per conference. Seed één krijgt een vrije eerste ronde; een beter geplaatste ploeg speelt thuis tegen een lager geplaatste.',
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
    text: 'De AFC en de NFC, elk met zestien ploegen in vier divisies. De winnaars van beide conferences spelen tegen elkaar in de Super Bowl.',
  },
  interconference: {
    term: 'interconference',
    text: 'Een wedstrijd tussen een AFC- en een NFC-ploeg. Die staan maar zelden op het programma.',
  },
  all22: {
    term: 'All-22',
    text: 'De tactische camera waarop alle tweeëntwintig spelers tegelijk in beeld staan. Verschijnt doorgaans 36 tot 48 uur na afloop.',
  },
  game_in_40: {
    term: 'Game in 40',
    text: 'De ingekorte versie van één wedstrijd op DAZN: alle relevante acties zonder de dode tijd, ongeveer veertig minuten.',
  },
  sunday_in_60: {
    term: 'Sunday in 60',
    text: 'Een overzicht van de belangrijkste momenten uit de zondagwedstrijden in ongeveer een uur. Kijk hem als laatste: hij bevat uitslagen.',
  },
  seeding_impact: {
    term: 'Play-offrace',
    text: 'Twee ploegen met een winnend record uit de conference van een van je favorieten. Deze wedstrijd kan invloed hebben op de plaatsing voor de play-offs.',
  },
  own_division: {
    term: 'jouw divisie',
    text: 'Een wedstrijd tussen ploegen uit de divisie van een van jouw teams. Direct van invloed op wie die divisie wint.',
  },
  full_replay: {
    term: 'Volledige replay',
    text: 'De volledige, reclamevrije replay op DAZN. Reken op ongeveer drie uur kijktijd.',
  },
  primetime: {
    term: 'primetime',
    text: 'De losstaande avondwedstrijden: Thursday Night, Sunday Night en Monday Night. Hier beginnen ze midden in de nacht.',
  },
  mnf: {
    term: 'Monday Night Football',
    text: 'De losstaande maandagavondwedstrijd in de Verenigde Staten. In Nederland begint die in de nacht naar dinsdag.',
  },
  snf: {
    term: 'Sunday Night Football',
    text: 'De centrale zondagavondwedstrijd in de Verenigde Staten. In Nederland begint die in de nacht naar maandag.',
  },
  tnf: {
    term: 'Thursday Night Football',
    text: 'De centrale donderdagavondwedstrijd in de Verenigde Staten. In Nederland begint die in de nacht naar vrijdag.',
  },
};

export const GLOSSARY_ORDER = [
  'down', 'drive', 'red_zone', 'turnover', 'two_minute_warning',
  'division', 'conference', 'interconference', 'bye', 'seed', 'wildcard', 'spread',
  'full_replay', 'game_in_40', 'sunday_in_60', 'all22', 'primetime', 'mnf', 'snf', 'tnf',
  'own_division', 'seeding_impact',
];
