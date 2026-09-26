Ordre 421

Skakbiblioteket efter 410 og 415: er det nu klar til klassen? (Bhishak)

## Gren

`kritik-421` fra entropi-app `main` @ 30d71dd (kritik-416 merget). Ingen push, ingen merge.

- blok 1: verify:kritik-421, elev-421 med stjerne-trin, stopmatten-421 og bank-421 (commit `8e4311b`)
- blok 2: Marcs første time som elev, KRITIK-bibliotek-2 og denne rapport (seneste commit på grenen)

Skak `main` @ 8aa76ba er kun læst via `git archive` til en kopi i scratch. Intet er rettet i skak.

## Hvad ændret

Kun filer under `docs/kritik-421/` og `outputs/kritik-421/`, plus én linje i `package.json` (`verify:kritik-421`, ved siden af de andre verify-scripts).

- **`verify:kritik-421`** (afløser for `verify:kritik-409` som bevis på main). Den tjekker, at B1 og B2 ikke kan genskabes:
  - B1: de fire dyre svar fra 409 afvises i browseren, og pilen kommer først ved andet hint-tryk.
  - B1: i hele Stop matten-banken (dybde 4) godtages intet svar, der taber 2+ mod det bedste, og pilen viser altid et af de bedste.
  - B2: alle 33 Lær skak-stillinger regnes efter med en egen angrebs-regner for alle brikker. Den fanger stadig de to 409-stillinger, så det er et kontroltjek og ikke kun en grøn lampe.
  - Blok 2: timen, B9 og dokumenterne.
  - Modprøve i scratch: sm07 Dg4+ lagt tilbage i `godeFoerste` og trin 23 med kongen på a8 giver ROED (4 fejl).
- **`elev-421.mjs`:** `elev-409.mjs` med Lær skak-delen skrevet om til stjerne-trinnene: omvej og "Prøv igen" hos kongen, ulovligt træk hos dronning og løber. Eleven fortsætter til trin 23 (tårne på åbne linjer); de tre mønstre springes over, fordi de vælges ved runtime. Biblioteksdelen er uændret.
- **`stopmatten-421.mjs`:** `stopmatten-409.mjs` kopieret, så den skriver i kritik-421 og ikke overskriver 409's bevis. Den tester alle fire dyre svar og begge trin i hint-trappen.
- **`bank-421.mjs`:** B1-B10 regnet i skak-koden uden browser (dybde-4-søgning 39 min).
- **`time-421.mjs`:** blok 2, Marcs første time + patt i Dronningemat.
- **`docs/kritik-421/KRITIK-bibliotek-2.md`:** dommen, fund N1-N5 øverst og B1-B10-status med bevis.

## Testresultat

- `npm run verify:kritik-421`: **GROEN** ("B1 og B2 kan ikke genskabes (8 Stop matten-oevelser paa dybde 4, 33 Laer skak-stillinger, 4 dyre svar afvist i browseren), blok 2-dokumenterne i orden").
- B1-B10: **9 lukket, B10 delvist** (03CF0 f3 og knapperne under brættet, som 415 selv skrev). Se tabellen i KRITIK-bibliotek-2.
- Browserkørsler mod skak main: `stopmatten-421`, `elev-421` og `time-421` (x2), 0 sidefejl.
- `verify:kritik-409` er **ikke** rød, som RAPPORT-415 forventede. Den læser kun de frosne 409-målinger og er stadig grøn. Den er ladet stå som historik; det er `verify:kritik-421`, der siger noget om main.
- `npm run lint`: ikke kørt meningsfuldt. Lint dækker kun `*.{js,jsx}`, mine filer er `.mjs`, og worktree'et har ingen `node_modules` (`npx eslint` fejler på `@eslint/js`).

## Hvad er næste

klar til klassen: ja. Til Marc: Giv eleverne "Stop matten" og brug biblioteket efter planen i skak RAPPORT-415 (projektor Mat i 1 → Næste for dig-kortet → Stop matten sm07 fælles); forbuddet er ophævet.

(Små forbedringer til Chaturanga, når der er tid, ikke blokerende: N1 "Næste for dig"-knap efter "Det sidder!", N2 kortere tip i Stop matten på 390 px, N3, N5.)

## Ærlige grænser

- Ordren er stilet til Bhishak, mens `CLAUDE.local.md` i dette træ kalder sessionen Vaidya. Marc bad direkte om at udføre ordren, og ordren peger på dette træ som hjem, så den er udført som Bhishak.
- "Materiale" er stadig dybde 4 + rolig-søgning, ikke Stockfish (som i 409). Tallene er de samme som i 409.
- Timen er en scriptet elev: fejl og hint er placeret med vilje, og løsningerne er facit. Den viser, at vejen virker og hvor lang den er, ikke hvor svært en rigtig 10-årig synes, det er.
- Lær skak-mønstrene (trin 16-18) er sprunget over i kørslen, og åbninger, slutspil og miniparti (trin 24-32) er ikke kørt i denne ordre.
- B8 er kun tjekket statisk (fri vej og præcis én lovlig rokade). Rokade-øvelserne er ikke spillet i browseren.
- Tabellen "Hvad der holder" i 409 (54 stikprøver) er ikke kørt igen. Kun det, B1-B10 rører, er målt.
- Ingen elevdata, intet netværk, ingen push.
