# NFL Watchdog — v1

Spoilervrije NFL-kijkgids. Eén gebruiker, geen server, geen database.
Fase 1 opgeleverd: ingest, datamodel, publiek/privé-scheiding, watchability-score,
budgetplanner en CLI-weekoverzicht.

## Draaien

```bash
npm run ingest -- --season 2025 --weeks 1-18   # backfill, ~14s met lege cache
node src/cli.js --week 14                       # weekoverzicht
node src/cli.js --week 14 --budget 300 --own-format game_in_40
node src/cli.js --week 14 --no-rating           # plan op inzet vooraf i.p.v. verloop
node src/cli.js --week 14 --hints               # level 2
node src/cli.js --week 14 --result <game_id>    # level 3
npm test                                        # 32 tests
```

## Architectuur

```
src/espn.js      gecachte fetches; alles in data/cache/, runs zijn offline herhaalbaar
src/metrics.js   win-prob-metrics; leest nooit de score
src/score.js     percentielen over het seizoen -> 1-5, plus stakes_pre (level 0)
src/planner.js   budgetverdeling, degradatieladder, pakket A/B
src/schema.js    DE SPOILERGRENS — allowlist van publieke velden
src/time.js      Intl met named zones, nooit een vaste offset
src/ingest.js    orchestratie, schrijft public/ en private/
src/cli.js       weekoverzicht; planner draait op weergavemoment, niet bij ingest
```

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

Wie ook die vormindicatie niet wil: `--no-rating`, of `show_watchability: false`.
De planner schakelt dan naar `planning_basis: "pre_game_only"` en rangschikt op
`stakes_pre`, dat puur uit de records vóór de week volgt en niets lekt.

## Bekende eigenschap: eigen teams vullen het budget

In 14 van de 18 weken spelen KC, DET en SF alle drie. Op `full` is dat 555 minuten.
Met `own_team_default_format: "full"` en een budget van 240 komt de rest van de week
daarom nooit aan bod. Zet 'm op `game_in_40` (120 minuten voor drie teams) als je
wil dat de planner echt iets te verdelen heeft.

## Nog te doen

- F2: teasers + deterministische spoiler-linter + minimaal 20 lektests
- F3: statische web-UI, spoilerniveaus achter kliks
- F4: uitleglaag, glossarium, playoff-bracket
- Seizoen 2026 opent 9 september 2026; zet `season` op 2026 in de config
- Geen git remote. Repo hoort onder github.com/fremnlai-coder
