# NFL Watchdog — v2

Stand: 21 augustus 2026.

Spoilervrije NFL-kijkgids. Eén gebruiker, geen server, geen database.
Fase 1 t/m 4 opgeleverd: ingest, datamodel, publiek/privé-scheiding, watchability-score,
planner, CLI-weekoverzicht, teasers met spoiler-linter, de statische web-UI, en de
NFL-uitleglaag met glossarium en playoff-bracket.

v2 voegt daar de iOS-kant aan toe: installeerbaar als webapp op het beginscherm,
safe-area-afhandeling, een back-up van de lokale stand, en de mobiele fixes uit de
meting op 375px. Zie **iOS en het beginscherm**.

## Draaien

```bash
npm run ingest -- --season 2026 --weeks 1-18   # actief seizoen
npm run ingest -- --season 2025 --weeks 1-18   # testset met uitslagen
node src/cli.js --week 1                         # weekoverzicht (actief seizoen)
node src/cli.js --season 2025 --week 14 --watched 13   # ander seizoen
node src/cli.js --week 14 --full 2 --in40 3      # weekvorm overschrijven
node src/cli.js --week 14 --no-rating           # plan op inzet vooraf i.p.v. verloop
node src/cli.js --week 14 --hints               # level 2
node src/cli.js --week 14 --result <game_id>    # level 3
npm test                                        # 108 tests

npm run dev                                     # web-UI op localhost:5173
npm run build                                   # statische build naar dist/
npm run verify                                  # build + alle tests, inclusief dist-scan
node scripts/fetch-logos.js                     # eenmalig, logos staan in assets/logos/
npm run icons                                   # iconen opnieuw genereren
npm run ingest:teams -- --refresh               # teamgids opnieuw ophalen
```

## Architectuur

```
src/espn.js      gecachte fetches; alles in data/cache/, runs zijn offline herhaalbaar
src/metrics.js   win-prob-metrics; leest nooit de score
src/score.js     percentielen over het seizoen -> 1-5, plus stakes_pre (level 0)
src/planner.js   budgetverdeling, degradatieladder, pakket A/B
src/schema.js    DE SPOILERGRENS — allowlist van publieke velden
src/tags.js      level 0-tags; gedeeld met de browser omdat favorieten daar wijzigen
src/explain.js   waarom-uitleg per wedstrijd; legt de kéuze uit, niet de wedstrijd
src/watched.js   poort tussen weken; records in week N zijn de stand ná week N-1
src/linter.js    deterministische spoiler-linter; geen model, geen randomness
src/teasers.js   templates uit level 0/1; gelint voor publicatie, anders fallback
src/time.js      Intl met named zones, nooit een vaste offset
src/teams.js     DE SPOILERGRENS VOOR TEAMDATA — allowlist voor de teamgids
src/ingest.js    orchestratie, schrijft public/ en private/
src/cli.js       weekoverzicht; planner draait op weergavemoment, niet bij ingest

web/src/App.jsx        tijdlijn, weekkiezer, weekvorm-stepper
web/src/lib/data.js    ALLE netwerkcalls; de spoilergrens in één bestand
web/src/lib/prefs.js   favorieten in localStorage, over de config heen
web/src/components/    GameCard (met de twee onthulstappen), Controls, TeamSettings,
                       Explainer, PlayoffBracket, Term, TeamLogo, WeekGate, Backup
web/src/lib/glossary.js  begrippen; puur spelregels, niets seizoensgebonden
scripts/copy-data.js   stagen van data naar de build
scripts/make-icons.js  genereert de home-screen-iconen; geen dependencies
scripts/ingest-teams.js  bouwt de teamgids; draait los van de wekelijkse ingest
```

De planner uit `src/planner.js` draait ongewijzigd in de browser. Dat kan alleen
omdat hij uitsluitend publieke velden leest — dat was bij F1 al de reden om hem zo
te schrijven.

## Databronnen

Twee ESPN-endpoints per wedstrijd, geen key nodig:

- `core/events/{id}/competitions/{id}/plays?limit=500` — periode, klok, scoringPlay, stand
- `core/events/{id}/competitions/{id}/probabilities?limit=1000` — homeWinPercentage

Join op play-id. Geverifieerd, niet aangenomen:

- `summary.winprobability` mist `secondsLeft`, daarom is `plays` nodig voor de kwartindeling.
- `secondsLeft` op de probabilities-rijen is altijd 0. Onbruikbaar.
- `sequenceNumber` codeert de periode niet; die overlappen tussen kwarten.
- Het `records`-veld op de scoreboard van week N is het record ná die week.
  Records worden daarom zelf opgeteld uit weken 1..N-1.

## Spoilerbeslissingen

- **Allowlist, geen blocklist.** `schema.js` is de enige plek waar een veld publiek
  wordt. `buildPublicGame()` plukt; er wordt nooit een ESPN-object gespread.
- **Ruwe metrics blijven privé.** `volatility: 0` betekent letterlijk "één team
  stond de hele wedstrijd voor".
- **`sunday_in_60` is geen formaatwaarde.** Het is een weekpost van 60 minuten die
  de hele zondagslate dekt, en dus terminaal: hij spoilt elke zondagwedstrijd die
  je nog wilde kijken. Krijgt alleen minuten die na je eigen teams overblijven.
- **Niet-favorieten krijgen nooit `full`.** Anders wordt "full" een betrouwbaar
  merkteken voor een hoge rating.

## Bekende eigenschap: de rating lekt de vorm, niet de winnaar

Gemeten over seizoen 2025 correleert de watchability-rating **-0,70** met de
eindmarge. 93% van de 4-sterren en 100% van de 5-sterren eindigde binnen 7 punten,
tegen 11% van de 2-sterren. Een hoge rating zegt dus: het bleef lang dicht.

Wie er won is wél volledig afgeschermd — de test `de rating voorspelt de winnaar
niet` bewaakt dat de thuiswinst-verdeling per ratingbucket tussen 30 en 70 procent
blijft.

`show_watchability` staat op **false**. De rating staat daarmee niet in de publieke
payload — hij zou anders in F3 gewoon in view-source zichtbaar zijn — en leeft op
level 2, achter `--hints`. De planner draait op `planning_basis: "pre_game_only"`
en rangschikt op `stakes_pre`, dat puur uit de records vóór de week volgt.

Zet je hem terug op true, dan is een nieuwe ingest nodig; het veld wordt bij het
schrijven weggelaten, niet bij het tonen.

## Planningsmodus

`planning_mode: "quota"` is de actieve modus: een vaste weekvorm van 2 full replays
plus 3x Game in 40, samen 490 minuten. Slots worden verdeeld op prioriteit — eigen
teams op rang eerst, daarna de rest op rating.

Full-plekken gaan nooit naar een niet-favoriet. In 14 van de 18 weken spelen KC, DET
en SF alle drie, dus in de praktijk kost die regel niets, en het voorkomt dat "full"
een betrouwbaar merkteken voor een hoge rating wordt. Een ongebruikte full-plek wordt
een extra 40-plek in plaats van een cadeau aan de hoogst gerate wedstrijd.

De oude `planning_mode: "budget"` bestaat nog: die vult een minutenbudget op met een
degradatieladder over de eigen teams. Getest en werkend, maar niet de default.

Let op bij budgetmodus: drie eigen teams op `full` kosten 555 minuten. Tegen een
budget van 240 komt de rest van de week dan nooit aan bod — zet
`own_team_default_format` op `game_in_40` als je die modus gebruikt.

## Teasers en de linter

Eén zin per wedstrijd, maximaal 15 woorden, alleen uit level 0- en 1-velden. Geen
model in dit pad. Elke kandidaat gaat door `lintTeaser()`; de eerste die schoon is
wint, anders de vaste fallback. Een afgekeurde teaser wordt nooit gerepareerd —
dat is precies waar een lek terugkruipt.

Regels: `max_words`, `digits`, `spoiler_word` (exacte lijst plus stammen voor
Nederlandse verbuiging), `player_name`. Die laatste toetst tegen de achternamen uit
de play-by-play van díe wedstrijd, opgehaald uit de `Z.Gonzalez`-notatie.

Bewust overblokkeren: een valse treffer kost een generieke teaser, een gemist lek
kost het hele project. Twee echte gaten die de tests vonden: "wonnen" ontbrak, en
"kansloos" ving "kansloze" niet — vandaar de stammenlijst naast de woordenlijst.

Uitzondering op de cijferregel: `49ers`, het enige legitieme token met cijfers.

29 lekvoorbeelden in `test/linter.test.js`, plus een end-to-end test die alle 272
gepubliceerde teasers lint tegen de echte spelerslijst van die wedstrijd.

## Web-UI en de spoilergrens

De initiële pagina haalt alleen `data/index.json` en `data/public/week-N.json` op.
`hints.json` komt pas bij de eerste klik, `results.json` pas na de tweede plus een
expliciete bevestiging. Empirisch geverifieerd in de browser via het netwerkpaneel,
niet alleen beredeneerd.

`dist/data/private/` staat wél in de build — anders werkt level 3 niet. "Privé"
betekent hier "niet in de initiële payload", niet "afgeschermd". `test/build-leak.test.js`
toetst daarom de juiste dingen: alle 272 scoreregels tegen `index.html` plus de JS- en
CSS-bundel, en het bestaan van de privé-bestanden in dist.

## Favorieten wijzigen in de browser

Het Teams-paneel zet elk van de 32 teams op favorite, watchlist, neutral of avoid,
met een rangvolgorde voor de favorieten. Dat staat in localStorage en gaat over
`config/preferences.json` heen; die blijft de bron voor de CLI en de ingest.

Consequentie die niet vanzelf zichtbaar is: `own_team`, `jouw divisie` en
`indirect belangrijk` werden bij ingest berekend uit de config. Zodra je favorieten
in de browser wijzigt, beschrijven die tags iemand anders. Daarom staat de logica in
`src/tags.js` en berekent de browser ze opnieuw uit level 0-velden. Ingest en browser
gebruiken dezelfde functie, dus ze kunnen niet uit elkaar lopen.

## Logos

`scripts/fetch-logos.js` haalt de 32 crests eenmalig bij ESPN op, schaalt ze met sips
terug naar 96px (45 kB → 7 kB per stuk) en zet ze in `assets/logos/`. Gecommit, dus
de pagina doet geen enkele request naar een derde partij. De dark-variant van ESPN
is byte-identiek aan de lichte, dus één set volstaat.

## Teamgids

Uitklapbaar onderaan: per team de coach, het stadion, de opstelling en een paar
feiten over de selectie. Dit **verving de uitleglaag** over de competitie — die
legde de spelregels uit, deze legt de deelnemers uit. Wat daarmee van de pagina
verdween: het glossariumoverzicht, de playoff-bracket en de uitleg over de
tijdzones. De tooltips op de termen in de UI zelf (badges, formaatlabels, All-22,
bye) staan los van dat paneel en werken gewoon door; `glossary.js` en zijn test
zijn ongewijzigd. Bracket en uitleglaag staan in de historie, vóór `37f9958`.

**Waar het vandaan komt.** Drie ESPN-endpoints per team: het teamprofiel, de
roster en de depth chart. Alle drie dragen ze uitslagen, en `src/teams.js` is de
enige plek waar er een veld doorheen komt — dezelfde rol als `schema.js` voor de
wedstrijden, en om dezelfde reden geplukt in plaats van gespreid:

- `team.record` draagt `summary: "0-1"` én `avgPointsFor` / `avgPointsAgainst`.
- `roster.team.seasonSummary` is buiten het voorseizoen het W-L-record.
- De roster kent de groep `injuredReserveOrOut`, en per speler `status` en
  `injuries`.

Die laatste is de subtielste. Wie halverwege het seizoen op IR staat, raakte
geblesseerd in een wedstrijd die jij misschien nog moet kijken. Alleen de groepen
`offense`, `defense` en `specialTeam` doen mee; status en blessures worden nergens
overgenomen. `test/teams.test.js` bewaakt dat met een fixture die precies die
vuile velden draagt, plus een scan over het gepubliceerde bestand: geen verboden
sleutel, geen waarde in de vorm `12-5`, en geen getal buiten een vaste witte lijst
(rugnummer, leeftijd, dienstjaren, aantallen).

**De selectie is elf namen, geen opstelling.** Uit de depth chart: QB, RB, drie
WR's, TE, en per verdedigende linie één naam — edge, interior, linebacker,
secondary — plus de kicker. Zonder die indeling per linie leverde een 4-3 vier
keer de defensive line op en geen enkele linebacker. De positieafkorting komt uit
de payload zelf, zodat er NT staat waar een team een nose tackle opstelt.

**Eén gids, van het actieve seizoen.** De rosterdata van ESPN is de stand van nu
en bestaat niet met terugwerkende kracht, dus er is geen `teams.json` voor 2025.
Het paneel hangt daarom aan `index.current` en niet aan de seizoenkiezer — daaraan
gehangen gaf 2025 een 404, en die fout bleef daarna staan omdat de laadpoging na
een mislukking niet meer werd herhaald. Het laden zit nu in een effect op
`season` plus een pogingenteller, met een knop "Opnieuw proberen"; de regel boven
de lijst noemt het seizoen waar de gids over gaat.

**De gids wordt niet wekelijks ververst, en dat is de belangrijkste keuze hier.**
Een depth chart halverwege het seizoen is geen neutraal gegeven: een quarterback
die van plek 1 naar plek 2 zakt, zakte daar om een reden die in een wedstrijd
gebeurde die jij nog moet kijken. `scripts/ingest-teams.js` overschrijft daarom
niets tenzij je `--refresh` meegeeft, en de wekelijkse cron raakt hem niet aan.
De gids is een momentopname van vóór het seizoen.

`--refresh` slaat ook de HTTP-cache over (`cachedJson(key, url, { refresh })`).
Zonder dat deed de vlag alleen het uitvoerbestand overschrijven en werd de gids
opnieuw uit dezelfde payloads in `data/cache/` gebouwd: een verse bestandsdatum
boven weken oude namen, zonder enig teken dat er niets was opgehaald.

Het bestand is 96 kB en wordt pas opgehaald als je het paneel opent — het hoort
niet in de eerste payload van een pagina die je opent om te zien wat je gaat
kijken.

## Wekelijkse ingest (GitHub Actions)

`.github/workflows/ingest.yml` draait dinsdag 07:00 UTC — 09:00 Nederlandse tijd in
de zomer, 08:00 in de winter. Monday Night eindigt hier rond 05:30, dus de hele
speelronde is dan binnen. Handmatig draaien kan via workflow_dispatch met een eigen
seizoen en weekbereik.

Twee dingen die er bewust in zitten:

- **Build en tests draaien vóór de commit.** Faalt de leak-scan, dan wordt er niets
  gepusht. De cron kan dus geen lekkende data publiceren.
- **ESPN-responses gaan door actions/cache** met een restore-key per seizoen.
  Afgelopen wedstrijden veranderen niet meer, dus na de eerste run hoeft alleen de
  nieuwe week opgehaald te worden in plaats van alle 272.

Geverifieerd met twee handmatige runs: 272 wedstrijden, build, 75 tests, ~20 seconden.
De repo-default voor `GITHUB_TOKEN` staat op read; de expliciete `permissions:
contents: write` in de workflow overschrijft dat en is in de job-setup bevestigd.

## Hosting

**Live: https://fremnlai-coder.github.io/nfl-watchdog/** (GitHub Pages) (Vercel Hobby, privérepo). **Let op: er is
geen Git-koppeling** — pushes en de dinsdagcron deployen niet automatisch. Zie
hieronder.

Geverifieerd op de live site, niet alleen lokaal:

- `X-Robots-Tag: noindex, nofollow, noarchive` staat op de pagina én op de
  privé-databestanden. `robots.txt` zet alles dicht.
- 0 van de 272 scoreregels in de initiële payload (index.html plus de JS- en
  CSS-bundel, samen 236 kB). Ook geen hint-teksten.
- Requestvolgorde in de browser: bij laden alleen `index.json` en het publieke
  weekbestand; `hints.json` pas na de eerste klik; `results.json` pas na de
  bevestiging. De bevestigingsvraag zelf doet geen prefetch.


`vercel.json` legt de buildinstellingen vast, zodat er in de Vercel-UI niets
handmatig ingevuld hoeft te worden: framework vite, build `npm run build`, output
`dist`. Vercel free werkt met een privérepo; GitHub Pages zou de repo publiek
vereisen.

Koppelen moet Joppe zelf doen — dat vraagt om het autoriseren van de Vercel GitHub
App: vercel.com → Add New → Project → `fremnlai-coder/nfl-watchdog`. Daarna deployt
elke push automatisch, inclusief die van de dinsdagochtend-cron.

`X-Robots-Tag: noindex` staat op alles, plus een `robots.txt` die alles dichtzet.
Dat is geen preutsheid: `data/private/` bevat eindstanden, en een zoekmachine die
die indexeert zet ze in zoekresultaten en autocomplete — precies het lek waar de
rest van dit project omheen gebouwd is. Data-bestanden krijgen bovendien
`must-revalidate`, zodat de browser na de dinsdagupdate niet de week ervoor
serveert.

Railway is bewust niet gebruikt: die staat op de niet-gebruiken-lijst in de brief,
en voor een statische site zonder server of database draait dat een container die
kost wat een CDN gratis doet.

## Kaartontwerp en de waarom-uitleg

Elke geplande wedstrijd is een kaart in de tijdlijn (één kolom). Uit- en thuisploeg
staan gestapeld met de `@` in de goot; dat is niet cosmetisch maar de oplossing voor
de mobiele wrap, waar één regel uiteenviel in drie en de `@` verweesd achterbleef.

De knop **Waarom dit advies?** onderaan de kaart opent de uitleg. Bewust die
formulering en niet "waarom dit een mooie wedstrijd is": dat laatste is een oordeel
over een gespeelde wedstrijd, en dus uitkomstinformatie. Het gaat over het advies,
niet over de wedstrijd.

Die knop stond eerder als `waarom?` rechts op de scheidingsstreep tússen de twee
ploegen — en dus in dezelfde kolom als de records, waar hij las als een derde
waarde onder `0-0` in plaats van als bediening. Het teamblok is nu geen knop meer
maar gewoon gegevens; de twee acties (`Waarom dit advies?`, `Toon hints`) staan naast
elkaar onderaan, en de uitleg opent onder de knop die hem opent. De uitleg komt volledig uit
level 0 — voorkeursrang, positie in de weekvorm, records vóór de week, divisie,
seeding-impact, aftraptijd — met een vast voorbehoud eronder. `test/explain.test.js`
draait alle 272 wedstrijden langs een verboden-woordenlijst.

Toegankelijkheid, gemeten op de live site en daarna hersteld:

- Light mode had vijf contrastfouten (`stone-400` op `stone-50` = 2,48; badges 3,65
  en 4,02). Nu nul: badges op `-700`, secundaire tekst op `stone-500`/`600`.
- Horizontale overflow op mobiel (scrollWidth 495 bij viewport 375), veroorzaakt
  door de teamrijen in het instellingenpaneel. Nu 375 = 375.
- Raakvlakken onder de 24×24 in het teampaneel zijn opgehoogd.

## Seizoenen

Data staat per seizoen: `data/public/{jaar}/week-N.json` en idem privé. Zonder die
scheiding overschrijft een 2026-ingest week 1 van 2025 in dezelfde map en houd je
een mengsel over — en de leak-scan heeft een **afgelopen** seizoen nodig, want
alleen daar zijn uitslagen om tegen te scannen.

- **2026** is het actieve seizoen (`season` in de config, `current` in `data/index.json`).
- **2025** blijft staan als testset. Alle spoilertests draaien daartegen.

De web-UI heeft een seizoenskiezer zodra er meer dan één seizoen is.

Let op bij een seizoen dat nog niet gespeeld is: elk team staat op 0-0, dus
`stakes_pre` valt overal in de laagste twee buckets. Dat is geen fout maar de
werkelijkheid — vóór week 1 onderscheidt niets de wedstrijden behalve divisie en
conference. Zodra de dinsdagcron gespeelde weken binnenhaalt, lopen de records
uiteen en spreidt de inzet zich vanzelf.

## De poort tussen weken

Alle andere spoilerregels werken bínnen één week. Deze gaat over de relatie
ertussen, en is de makkelijkste om over het hoofd te zien omdat er niets op de
pagina staat dat op een spoiler lijkt.

`records_before` in week N is de stand ná week N-1. Open je week 6 terwijl je tot
week 2 hebt gekeken, dan vertelt een record van 3-1 in plaats van 2-1 je hoe de
tussenliggende weken afliepen — voor alle 32 ploegen tegelijk. `stakes_pre` volgt
uit diezelfde records en lekt dus mee.

De regel: je mag altijd **één week vooruit**. Heb je tot en met week 3 gekeken, dan
draagt week 4 de stand ná week 3 en die ken je al. Week 5 niet.

Belangrijk: de poort blokkeert de **fetch**, niet alleen de weergave. Het bestand
dat geladen zou worden bevat de stand; "wel opgehaald maar verborgen" is geen
garantie. Geverifieerd in het netwerkpaneel: bij een geblokkeerde week wordt
`week-N.json` nooit aangevraagd.

De teller staat per seizoen in localStorage, niet in de config — hij verandert
elke week, en de ingest opnieuw draaien om een teller te verzetten slaat nergens
op. `watched_through_week` in de config levert alleen de startwaarde en dient de
CLI, die `--watched <week>` en `--force` kent.

## Vercel: openstaand probleem

Het project heet in Vercel `nfl-watchdog-nl`; het domein `nfl-watchdog.vercel.app`
is verdwenen bij het verwijderen van het oude project. De werkende URL is
`nfl-watchdog-test.vercel.app` — een alias uit de periode dat het project zo heette.

Het gemeten patroon over drie projecten: **de eerste deployment naar een nieuw
project slaagt, elke volgende blijft hangen** op status UNKNOWN zonder duur.

- Oud project: 1 van 10 geslaagd
- Vers testproject: eerste deploy Ready in 3s, daarna hangt het
- Na hernoemen naar een schone naam: hangt eveneens

Uitgesloten: de code (verse clone bouwt in 438 ms), de buildconfiguratie
(`vercel build` slaagt lokaal met de echte projectinstellingen), de outputmap, en
SSO-protectie (uitgezet, hielp niet). Ook een `--prebuilt` deploy zonder enige
buildstap hangt. Dit is dus accountniveau, niet projectniveau — verwijderen en
opnieuw aanmaken heeft het niet opgelost.

Volgende stap is Vercel support, of uitwijken. Overweeg **GitHub Pages**: dat
vraagt een publieke repo (de inhoud is openbare NFL-data, dus dat kan) en dan kan
de bestaande Actions-workflow direct naar Pages publiceren. Daarmee vervalt Vercel
als afhankelijkheid en loopt de dinsdagcron in dezelfde pijplijn.

## Publiceren via GitHub Pages

`.github/workflows/pages.yml` bouwt en publiceert. Twee dingen die er bewust in
zitten:

- **`npm test` draait vóór het uploaden.** Zelfde regel als bij de ingest: faalt
  de leak-scan, dan gaat er niets live.
- **De ingest roept deze workflow aan** in plaats van erop te vertrouwen dat de
  push hem triggert. Een push vanuit een workflow met `GITHUB_TOKEN` start met
  opzet géén andere workflows; zonder die aanroep zou de dinsdagcron wel data
  committen maar nooit publiceren.

Pages serveert vanaf `/<repo>/`, dus de build krijgt `VITE_BASE=/nfl-watchdog/`
mee. Een relatieve base breekt daar zodra een URL zijn afsluitende slash mist.

**Gedaan op 21 augustus 2026:** repo publiek, Pages-source op GitHub Actions.
De site draait; Vercel is niet meer in gebruik.

**Wat je daarmee inlevert:** Pages kan geen response-headers zetten, dus de
`X-Robots-Tag: noindex` uit `vercel.json` vervalt. Voor de HTML blijft de
meta-tag in `index.html` gelden, maar voor de JSON onder `data/private/` is
`robots.txt` dan de enige bescherming. Bovendien staat die JSON in een publieke
repo ook gewoon op github.com. Het gaat om openbare NFL-uitslagen, dus er lekt
niets vertrouwelijks — maar het is een zwakkere afscherming dan op Vercel.

## iOS en het beginscherm

De site wordt vooral op een iPhone gebruikt. Dat verandert vier dingen.

**Opslag is daar geen opslag.** Favorieten en de kijkstand staan in localStorage,
en Safari wist die van een gewone site na zeven dagen waarin je hem niet opent.
Een naar het beginscherm toegevoegde webapp valt buiten die regel — dat is de
reden voor de manifest en de `apple-mobile-web-app-capable`, niet het uiterlijk.

Wat er misgaat als de opslag tóch weg is, valt de goede kant op: `watched_through_week`
in de config staat op 0, dus de teller valt terug naar nul en de poort doet dán
juist te véél dicht. Vervelend, geen lek. Een import kan dat wel worden, en daarom
weigert `parseBackup()` een kijkstand buiten 0–18 in plaats van 'm te knippen —
`test/backup.test.js` bewaakt dat.

**De back-up.** `Backup.jsx` schrijft favorieten plus kijkstand naar klembord of
bestand, en leest ze terug uit een bestand of uit geplakte tekst. Het paneel staat
ook in het scherm van de weekpoort: dat is precies waar je landt als de opslag weg
is, en van daaruit kom je anders nergens meer. Let op: de webapp op je beginscherm
heeft een eigen opslag, los van Safari. Wie overstapt begint leeg en moet één keer
terugzetten.

**De iconen.** `scripts/make-icons.js` tekent ze zelf — een PNG is zlib plus vier
chunks, en zo blijft het project zonder image-dependency. De kleuren komen uit
dezelfde oklch-waarden als `--color-field` en `--color-chalk` in de stylesheet, via
een oklch→sRGB-conversie in het script. De bal is een lens (twee cirkelbogen), geen
ellips: een ellips rondt precies de punten af waaraan je 'm op 60 pixels herkent.

De manifest gebruikt **relatieve** paden (`start_url: "./"`, `icons/icon-192.png`).
Die lossen op tegen de URL van de manifest zelf en werken daarmee zowel op
localhost als onder `/nfl-watchdog/` op Pages. In `index.html` staan de verwijzingen
juist absoluut, want Vite zet daar de base voor. `test/pwa.test.js` controleert dat
allebei, tegen welke base er ook gebouwd is.

**Gemeten op 375 px, en daarna hersteld:**

- Glossariumtooltips waren op mobiel onbereikbaar én afgeknipt. Ze hingen op
  `hover`, die op touch niet bestaat, waren 16 rem breed op een scherm van 375, en
  `GameCard` knipt ze hoe dan ook af — de kaart heeft `overflow-hidden` voor zijn
  ronde hoeken, en daar ontsnapt geen enkele positionering aan. Onder `sm` is het
  nu een `fixed` paneel onderaan het venster, geopend met een tap.
- Diezelfde tap gaf de term focus, waardoor `focus-within` het paneel meteen weer
  opende: sluiten was onmogelijk. Nu `:has(:focus-visible)`, dat alleen op
  toetsenbordfocus reageert.
- De week- en seizoenkiezer stonden op 14 px. Safari zoomt bij focus in op elk
  veld onder de 16 px en zoomt niet terug; elke weekwissel liet je dus op een
  uitvergrote pagina achter. Nu 16 px onder `(pointer: coarse)`.
- Raakvlakken lagen op 21×24 (de rangpijlen) tot 30 px. Nu minimaal 29×32, met de
  tier-knoppen op 36 en de kaartknoppen op 34. Apple houdt 44 aan; dat is hier niet
  gehaald, omdat 44 op de teamlijst van 32 rijen het paneel onwerkbaar lang maakt.
- Horizontale overflow: 375 = 375, ook met het teampaneel open.

Wat hier **niet** mee getest is: dit is gemeten in een Chromium op een viewport van
375×812, niet in Safari op een echt toestel. Xcode staat niet op deze Mac (alleen
Command Line Tools), dus er is geen simulator. De insets, de statusbalk in
standalone-modus en het toevoegen aan het beginscherm zijn dus beredeneerd, niet
waargenomen — controleer die één keer op de telefoon zelf.

## Ontwerpronde na de critique

Drie dingen uit een critique op de mobiele weergave, alle drie gemeten voor en na.

**De glossariumterm was onbereikbaar voor VoiceOver.** Hij was een `span` met
`role="button"` die op `pointerdown` luisterde. Het activeergebaar van VoiceOver
levert een `click` en geen pointer-event, dus daar gebeurde niets — geverifieerd
met `term.click()`, dat de state onaangeroerd liet. Nu een echte `<button>`, die
meteen ook Enter en spatie meebrengt.

**Contrast staat op nul fouten in beide schema's.** Gemeten met een audit die elke
zichtbare tekst tegen zijn werkelijke achtergrond legt (canvas-resolutie, want de
computed styles komen er als `oklch` uit). Wat eruit kwam:

| | licht | donker |
|---|---|---|
| `·` tussen twee regels in de kaart | 1,49 | 1,70 |
| `Fav` / `Watch` in het teampaneel | 3,65 / 4,02 | 3,65 / 4,02 |
| `Nooit` | 2,59 | — |
| `#1`-rang | 3,50 | — |
| "tegen" in de bracket | 2,48 | — |

De -600→-700-correctie was in v1 wél op de format-badges toegepast en niet op de
tier-knoppen; die hebben geen dark-variant, vandaar dat ze in beide schema's
zakten. Laagste waarde nu 4,58.

**"Rest van de week" is één regel per wedstrijd.** Die sectie was elf kaarten van
rond de 250px — 2769 van de 5557 pixels, oftewel de halve pagina, voor precies wat
je níét gaat kijken. `compact` haalde alleen de teaser weg en verkleinde het logo,
27px per kaart. Nu 42px per rij (tijd, `NE @ SEA`, reden), met de volledige kaart
één tik weg. Sectie 2769 → 588, pagina 5557 → 3414, van 6,8 naar 4,2 schermen.

Daarbij verschoven: de panelen Teams en Back-up staan nu ónder de wedstrijden in
plaats van erboven. Het Kijkpakket verhuisde eerst van onderaan naar boven de
wedstrijden, werd daarna van twee kaders naar twee regels teruggebracht, en is
uiteindelijk helemaal weg — zie hieronder.

## Alles wat geen wedstrijd is, is ingeklapt

Vervolg op de vorige ronde, op één regel gebracht: het gaat om de wedstrijden.
Wat er stond en wat het nu is, op een venster van 375×812:

| | vóór | na |
|---|---|---|
| Kop | 112px (titel op 24px, twee alinea's) | 46px, één regel |
| Weekkiezer + weekvorm | 200px | 90px |
| Kijkpakket | 284px (twee kaders) | weg |
| Eerste wedstrijd begint op | y=718 | y=391 |
| Hele pagina | 5557px (6,8 schermen) | 3085px (3,8) |

Drie beslissingen daarachter:

- **De weekvorm zit achter een `details`.** Die twee stappers zet je één keer per
  seizoen. De summary toont de stand ("Weekvorm 2× full · 3× Game in 40 · 490 min"),
  dus inklappen kost je geen informatie.
- **De weekkiezer heeft een vaste breedte (`w-20`).** De optie "· nog niet gekeken"
  bepaalde anders de breedte van het hele veld, waardoor Seizoen naar een tweede
  regel viel. De lijst zelf toont de volledige tekst nog gewoon.
- **Het tijdverschil met New York staat nog voluit in de uitleglaag.** In de kop is
  het teruggebracht tot "(+6 u t.o.v. New York)".

**De samenvatting van pakket A en B staat niet meer in de web-UI.** Hij herhaalde
grotendeels de weekvorm-regel erboven, en de rest — hoeveel wedstrijden ongezien
blijven, of de recap past — is context bij een beslissing die je één keer per week
neemt, niet iets wat boven elke sessie hoort te staan. `planBoth()` draait
ongewijzigd door: pakket A levert het formaatadvies dat op elke kaart staat, en de
CLI (`node src/cli.js --week N`) toont de volledige A/B-vergelijking nog wel.

Wil je hem terug in de browser, dan staat de component in de git-historie
(`web/src/components/PackageSummary.jsx`, verwijderd na `ec4accd`).

**"Jouw teams" en "Kijkwaardig" zijn één lijst geworden**, met de kop **Kijken**.
Een kop en een noot minder boven de wedstrijden; `format_reason` staat op elke
kaart ("eigen team", "op inzet vooraf"), dus de groepering blijft leesbaar zonder
tussenkop.

**Beide lijsten staan op aftraptijd** — Kijken en Rest van de week. Dat is de
veiligste volgorde die er is: een aftraptijd ligt vast voordat er gespeeld wordt,
dus de plek in de lijst codeert niets over hoe het afliep. De vorige volgorde
(eigen teams op voorkeursrang, daarna op `stakes_pre`) was ook spoilervrij, maar
zei wél iets over de verwachte inzet. Nu zegt hij alleen nog iets over de klok, en
wat de planner ervan vindt staat op de kaart zelf.

Sorteren op de rating blijft uitgesloten: dat zou de wedstrijden die lang dicht
bleven vooraan zetten, en de volgorde van een lijst is net zo goed
uitkomstinformatie als een cijfer. Die regel staat in de voet van de pagina.

**En daarmee is het één tijdlijn geworden.** "Kijken" en "Rest van de week" zijn
samen één sectie, `Week N`, met alle wedstrijden op aftraptijd. Wat eerst in twee
koppen zat, zit nu in de vorm van de rij: een geplande wedstrijd is een kaart, een
overgeslagen wedstrijd één regel van 42px. De noot eronder telt de verdeling
("5 in je weekvorm, 11 overgeslagen").

Twee dingen die daarbij horen:

- **Eén kolom, ook op een breed scherm.** Twee kolommen breken een tijdlijn: dan
  loopt de tijd van links naar rechts en pas daarna naar beneden. De lijst is wel
  afgetopt op `max-w-3xl`, anders staat een kaart met drie regels tekst over de
  volle 64rem half leeg. De instellingen eronder houden de volle breedte, want die
  hebben hun twee kolommen nodig.
- **Geen aantal achter de kop.** Naast "Week 1" leest een losse "16" als deel van
  het weeknummer.

## Altijd donker

De app volgt de systeeminstelling niet meer; hij staat altijd in dark mode. Dat is
één regel in `styles.css`:

```css
@custom-variant dark (&);
```

Daarmee gelden alle bestaande `dark:`-klassen onvoorwaardelijk in plaats van via
`prefers-color-scheme`, en hoefde er in de componenten niets herschreven te worden.
De basis in `body` staat op `bg-stone-950 text-stone-100`, en `color-scheme: dark`
op `:root` regelt wat de browser zelf tekent: selects, scrollbalken, tekstcursor.

Meegenomen omdat ze anders licht blijven:

- `theme-color` in `index.html` is één waarde (`#0c0a09`) in plaats van twee
  media-gescoopte varianten.
- `background_color` en `theme_color` in de manifest staan op dezelfde kleur —
  dat is het splashscherm bij het starten vanaf het beginscherm.
- De statusbalk in standalone-modus staat op `black`. Niet `default`, want dat
  geeft een lichte balk met zwarte tekst boven een donkere app; en niet
  `black-translucent`, want dan loopt de pagina eronder door en hangt het aan de
  safe-area-padding of dat goed valt — en dat kan hier niet op een toestel
  getoetst worden.

Geverifieerd met het systeem op licht: `body` blijft `stone-950`, er is geen enkel
licht oppervlak meer in de DOM, en de contrastaudit blijft op nul fouten. In de
gecompileerde CSS komt `prefers-color-scheme` niet meer voor.

## Nog te doen

- Tiers: alles staat op `neutral` behalve KC/DET/SF; watchlist en avoid nog leeg
- Eén ronde op een echte iPhone: icoon, splash, statusbalk, insets in landscape,
  en of de download uit "Bewaar als bestand" netjes in Bestanden landt
- Remote: github.com/fremnlai-coder/nfl-watchdog (publiek, Pages via Actions)
