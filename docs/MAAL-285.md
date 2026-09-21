# Måling — ordre 285 blok 1: listen under vægt (30 atleter)

Afvigelseslisten fra 281 (`Dashboard.jsx`, `src/dashboard/afvigelse.js`), seedet med
30 atleter i mocken (10 skredet, 10 på sporet, 10 ingen plan — samme tre
tilstande som 281's egen e2e-prøve, i skala) — målt mod den ægte, ubyggede
app (`vite`-dev-server via `e2e/harness.mjs`, samme konvention som 281's
egen `e2e/coach-afvigelse.spec.mjs` bruger). Telefon-profil (390×844,
4× CPU-nedsat — samme tal som `scripts/maal-coach-telefon.mjs`s
`THROTTLE.cpuRate`). Headless CDP hele vejen, ingen OS-mus.

Script: `scripts/maal-mandagsrunden.mjs` (`node scripts/maal-mandagsrunden.mjs`).

## Fundet

Coachens atletliste (`Dashboard.jsx`) regnede `currentWeekNo(...)` (sortér +
dato-matematik, se `src/dashboardShared.js`) og `athleteWeeks.find(...)` TO
GANGE pr. atlet pr. render: én gang i `athletesWithAfvigelse` (til
sorteringen/afvigelseslinjen), og igen i selve rækkevisningens
`programLine`-beregning — ægte dobbeltarbejde, ikke kun i teorien.

## Rettet (uden datamodel-ændring)

`current`/`currentNo` regnes nu kun ÉN gang pr. atlet (i
`athletesWithAfvigelse`), gemt i en ny `currentWeekByAthleteId`-opslagstabel
og genbrugt i rækkevisningen. Skjulte atleter (sjældne, kun vist efter "Vis
skjulte") falder tilbage til den gamle beregning, da de ikke indgår i
sorterings-forbiberegningen. Ingen ændring af `src/dashboard/afvigelse.js`
eller datamodellen.

## Tabel (før/efter, 30 atleter)

| Måling | Før (HEAD, `e62605a`) | Efter (denne gren) |
| --- | --- | --- |
| Første visning (login → liste synlig) | 869ms | 856–871ms |
| API-kald til mocken (`/rest`+`/auth/v1`) | 42 | 42 |
| Sortering "Afvigelse denne uge" (klik → sorteret DOM) | 110ms | 110–113ms |
| Scroll: droppede frames (>16,7ms) af 73 | 18 | 31–32 |
| Scroll: længste frame-gab | 17ms | 17ms |
| Ruller uden at hakke? | ja | ja |

**Ingen målbar forskel før/efter ved 30 atleter.** Dobbeltarbejdet var reelt
(bevist ved kildelæsning: samme funktion, samme input, kaldt to gange), men
er for billigt i absolutte termer (titusinder af simple sammenligninger, ikke
tusinder af tunge kald) til at slå igennem mod støjen fra netværk og
browser-paint ved denne skala. Rettelsen er stadig beholdt — den fjerner ægte
duplikeret logik og gør "current uge pr. atlet" til ét sted at slå op, samme
princip som `afvigelseByAthleteId`s egen kommentar allerede satte for
afvigelsen selv — men den er en renlighedsrettelse, ikke en
hastighedsrettelse ved denne skala.

## Hvad er den faktiske flaskehals

869ms til første visning er domineret af to ting, ingen af dem løses uden en
større, arkitektonisk ændring (uden for denne ordres "mindst mulige ting"):

1. **42 API-kald til mocken** — konstant, IKKE stigende med atletantal
   (bevist empirisk: samme 42 kald ved 3 atleter som ved 30, se
   `outputs/_seneste/maal-mandagsrunden/n3-check.json` — ingen ny
   per-atlet-rundtur er indført, alle 277/281's forespørgsler er batch-kald
   med `.in('athlete_id', athleteIds)`). 42 er summen af Dashboardets egne
   uafhængige feature-forespørgsler (atleter, kalenderuger, gennemførelse,
   ulæste beskeder, videoer, ugesammendrag, coach-prioritet, m.fl.) — hver
   nødvendig, ikke en fejl, men heller ikke reducerbar uden at lægge flere
   af dem sammen til færre rundture (en større ændring).
2. **89 samlede netværkskald** — resten (47) er `vite`-devs egne ubundlede
   ES-moduler, et udviklings-artefakt (samme app bundles til langt færre
   filer i produktion, se `docs/KAEDEN-281.md`s bundtmåling) — IKKE
   repræsentativt for hvad Marc oplever i produktion.

## Ruller den uden at hakke?

Ja. Længste enkelt-frame-gab er 17ms, under 50ms-grænsen for mærkbar
hakken, ved 30 atleter og 4× CPU-nedsættelse. Det højere "droppede
frames"-tal efter fixet (31–32 mod 18 før) er støj fra præcis-16,7ms-grænsen
(kun 0,1–0,3ms over budgettet, ikke reelle hak) — bekræftet af at det
længste gab er identisk (17ms) begge veje.

## Ærligt

- Målt i `vite`-dev-mode (samme konvention som 281's egen e2e-prøve for
  denne feature), ikke mod en produktions-bygning — `docs/KAEDEN-281.md`
  dækker bundtvægten separat.
- Ingen ægte Supabase, ingen ægte netværksvej (localhost), ingen ægte
  atletdata.
- `n3-check.json`s 3-atlet-sammenligning er et engangs-tjek af at kaldtallet
  ikke skalerer med N, ikke en fuld måling i sig selv (scroll-tallene derfra
  er ikke sammenlignelige — for lidt indhold til at rulle meningsfuldt, og
  indgår ikke i tabellen ovenfor).
