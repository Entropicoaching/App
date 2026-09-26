Ordre 409

# Rapport 409: Træningsbiblioteket og Lær skak set af en elev

**Klar til klassen: nej, fordi** "Stop matten" godtager, og peger med
hint-pilen på, træk der giver dronningen eller et tårn væk (B1), og Lær skak
har to ulovlige stillinger hvor kongen kan slås og appen siger "Rigtigt!" (B2).
Begge er små at rette. Resten holder: 54 tilfældige øvelser er lovlige,
entydige og har rigtigt tema, og som 10-årig var det til at finde ud af.
Dronningemat, tårnmat og gaffel sad efter 7-9 øvelser. Tårn mod konge
("3 vundne i træk" inden for 35) er for svært som "sidder"-krav (B3).

Har arbejdet betydning for Hara (planet school, sporet "skakbrættet frit bræt
og opgaver til undervisningen"): **ja.** Det stopper at Marc giver eleverne en
kompetence, der lærer dem at ofre dronningen, og en første brik-lektion hvor
kongen bliver slået. Det giver Chaturanga en kort, konkret liste før klassen.

## Gren

`kritik-409` fra `main` @ `2598633`. Filer kun under `docs/kritik-409/` og
`outputs/kritik-409/` + én linje i `package.json` (`verify:kritik-409`, som 399/403).

- `455c7fe` blok 1: eleven (Marcs tur, tre kompetencer til stjerner, Lær skak til rokaden)
- `bf0c2cc` blok 2: skakken. **Den ligger på `main`, ikke på `kritik-409`**, se
  "Ærlige grænser": mens jeg arbejdede, blev `main` tjekket ud i denne worktree
  og `dagens-pas-offline-3` (406) merget (`c6d2c76`), så min commit landede
  oven på den. Min flytning til `kritik-409` blev afvist af Claude Codes
  sikkerhedsregel for git.
- blok 3 (KRITIK, verify, denne rapport): **ikke committet**, ligger i
  arbejdstræet af samme grund.

## Hvad ændret

Intet i skak. Skak `main` e56842f (400 merget) er kun læst via `git archive`
til en kopi i scratchpad (med en junction til skaks `node_modules`).

- **Blok 1** (`docs/kritik-409/ELEVEN.md`, `outputs/kritik-409/elev-409.mjs`,
  `kasse.mjs`, `elev-409.json`, 40 skærmbilleder `E-*.png`): Marcs fem-minutters
  tur fra RAPPORT-400, derefter frit som 10-årig: Gaffel med springeren (fejl
  med vilje), Tårnmat ("Vis et hint"), Tårn mod konge som en elev der kan
  "kassen" (6 partier). Lær skak fra "Jeg er ny" til rokaden, med forkerte
  træk i hvert trin der kunne.
- **Blok 2** (`docs/kritik-409/SKAKKEN.md`, `skak-409.mjs`, `skak-409.json`,
  `stopmatten-409.mjs`, `stopmatten-409.json`, `stopmatten-dybde4.txt`,
  `S-*.png`): 3 tilfældige øvelser pr. kompetence (fast frø) på dybde 4
  (generatoren brugte 3) + den fuldstændige tremandsløser; hele banken for
  mattræk, patt-fælder og rokade-grunde; "Stop matten" i browseren; rækkefølgen;
  tårnmat i 35.
- **Blok 3** (`docs/kritik-409/KRITIK-bibliotek.md`, `outputs/kritik-409/verify-kritik-409.mjs`,
  `package.json`): fund B1-B10 øverst, dom, verify.

## Testresultat

- `npm run verify:kritik-409`: **rød i det nuværende arbejdstræ (6 fejl), og kun
  af én grund**: arbejdstræet står på `main`, og blok 1's filer (`ELEVEN.md`,
  `elev-409.json`, `E-*.png`) ligger på `kritik-409` (455c7fe). Alle blok 2- og
  blok 3-tjek er grønne: B2's ulovlige stillinger regnes efter med egen
  stråle-regner, 54/54 stikprøver lovlige, S1-tallene for sm03/sm07/sm08, KRITIK
  har B1-B10 og dommen, rapporten har de fem afsnit. Når de tre blokke står på
  samme gren, forventer jeg grøn (ikke kørt i den tilstand).
- `npm run lint`: grøn.
- Blok 1-kørslen: ingen sidefejl. Blok 2: 54 af 54 stikprøver lovlige, facit
  spilbart, entydigt, tema ok; dybde 4 tog ca. 45 min (binding 0QzKs alene 6 min).

## Hvad er næste

**Til Chaturanga (ordre i punktform, i skak på egen gren, ingen push):**
- B1: "Stop matten": godtag kun svar der stopper mat i 1 OG ikke taber mere end
  det bedste svar (`sikreTraek`-logikken fra "Red din brik", dybde ≥ 4); sortér
  `godeFoerste` så pilen viser det bedste; test: intet godtaget svar i
  `stop-matten` taber ≥ 2 mod det bedste. sm02, sm03, sm07, sm08 er de kendte.
- B2: Lær skak trin 3 (`7k/8/8/8/3Q4/8/8/4K3`) og trin 23
  (`k7/8/8/8/8/8/1P6/R3K3`): flyt den sorte konge ud af skak; ny test over ALLE
  `LAER_TRIN`-FEN'er (fen, demoFen, spilFen): siden der ikke er i træk står
  ikke i skak.
- B3: Tårn mod konge: grænse 50, "3 af de sidste 4" i stedet for "3 i træk",
  og 3-4 ét-træks "gør kassen mindre"-øvelser før partiet.
- B4: Oppositionen: hint2 "Gå til siden, så du igen står over for ham";
  erstat de gentagne (op03, op05, op04, op08) med nye fra løseren; spil linjen
  til forvandling som afslutning.
- B5: "Vis et hint" i to trin: tekst + ring om brikken, så pilen.
- B6: "Næste for dig" øverst i oversigten efter stien i
  `docs/kritik-409/SKAKKEN.md`; flyt "Red din brik" lige efter "Slå den ubeskyttede".
- B7: Lær skak: "Du er hvid/sort" fra trinnets FEN, ikke fra hvem der er i træk.
- B8-B10: tre rokade-øvelser uden valg skiftes ud; patt-hint i dronningemat;
  hvad gaflen/bindingen ramte i "Rigtigt!"-linjen.
- Kør `node outputs/kritik-409/elev-409.mjs <skak>` og
  `node outputs/kritik-409/stopmatten-409.mjs <skak>` (fra entropi-app) igen
  efter rettelsen; `verify:kritik-409` bliver rød når B1/B2 er rettet, og skal så opdateres.

**For Marc:** giv ikke eleverne "Stop matten" før B1 er rettet; resten af
biblioteket kan bruges nu, bedst med Mat i 1 → Dronningemat → Tårnmat →
Slå den ubeskyttede → Red din brik som første time.

**Git (for Dhruva/Marc):** `bf0c2cc` (blok 2) skal over på `kritik-409`, og
`main` tilbage til `c6d2c76`; blok 3-filerne skal committes på `kritik-409`.

## Ærlige grænser

- **Grenen er ikke ren.** Blok 2-commitet ligger på `main` (se Gren), blok 3
  er ikke committet. Jeg flyttede ikke `main`, fordi git-handlingen blev afvist;
  det skal gøres af en med lov.
- Ingen Stockfish: "motoren" er en materiale-søgning på dybde 4 + rolig-søgning.
  Den kan tage fejl i stillinger hvor positionel kompensation eller et dybere
  mattema afgør; tabstallene i B1 er dog store (dronning, tårn) og tjekket med hånden for sm03 og sm07.
- 3 stikprøver pr. kompetence er en stikprøve; mat-i-1-typerne, rokade og
  oppositionen er tjekket i hele banken, "Stop matten" alle 8.
- "Kasse-eleven" er min model af en 10-årig (grådig, ét svar frem). En rigtig
  elev kan være både bedre og meget dårligere; tallene viser at grænsen kan
  slås af en der gør "det rigtige", ikke hvor mange der klarer det.
- Blok 1 er én gennemgang af mig som elev, ikke en rigtig 10-årig. Ingen elevdata.
- Lær skak er kun gennemgået til rokaden (trin 12); trin 23 er fundet maskinelt.
