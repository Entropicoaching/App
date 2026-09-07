# ORDRE 82 — realtid der også er rigtig

Spor (Harā): `spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a`, planet Entropi
Coaching. Ingen delmål-linje (ordren beder eksplicit om det: delmålet lukkes
af atleterne, ikke af en høst).

## Gren

`realtid-der-holder`, fra `main` `4ad2420` (ordre 73, 80 og 76 merget).

Commits:
- `0c02c60` — commit 1: `verify:videocoach-clip` udvidet til rigtige telefonklip
- `6ea79f6` — commit 2: mindre hop i "Vis mig nu", uden at røre tidsbudgettet
- `c0cd087` — commit 3: diskret diag-linje for Marc (`?diag=1`)
- (denne rapport, separat commit)

Rent træ. De utrackede `drafts-*`-mapper og
`docs/videocoach/ENT0092-AUDIT-EE6D8A8.md` er urørt. `test-clips\` er tom —
se "Ærlige grænser".

## Hvad ændret

**Commit 1 — en rigtig bænk, klar til Marcs klip.** Marc havde ikke lagt sin
telefonoptagelse i `test-clips\` da jeg startede — mappen fandtes ikke engang.
I stedet for at stoppe har jeg bygget bænken færdig mod det tegnede klip og
tilføjet `test-clips/` til `.gitignore` (kommentar: atletdata/persondata, aldrig
i repoet).

`scripts/verify-videocoach-clip.mjs` kører nu i to tilstande:
- **Rigtigt klip** (`test-clips\<navn>.mp4` + påkrævet sidecar
  `<navn>.meta.json` med `barPoint` og `windows` — format og begrundelse i en
  kommentar øverst i scriptet). Facit for "Vis mig nu" er her **den fulde
  analyses egen sporede bane**, sådan som ordren beder om — der findes ingen
  uafhængig sandhed for en rigtig optagelse. En sidecar er nødvendig, ikke
  valgfri: et headless script kan ikke "se" hvor skiven er på en rigtig video
  uden at gætte, og et forkert gæt ville give tal der ser rigtige ud uden at
  være det — præcis den fælde ordren selv peger på (det tegnede klips "1,03x
  og pænere bane" var falsk tryghed).
- **Intet rigtigt klip** (situationen nu): falder ærligt tilbage til det
  tegnede klip og siger det tydeligt i output og i denne rapport, i stedet for
  at stoppe.

Målt PR. VINDUE (ikke kun aggregeret, som før ordre 82): frames sporet, frames
sprunget over, ms/frame, tid mod afspillet varighed, afvigelse (mean/max px)
og antal "hop". Et hop er defineret som en frame-til-frame-**hastighed**
(px/s, ikke rå px — vinduer har forskellig varighed) hurtigere end skiven
nogensinde beviseligt bevæger sig i netop dette klip: 95-percentilen af
facits egen frame-til-frame-hastighed × 2,5 (margin til ægte eksplosive
faser), med et gulv på 200px/s. Selvkalibrerende pr. klip, ingen fast grænse
der kan være rigtig for ét klip og forkert for et andet.

**Commit 2 — mindre hop, samme tid.** To af ordrens fire forslag afprøvet mod
bænken, begge i `vcRealtimeTrackWindow` (uden for `startMultipointTracking` —
den fulde analyse er urørt):

- **(a) Gæld-baseret frame-skip.** Før: én langsom frame satte ubetinget
  NÆSTE frame til at blive sprunget over — et gæt om at netop den ene også
  ville have været langsom. Nu: et løbende gældsregnskab (`workDebtMs`) —
  kun når den akkumulerede forsinkelse reelt overstiger et helt budget-slot,
  betales den af ved at springe én frame over. En isoleret langsom frame (fx
  en GC-pause) indhentes i stedet af de følgende, hurtigere frames uden at
  skabe et unødvendigt hul.
- **(b) One-euro-filter i stedet for kun rå lineær interpolation.** Huller
  udfyldes stadig lineært (samme som før — nødvendigt for overhovedet at have
  et tal), men banen glattes bagefter tidsligt med et one-euro-filter
  (Casiez/Roussel/Vogel 2012): cutoff'en stiger med den estimerede hastighed,
  så en ægte hurtig fase ikke slæbes efter, mens interpolationens
  hastigheds-spring ved hul-kanterne dæmpes. Kører kun ÉN gang efter selve
  sporingen er slut — rører ikke tidsbudgettet under afspilningen.

**(c) 720px-sporing og (d) langsommere afspilning ved vedvarende
budgetoverskridelse er bevidst udeladt.** Begge kræver at vide om budgettet
rent faktisk holder på Marcs telefon for at kunne vurderes — det er netop det,
ingen rigtigt klip endnu findes til at afgøre. At gætte her ville risikere at
gøre det værre (fx sænke farten unødigt) uden at kunne måles. Se "Hvad er
næste".

**Commit 3 — tallene på telefonen.** Med `?diag=1` i adressen viser
athlet-flowet nu én diskret linje efter en "Vis mig nu"-kørsel: frames
sporet/sprunget over (summeret over de tre vinduer), ms/frame og den samlede
tid mod videoens egen varighed — de samme tal bænken måler, men fra den
RIGTIGE kørsel på Marcs egen telefon. Usynlig uden `?diag=1`, ingen ændring
for almindelig atlet-brug.

## Testresultat

- `npm run lint` — 0 fejl (samme 13 præeksisterende React-hook-advarsler som
  på uændret main).
- `npm test` — intet `test`-script findes i `package.json` (bekræftet
  præeksisterende på main, ikke noget denne ordre ændrede).
- `npm run gate:tracker` — grøn, inkl. `rep-preview-rig` (ORDRE 54 · "Vis mig
  nu"), uændret.
- `npm run verify:videocoach-clip` — grøn, mod det tegnede klip (intet rigtigt
  klip fandtes):

**Før (commit 1, ingen ændring endnu) vs. efter (commit 2), det tegnede klip:**

| Vindue | Før: mean/max px | Før: hop | Efter: mean/max px | Efter: hop | Tid/afspillet (efter) |
|---|---|---|---|---|---|
| 1 | 6,32 / 11,60 | 0 | 7,65 / 19,75 | 0 | 1,00x |
| 2 | 5,48 / 10,61 | 0 | 6,82 / 17,47 | 0 | 1,01x |
| 3 | 7,16 / 16,20 | 0 | 10,03 / 18,65 | 0 | 1,10x |
| Samlet forhold | 1,03x | | 1,04x | | (grænse 1,1x) |

Ærligt: på det tegnede klip er der **0 hop i begge tilfælde** — klippet er,
som ordren selv siger, for nemt til at vise problemet. Afvigelsen mod facit
steg en anelse (one-euro-filteret introducerer et lille slæb), men er fortsat
langt inde i tolerancen (15/35px), og det samlede tidsforhold (1,04x) er
uændret inden for 1,1x-grænsen. Commit 2 er derfor bekræftet **ikke at
skade** noget målbart her — om den rent faktisk reducerer hop på RIGTIG video
er ubekræftet, se "Hvad er næste".

## Hvad er næste

- **Marcs rigtige klip er stadig ikke lagt i `test-clips\`.** Det er
  ordrens eget første, eksplicitte krav ("prøvebænk med RIGTIG telefonvideo,
  før noget optimeres") — bænken (commit 1) er klar til at tage imod det, men
  hverken "hopper der stadig?" eller "holder 1,1x på telefonen?" kan besvares
  før filen (+ dens `<navn>.meta.json`) findes. Dette er reelt blokerende for
  at vurdere om commit 2 virkede.
- **(c) 720px og (d) langsommere afspilning er ikke forsøgt.** Naturlige
  næste skruer, men kun meningsfulde at dreje på MED tal fra det rigtige klip
  — ellers er det gætteri på Marcs telefons ydelse.
- **Diag-linjen (commit 3) er ikke set på en rigtig telefon endnu** — kun
  syntaks- og lint-tjekket. Første rigtige aflæsning kommer, når Marc kører
  "Vis mig nu" med `?diag=1` på sin egen telefon.
- **Hvad Marc skal aflæse på telefonen:** åbn videocoach med `?diag=1` i
  adressen (fx `...videocoach.html?diag=1`, eller den tilsvarende URL i
  athlete-flowet), kør "Vis mig nu" på en rigtig video, og læs den grå linje
  der dukker op under statuskortet. Tallet der afgør næste ordre er
  forholdet i parentes til sidst (fx "1.15x") — er det over ca. 1,1x, holder
  budgettet ikke på hans telefon, og næste skridt bliver (c)/(d) frem for
  flere målinger.

## Ærlige grænser

- Alle tal i denne rapport er fra det TEGNEDE klip i headless Chromium — ikke
  en rigtig optagelse, og ikke en rigtig telefon. Ordren selv har allerede
  vist at det tegnede klip giver et falsk godt billede; behandl "0 hop" og
  "1,04x" ovenfor som "ingen påvist skade", ikke som "problemet er løst".
- Commit 2's to greb ((a) gæld-baseret skip, (b) one-euro-filter) er valgt
  fordi de er lavrisiko og kan begrundes uafhængigt af rigtig video (de gør
  aldrig noget værre, uanset klip) — ikke fordi de er BEVIST at fjerne
  Marcs observerede hop. Det kan kun et rigtigt klip afgøre.
- `test-clips\<navn>.meta.json`-kravet (barPoint + windows, manuelt angivet)
  er mit valg, ikke ordrens ord. Et automatisk gæt på skivens position eller
  gentagelsernes grænser på en rigtig, ukendt video ville kunne give
  overbevisende, men forkerte, tal — samme fælde som selve ordren advarer
  imod. Prisen er at Marcs klip også skal ledsages af én lille JSON-fil, ikke
  kun en mp4.
- `npm test` mangler som script i dette repo (præeksisterende, ikke ordre
  82's ansvar) — verificeret ved kørsel mod uændret `package.json`.
