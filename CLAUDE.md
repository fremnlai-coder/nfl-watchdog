# NFL Watchdog — v1

Stand: 21 augustus 2026.

Spoilervrije NFL-kijkgids. Eén gebruiker, geen server, geen database.
Fase 1 t/m 4 opgeleverd: ingest, datamodel, publiek/privé-scheiding, watchability-score,
planner, CLI-weekoverzicht, teasers met spoiler-linter, de statische web-UI, en de
NFL-uitleglaag met glossarium en playoff-bracket.

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
npm test                                        # 89 tests

npm run dev                                     # web-UI op localhost:5173
npm run build                                   # statische build naar dist/
npm run verify                                  # build + alle tests, inclusief dist-scan
node scripts/fetch-logos.js                     # eenmalig, logos staan in assets/logos/
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
src/ingest.js    orchestratie, schrijft public/ en private/
src/cli.js       weekoverzicht; planner draait op weergavemoment, niet bij ingest

web/src/App.jsx        secties, weekkiezer, weekvorm-stepper
web/src/lib/data.js    ALLE netwerkcalls; de spoilergrens in één bestand
web/src/lib/prefs.js   favorieten in localStorage, over de config heen
web/src/components/    GameCard (met de twee onthulstappen), Controls, PackageSummary,
                       TeamSettings, Explainer, PlayoffBracket, Term, TeamLogo
web/src/lib/glossary.js  begrippen; puur spelregels, niets seizoensgebonden
scripts/copy-data.js   stagen van data naar de build
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

## Uitleglaag

Uitklapbaar onderaan: competitiestructuur, wanneer het hier is, de playoff-bracket
en een glossarium van zestien begrippen. Termen in de UI zelf — de badges, de
formaatlabels, All-22, bye — hangen aan tooltips die ook op toetsenbordfocus
openen, niet alleen op hover.

De bracket staat bewust op **seednummers en niet op ploegen**. Een ingevulde bracket
is de grootste spoiler die deze tool zou kunnen bevatten: die verraadt in één blik
wie de divisies won, wie de wildcards pakte en wie er per ronde doorging. Als
formaatdiagram is het level 0, want niets ervan hangt van een uitslag af.

Wil je hem ooit wél ingevuld: dat vraagt een aparte ingest van `seasontype=3` en
hoort dan achter level 3 met bevestiging, net als een eindstand.

Glossariumteksten zijn spelregels, geen seizoensdata. Een test bewaakt dat er geen
jaartallen, ploegnamen of uitslagwoorden in sluipen.

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

Elke wedstrijd is een kaart in een grid van twee kolommen. Uit- en thuisploeg staan
gestapeld met de `@` in de goot; dat is niet cosmetisch maar de oplossing voor de
mobiele wrap, waar één regel uiteenviel in drie en de `@` verweesd achterbleef.

Klikken op het teamblok opent **waarom deze wedstrijd in je pakket zit**. Bewust die
formulering en niet "waarom dit een mooie wedstrijd is": dat laatste is een oordeel
over een gespeelde wedstrijd, en dus uitkomstinformatie. De uitleg komt volledig uit
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

## Nog te doen

- Tiers: alles staat op `neutral` behalve KC/DET/SF; watchlist en avoid nog leeg
- Vercel-deploy: negen van de tien deployments blijven hangen, ook prebuilt zonder
  buildstap. Project verwijderen en opnieuw importeren is de volgende stap.
- F4: uitleglaag, glossarium, playoff-bracket
- Remote: github.com/fremnlai-coder/nfl-watchdog (privé)
- Let op bij F3: GitHub Pages op een privérepo vereist een betaald plan. Kies bij
  het hosten tussen de repo publiek maken of Vercel free tier.
