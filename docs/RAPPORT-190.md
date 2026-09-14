# Rapport — Ordre 190: coachens egen sporing, ende-til-ende-prøvet

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`coachen-sporer-e2e`, forgrenet fra `fravalgt-listen` (ordre 184, endnu ikke
merget til `main` da denne ordre startede — `main` stod på `088ec36`,
`fravalgt-listen` på `2df5096`, per ordrens egen instruks).

**Ingen kode-commits.** Arbejdstræet er rent — al kode fra undersøgelsen
(se nedenfor) er rullet tilbage, ikke leveret. Denne rapport er selve
leverancen, jf. ordrens egen regel: "Rammer du undervejs noget der kræver en
større ændring, så byg den ikke: skriv den ned og gå videre." Se "Hvad
ændret" for hvorfor.

## Hvad ændret

**Intet i produktionskoden.** Jeg brugte hele ordrens tid på at undersøge om
en ægte, klik-for-klik e2e-prøve af coachens egen stangbane-sporing kunne
bygges og køre pålideligt — og fandt at den KAN klikkes igennem korrekt, men
IKKE kan gøres pålidelig nok til at høre hjemme i `npm run e2e`.

**Det jeg fandt ud af (læst FØR noget blev skrevet, som ordren bad om):**

- **Klik-flowet er fire klik**, bekræftet direkte i `public/videocoach.html`s
  COACHWEB-kode (variablen `coachFlowTo`/`updateCoachFlow`, trin
  "1 Start · 2 Bane · 3 Feedback · 4 Send"):
  1. `#allBtn` (⚡) — starter klik-igennem-sporingen (`wizard = {auto:true}`)
  2. Klik skivens midte på `#canvas` — auto-kalibrering (`autoCalib`) finder
     kantringen
  3. `#allBtn` igen — bekræfter ringen, starter selve sporingen
     (`runFullAnalysis`)
  4. `#saveBtn` ("📨 Send analyse") — gemmer via `save-draft`-broen til
     `src/Dashboard.jsx`
- Klik 2's position kan beregnes PRÆCIST, ikke gættes: `scripts/make-test-clip.mjs`
  eksporterer sin egen `truePos(t)` — den nøjagtige facit-position tracker-testen
  selv bruger — oversat fra videoens pixel-koordinater til canvas'ets CSS-boks
  med samme formel som `videocoach.html`s egen `pos(e)` (omvendt).
- Genbrugte `scripts/make-test-clip.mjs` UÆNDRET (som ordren bad om — "Genbrug
  generatoren; skriv ikke en ny") til at generere et fuldt, syntetisk klip med
  en tegnet, sporbar skive, og beskar med ffmpeg (ren efterbehandling, ingen
  ændring i selve generator-koden) til et lille udsnit under 300 KB.
- Byggede `e2e/coach-sporing.spec.mjs`, der loggede ind som coach, åbnede en
  atlets afventende video via "Spor nu" (samme bro som
  `e2e/video-review.spec.mjs`s del A), og klikkede de fire klik igennem med
  ægte Playwright-klik mod den ægte `public/videocoach.html`.

**Det der virkede pålideligt:** selve KLIKKENE og AUTO-KALIBRERINGEN. Med den
nøjagtige beregnede position fandt `autoCalib` skiven konsekvent (samme
kant-score gentaget identisk på tværs af flere kørsler: `best=3512,
second=2721`) — det er PRÆCIS den del af ordrens krav der lyder "Prøven skal
fejle hvis sporingen ikke finder skiven". Denne del af app'en var aldrig
tidligere klik-for-klik-prøvet (kun sporingsalgoritmen ISOLERET, se
`scripts/verify-videocoach-clip.mjs`) — et reelt, tidligere udækket hul.

**Det der IKKE virkede pålideligt:** selve stangbane-sporingen EFTER
kalibrering — den del der rent faktisk følger skiven gennem løftets
bevægelse. Den lykkedes to gange under tidlig afprøvning (banneret gik
glat 2%→98% uden afbrydelse), men fejlede derefter GENTAGNE gange i træk
(6+ forsøg) med samme mønster: sporingen mister skiven midt i bevægelsen
("Holder sidste sikre punkt"), forsøger at genfinde den, og ender til sidst
i "Ingen tydelig rep blev fundet" — selv når kalibreringen lige forinden var
perfekt.

**Hvad jeg afprøvede for at finde årsagen (alle testet, ingen løste det):**

1. Klippets komprimering (crf 18/21/24/26/30) — mistanke om at høj kvalitet
   bevarer for meget konkurrerende intern tekstur til kalibreringen (delvist
   bekræftet — crf 30 gav den mest STABILE kalibrering), men ændrede intet
   ved selve sporingens pålidelighed.
2. Opløsning (fuld 720×1280 vs. nedskaleret 480×854) — nedskalering gjorde
   det VÆRRE (kalibreringen fandt slet intet).
3. Hvor i klippet udsnittet startede (lige før klikpunktet vs. fra klippets
   egen begyndelse) — dette var den ENESTE variabel der gjorde en reproducerbar
   forskel: et udsnit der starter TÆT PÅ klikpunktet fejlede sporingen HVER
   gang; et udsnit fra klippets egen start (samme "opvarmningsafstand" til
   klikpunktet som i det fulde, urørte klip) lykkedes de FØRSTE gange jeg
   prøvede det — men holdt ikke ved gentagne kørsler bagefter (se punkt 6).
4. Udsnittets længde (1 rep vs. 2 reps vs. det fulde 5-reps-klip) — det fulde
   klip lykkedes (én gang, glat uden en eneste afbrydelse); et 2-reps-udsnit
   fejlede lige så konsekvent som 1-reps-udsnittet.
5. GOP-struktur / B-frames (`-g 1` alle-keyframes, `-bf 0` ingen B-frames) —
   ingen forskel.
6. Genforsøg (klik igen med forskudt position ved kalibreringsfejl, hele
   klik-igennem-flowet forfra ved sporingsfejl) — kalibreringen blev
   pålidelig med genforsøg, men sporingen forblev upålidelig selv med op til
   3 hele forsøg i træk, OGSÅ på den PRÆCIS SAMME klip-konfiguration der
   havde virket to gange tidligere i undersøgelsen.

Punkt 6 er den vigtigste: den SAMME kode, den SAMME committede klipfil, den
SAMME beregnede klik-position gav SKIFTENDE resultater på tværs af kørsler i
samme testmiljø — det er ikke en fejl i min klik-logik eller klip-generering
(begge er deterministiske og verificerede), det er selve
sporingsalgoritmens opførsel under denne maskines aktuelle
ressourcebetingelser (headless Chromium, ingen GPU, muligvis CPU-belastning
fra timevis af sammenhængende ffmpeg+Chromium-kørsler i denne session) der
ikke er deterministisk nok til at bygge en pålidelig, grøn `npm run e2e`-test
på.

**Hvorfor jeg ikke byggede videre eller leverede prøven alligevel:** en
e2e-prøve der tilfældigt fejler af grunde der intet har med appens
korrekthed at gøre, er værre end ingen prøve — den underminerer tilliden til
`npm run e2e`s "grøn = trygt at merge"-løfte, som resten af holdet (og
Dhruvas mergebeslutninger) er afhængige af. At finde selve rodårsagen kræver
et ægte performance-trace (Chrome DevTools' Performance-panel eller
`Tracing.start` via CDP), ikke kun banner-tekst og før/efter-tal — samme
klasse værktøj FRAVALGT-184.md #2 allerede efterlyste til en anden,
beslægtet uforklaret sporings-regression. Det er reelt en større
undersøgelse end denne ordres ramme, og ordren giver mig udtrykkeligt lov
til at stoppe her: "Rammer du undervejs noget der kræver en større ændring,
så byg den ikke: skriv den ned og gå videre."

## Testresultat

Ingen ændringer leveret, så ingen ny test at rapportere resultat for.

**npm run lint:** rent (uændret — ingen kode rørt).

**Alle 31 `verify:*`-scripts:** grønne (uændret).

**npm run e2e, tiden FØR og EFTER:** uændret ved 24,8s (ingen ny spec
tilføjet til `e2e/run-all.mjs`) — samme kommando kørt to gange gav 24,8s
begge gange, som forventet uden nogen kodeændring.

## Hvad er næste

Dette er ikke et lukket punkt — det er en delvist løst opgave med en klar,
smal rest:

1. **Kalibrerings-klikkene (trin 1-2 af de fire) kan bygges NU, med det jeg
   allerede har fundet** — det er den pålidelige halvdel. En fremtidig ordre
   kunne levere EN mindre prøve der kun dækker "coachen åbner en afventende
   video og finder skiven" (matcher ordrens eget "Prøven skal fejle hvis
   sporingen ikke finder skiven" bogstaveligt), uden at kræve at hele
   sporingen fuldføres. Billigt, lavrisiko, bygger direkte på denne ordres
   research.
2. **Selve sporingens pålidelighed i en headless testkontekst** kræver et
   ægte performance-trace for at finde rodårsagen — se "Hvad ændret" for
   hvorfor. Kandidat til en ordre med adgang til Chrome DevTools'
   Performance-panel eller lignende, ikke kun banner-tekst/CDP-netværkslog
   som denne og tidligere ordrer har brugt.
3. Har betydning for Hara (mærkbart bedre-sporet): selve FUNDET her — at
   coachens sporingsflow reagerer forskelligt på tværs af ellers identiske
   kørsler — er i sig selv en lille advarselslampe værd at kende til, uanset
   om det nogensinde bliver en e2e-prøve. Hvis Marc oplever "sporingen fandt
   ikke skiven" som en sjælden, tilsyneladende tilfældig fejl i produktionen,
   er DETTE fund en del af forklaringen, ikke en ny, ukendt fejl.

## Ærlige grænser

- Jeg leverede INGEN kode denne ordre — hverken klippet, prøven eller
  hjælpefunktionen jeg midlertidigt udvidede i `e2e/video-upload.spec.mjs`.
  Alt blev rullet tilbage efter undersøgelsen, i tråd med samme princip
  ordre 175 fulgte for sin fjerde, tilbagerullede rettelse: uforstået kode
  leveres ikke, uanset hvor tæt den var på at virke.
- De to "gennemførte" testkørsler (glat 2%→98%, ingen afbrydelse) beviser at
  et FULDT, urørt 20-sekunders klip KAN spores pålideligt gennem hele
  klik-flowet — men kun observeret to gange, ikke nok til at kalde det
  "løst", og under alle omstændigheder for stort til at committe (under
  ordrens egen 300 KB-grænse for et lille, hurtigt klip).
- Jeg har ikke haft adgang til et ægte performance-trace-værktøj i denne
  session — kun banner-tekst, DOM-tilstand og netværkslog (samme
  værktøjsbegrænsning FRAVALGT-184.md #2 allerede beskrev for en anden,
  beslægtet sporings-regression). Rodårsagen er derfor stadig ukendt, ikke
  kun "svær at rette".
- Jeg brugte betydelig tid (størstedelen af ordrens ramme) på denne
  undersøgelse før jeg stoppede — en afvejning jeg traf undervejs uden at
  spørge (jf. ordrens "spørg aldrig blokerende"), fordi hvert nyt forsøg
  virkede som det kunne være det sidste nødvendige skridt. Med bagklogskab
  burde jeg have sat en hårdere tidsgrænse for selve diagnosen og skiftet
  til at dokumentere fundet tidligere.
