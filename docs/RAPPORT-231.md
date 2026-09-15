# Rapport — ordre 231: Supabase-kaldene i kø, atletlisten venter på sig selv

## Gren

Gren `kald-parallelt`, forgrenet fra `main` (`ea8618e`, ordrens egen base —
228 og Bhishaks 225 er merget; live er stadig `162abc6`, Marc pusher).

- `06fee6e` — commit 1: kæden tegnet, nyt instrumenteringsscript, ingen
  adfærdsændring
- `e3aed42` — commit 2: fetchReadiness's tre parathedsopslag parallelt
- `37c20fc` — commit 3: næste sten efter commit 2, med tal
- (denne rapport er commit 4, se hash i `git log` efter commit)

Arbejdstræet er rent efter hver commit. Ingen push. Ingen skrivning mod
produktions-Supabase (kun de læsninger appen selv gør, mod mock). Ingen
atletdata. `AthleteView.jsx`s eneste ændring i denne ordre er
`fetchReadiness` — Bhishaks samtidige arbejde i `entropi-app-wt2` (232) er
ikke rørt.

## Hvad ændret

228's commit 3 fandt et bifund: Supabase-kaldene på Atletliste er overvejende
serialiserede og strækker sig til 6794ms, senere end det rapporterede
TTI-tal. Denne ordre undersøgte det, i rækkefølge. Commit 1 byggede
`scripts/kaeden-tegn.mjs` — et nyt, committet instrumenteringsscript (npm
run kaeden:tegn) der lytter på request/response-events mens samme
mock/build/login-infrastruktur som `maal-kaeden.mjs` kører; ingen ændring af
appens kode. Output: `docs/KAEDEN-231.md`, en tabel pr. skærm (Atletliste
for coach; Dagens pas + Check-in for atlet — samme URL/mount, ét fælles
spor) med kald, start-ms, varighed og hvad hvert kald ventede på (overlap =
parallelt; nul-ms gab efter et forudgående kald = ægte serialisering).
Fundet var skarpere end 228's ord antydede: coach-siden (Atletliste) er
allerede velparallelliseret — `fetchAthletes`s tre følgekald
(`fetchProfilesLastSeen`/`fetchAthleteWeekSummaries`/
`fetchAthleteActivityLogs`) og `refreshCoachInbox`s
`Promise.allSettled`-kald overlapper reelt i sporet. Den ENE klare,
kodebaserede serialisering lå i stedet i `AthleteView.jsx`s
`fetchReadiness` (parathedswidgetten, "Check-in"): tre uafhængige
`readiness_logs`-opslag (i dag / forrige / 14-dages-historik) kørt bagom
hinanden med `await`, 0-1ms gab mellem dem i sporet — en ren kode-kæde,
ikke netværksstøj, og ingen af de tre afhænger af en andens data.

Commit 2 rettede netop det: de tre `runGuardedRead`-kald samlet i ét
`Promise.all`, hver med sin egen fejlmelding (`onReadError`) og sin egen
state-opdatering (`setReadinessLog`/`setLastReadiness`/
`setReadinessHistory`), kun ved bekræftet succes — samme garanti som G1
(ordre 76) gav, blot i parallel form i stedet for i serie.
`scripts/verify-athlete-read-failures.mjs` (som statisk kontrollerer netop
den garanti) blev opdateret til det nye mønster, med en ny assertion der
kræver at `Promise.all` rent faktisk bruges — så en fremtidig ordre ikke
utilsigtet serialiserer igen. Målt med `npm run maal:kaeden` (5 løb,
devtools-throttling), før/efter samme build: Atletliste urørt (5673→5653ms,
støj), Dagens pas 6168→6207ms (+39ms, støj), Check-in 6166→6233ms (+67ms,
støj) — ingen synlig TTI-ændring. Ærligt: `kaeden-tegn.mjs`s eget spor viste
at readiness-kaldene allerede sluttede ~1000ms ind i sidens liv, længe før
TTI (som domineres af script-vægt, jf. 228) — rettelsen fjerner to
tur-retur-tiders unødvendig ventetid for selve parathedswidgetten, men den
ventetid lå aldrig på TTI's kritiske vej, så sideniveau-metrikken viser den
ikke.

Commit 3 tog et nyt ad hoc-vandfald (samme metode som 226/228, ikke
committet som kode) efter commit 2, dokumenteret i `docs/VALG-231.md`.
Atletliste: TTI 5133ms, TBT 0ms, scripts færdige 4811ms (94% af TTI).
Dagens pas: TTI 6305ms, TBT 206ms, scripts færdige 4794ms (76%). **Den ene
største post, navngivet med tal: script-overførslen selv, uændret af denne
ordre — index.js (351kB rå/101,57kB gzip) efterfulgt I SERIE af skærmens
egen uspaltede chunk (Dashboard 242kB eller AthleteView 245kB, der først
starter når index.js's modulgraf er eksekveret og det lazy import kan
opløses), tilsammen 76-94% af TTI.** Samme mønster som 228 (dengang
76-83%) — denne ordre rørte kun kaldrækkefølge, ikke bundtstørrelser, så
det er forventeligt uændret. Bifund: det sidste Supabase-kald slutter
stadig efter TTI på begge skærme (7004ms/7892ms) — samme retning som 228's
bifund, ikke en regression fra commit 2 (disse er lavprioritets
baggrundslæsninger, aldrig på TTI's kritiske vej). AthleteView.jsx's
manglende interne faneopsplitning (228's "Hvad er næste" punkt 1) er
fortsat den konkrete, unavngivne kandidat for et næste, større greb — uden
for denne ordres omfang. Intet greb forsøgt mod nogen af delene, jf. commit
3's egen grænse.

## Testresultat

`npm run lint`: rent ved alle commits.

Enhedstest (`node --test "src/**/*.test.js"`): 231/231 grønne, kørt efter
commit 2.

Alle 34 `verify:*`-scripts: grønne, kørt efter commit 2 (én,
`verify:athlete-read-failures`, krævede en opdatering af sit statiske
mønster-tjek til det nye Promise.all-baserede kodemønster — samme invariant,
ny form; se "Hvad ændret").

`npm run e2e`: grøn (26,2s), kørt efter commit 2.

`npm run build`: grøn ved alle kodecommits, bundtstørrelser uændret af
denne ordre (se commit 3).

`npm run kaeden:tegn` (commit 1) og `npm run maal:kaeden` (commit 2, labels
`231-commit2-foer`/`231-commit2-efter`): kørt, tallene står under "Hvad
ændret" og i `docs/KAEDEN-231.md`/`docs/VALG-231.md`.

## Hvad er næste

1. AthleteView.jsx (6598 linjer, ingen intern faneopsplitning, i
   modsætning til Dashboard.jsx's tre LazyBoundary-faner) er fortsat den
   tydeligste kandidat for at reducere script-vægten på Dagens pas/Check-in
   — samme punkt 228 pegede på, stadig uden for denne ordres omfang, og
   stadig den reelt største hævstang for TTI (76-94% af tiden er
   script-transport, ikke Supabase).
2. index.js (351kB rå/101,57kB gzip, hovedbundtet) og skærmchunken
   hentes i SERIE, ikke parallelt — screen-chunken venter på at
   index.js's modulgraf er kørt færdig. En eventuel forudindlæsning
   (`<link rel="modulepreload">` for den gættede rolles chunk, byggende
   videre på 201's rollehukommelse) er et muligt, ikke-forsøgt greb for en
   fremtidig ordre.
3. Supabase-kaldenes serialisering var, målt konkret, kun ét sted i koden
   (fetchReadiness) — coach-siden var allerede velparallelliseret. En
   fremtidig ordre bør ikke antage flere skjulte serialiseringer uden ny
   instrumentering (`npm run kaeden:tegn` er nu tilgængelig til det).

Tre linjer til Marc: Parathedswidgetten (Check-in) på en atlets forside
sparer nu to tur-retur-tider til databasen — koden ventede unødigt på sig
selv tre gange i træk, retter nu alle tre samtidigt. Det flytter ikke
det målte, samlede sidetal (`maal:kaeden` viser 0-67ms forskel, inden for
støj), fordi den ventetid aldrig var det, der holdt siden fra at være klar —
scriptvægten er det stadig, samme fund som 228, uændret af denne ordre.
Næste reelle skridt for at mærke noget hedder stadig "AthleteView.jsx
mangler Dashboard.jsx's faneopsplitning" — en større, egen ordre.

## Ærlige grænser

- Commit 2's rettelse er en ægte, verificeret kodefejl-fix (bekræftet af
  commit 1's egen instrumentering: 0-1ms gab, en ren await-kæde), men dens
  målte effekt på sideniveau-TTI er IKKE synlig (alle forskelle inden for
  0-67ms støj mellem identiske builds). Det er ikke en fejlslagen måling —
  det er et ærligt fund om at readiness-kaldene aldrig lå på TTI's kritiske
  vej. Den reelle gevinst (to sparede tur-retur-tider for selve
  parathedswidgetten) er ikke fanget af `maal:kaeden`s sideniveau-metrik og
  er derfor ikke tallfæstet i denne rapport ud over commit 1's spor.
- `kaeden-tegn.mjs` (commit 1) måler mod en lokal mock uden throttling —
  formålet er kædens FORM og afhængigheder (hvad venter på hvad), ikke
  absolutte ms. Alle absolutte tal i denne rapport, der SKAL sammenlignes
  på tværs af ordrer, kommer fra `maal:kaeden`/det ad hoc-vandfald (samme
  metode som 226/228), ikke fra `kaeden-tegn.mjs`.
- Commit 3's vandfald er ét løb pr. skærm (ikke median af 5 som
  `maal:kaeden`), samme metode og samme grænse som 226/228's tilsvarende
  fund — retningen er pålidelig, det præcise enkelttal kan variere nogle
  hundrede ms mellem kørsler.
- Denne ordre bekræftede at coach-sidens Supabase-kald allerede er
  velparallelliserede — det modsiger ikke 228's bifund (som kun sagde
  "strækker sig til 6794ms", ikke "er serialiserede uden grund"), men det
  betyder at der IKKE var en stor, skjult gevinst at hente der; kun ét,
  mindre, konkret sted (fetchReadiness) havde den fejl denne ordre ledte
  efter.
- Har betydning for Hara (mærkbart bedre-sporet): denne ordre lukkede en
  navngiven, konkret fejlklasse (unødvendig kode-serialisering af
  uafhængige Supabase-kald) med en verificeret, testet rettelse — men fandt
  samtidig at klassen var MINDRE udbredt end 228's bifund kunne tolkes som,
  og at den ikke flytter det tal Hara faktisk måler appen på (TTI). Værd
  for Hara at vide: den fortsatte, største hævstang for "appen mærkbart
  bedre" er stadig script-vægten (AthleteView.jsx's manglende
  faneopsplitning), ikke Supabase-kaldrækkefølgen — samme retning 228
  allerede pegede Hara imod, nu bekræftet fra en anden vinkel.
