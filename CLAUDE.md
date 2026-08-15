# NFL Watchdog — v1

Spoilervrije NFL-kijkgids. Eén gebruiker, geen server, geen database.
Fase 1 t/m 3 opgeleverd: ingest, datamodel, publiek/privé-scheiding, watchability-score,
planner, CLI-weekoverzicht, teasers met spoiler-linter, en de statische web-UI.

## Draaien

```bash
npm run ingest -- --season 2025 --weeks 1-18   # backfill, ~14s met lege cache
node src/cli.js --week 14                       # weekoverzicht
node src/cli.js --week 14 --full 2 --in40 3      # weekvorm overschrijven
node src/cli.js --week 14 --no-rating           # plan op inzet vooraf i.p.v. verloop
node src/cli.js --week 14 --hints               # level 2
node src/cli.js --week 14 --result <game_id>    # level 3
npm test                                        # 60 tests

npm run dev                                     # web-UI op localhost:5173
npm run build                                   # statische build naar dist/
npm run verify                                  # build + alle tests, inclusief dist-scan
```

## Architectuur

```
src/espn.js      gecachte fetches; alles in data/cache/, runs zijn offline herhaalbaar
src/metrics.js   win-prob-metrics; leest nooit de score
src/score.js     percentielen over het seizoen -> 1-5, plus stakes_pre (level 0)
src/planner.js   budgetverdeling, degradatieladder, pakket A/B
src/schema.js    DE SPOILERGRENS — allowlist van publieke velden
src/linter.js    deterministische spoiler-linter; geen model, geen randomness
src/teasers.js   templates uit level 0/1; gelint voor publicatie, anders fallback
src/time.js      Intl met named zones, nooit een vaste offset
src/ingest.js    orchestratie, schrijft public/ en private/
src/cli.js       weekoverzicht; planner draait op weergavemoment, niet bij ingest

web/src/App.jsx        secties, weekkiezer, weekvorm-stepper
web/src/lib/data.js    ALLE netwerkcalls; de spoilergrens in één bestand
web/src/components/    GameRow (met de twee onthulstappen), Controls, PackageSummary
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

## Nog te doen

- Tiers: alles staat op `neutral` behalve KC/DET/SF; watchlist en avoid nog leeg
- F4: uitleglaag, glossarium, playoff-bracket
- Seizoen 2026 opent 9 september 2026; zet `season` op 2026 in de config
- Remote: github.com/fremnlai-coder/nfl-watchdog (privé)
- Let op bij F3: GitHub Pages op een privérepo vereist een betaald plan. Kies bij
  het hosten tussen de repo publiek maken of Vercel free tier.
