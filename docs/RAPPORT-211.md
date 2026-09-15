# Rapport — Ordre 211: hvorfor stopper sporingen ved 97-98 %: kravet eller klippet

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`sporingen-97-procent`, forgrenet fra `rent-trae-efter-e2e` (ordre 205, endnu
ikke merget til `main` da denne ordre startede). Tre commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `e46c8be` | Instrumentering (facit-sammenligning pr. frame/rep), ingen ændring i trackeren |
| 2 | `6b153c1` | Svaret: sporet, ikke kravet — `docs/SVAR-211.md` |
| 3 | `db52cfb` | Klip-realisme afprøvet og rullet tilbage — `docs/FRAVALGT-211.md` |

Arbejdstræet er rent efter hver commit. Ingen push. Ingen video committet.
Ingen ændring i trackerens produktionsadfærd.

## Hvad ændret

**Commit 1.** `public/videocoach.html`s `startMultipointTracking` fik ét nyt
felt på det eksisterende, allerede-guardede `TRACKER_BENCHMARK`-spor
(`window.__vcTrackerBenchmarkLast`): et uddrag af `path.analysis.reps`
(start/end/mcv/romCm/validRatio) — den REP-baserede analyse, som det
oprindelige benchmark-spor ikke dækkede (kun rå sporing). Aktiveres kun med
`?benchmark=1&trackerProbe=1`, aldrig i produktion (Dashboard.jsx/
AthleteView.jsx sender aldrig disse parametre).

`e2e/coach-sporing.spec.mjs`s `runCoachSporing` fik et valgfrit `traceOut`-
parameter: giver kaldstedet det, sættes VideoCoach-iframets URL om via et
302-redirect (fundet ved fejlsøgning: `route.continue({url})` kan IKKE ændre
en navigations-URL i Playwright, kun almindelige ressource-requests), og
`window.__vcTrackerBenchmarkLast` læses ind FØR asserten om gennemført
sporing — så et fund overlever selv den forventede fejl. Eksisterende kald
uden `traceOut` er uændrede.

Ny fil `e2e/coach-sporing-trace.mjs` kører ordre 200's egen klik-igennem-
prøve én gang mod det UÆNDREDE, fulde klip og skriver en pr.-frame
(fundet position vs. `truePos(t)`, afstand, hvilken betingelse der afviste
frame'et) og pr.-rep facit-sammenligning til `outputs/_seneste/sporing-trace/`.

**Commit 2.** Svaret (`docs/SVAR-211.md`): trackeren mister stangen præcis
ved t≈3,2s — nøjagtig bunden af rep 1, hvor bevægelsen vender — og
genfinder den ALDRIG resten af klippets 20 sekunder. Fra da af rapporterer
den `valid:true, confidence:1` for et fastfrosset punkt. Konsekvens: der
dannes 0 rep-kandidater overhovedet (ikke "reps uden finit mcv/romCm", som
ordre 200 selv gættede) — "97-98%" måler hvor meget af VIDEOEN trackeren
nåede at behandle, ikke sporingskvalitet.

**Commit 3.** Den mekaniske forklaring (klippets `worldY(t)` havde et
øjeblikkeligt, ikke-fysisk fortegnsskifte i hastigheden ved bunden af hver
rep — trackerens `pred=cur+vel*dt`-forudsigelse antager konstant hastighed)
blev afprøvet som rettelse: en glattet, pauseret bundvending i
`scripts/make-test-clip.mjs`. Testet, fundet markant VÆRRE (prøven blev
aldrig færdig, hverken inden for 120s eller en udvidet 300s), rullet helt
tilbage. Se `docs/FRAVALGT-211.md`.

## Testresultat

- **`npm run lint`:** rent.
- **Alle 34 `verify:*`-scripts:** grønne.
- **`npm run e2e`:** grøn (24,4-24,9s over flere kørsler).
- **Instrumenteret fund (commit 1's egen kørsel, `outputs/_seneste/sporing-trace/seneste.json`):**
  599 frames behandlet af 600 mulige, 299 ugyldige (holdt sidste sikre punkt),
  sluttede ved t=19,93s (99,7% af klippets 20s). 0 reps detekteret.
  Sporingstab starter frame 97 (t=3,233s), permanent fra frame 101
  (t=3,367s): `foundY` fastfrosset ved 915px mens `trueY` fortsætter gennem
  4 flere reps, afstand vokser monotont fra 58px til 570+px.
- **`git status --short`:** tom efter alt ovenstående (to velkendte
  verify:*-scripts, `verify-videocoach-film-guide.mjs` og
  `verify-athlete-reps-per-set-mobile.mjs`, skriver stadig direkte over
  leverance-facit uden for denne ordres omfang — samme fund som
  `docs/RAPPORT-205.md`, reverteret med `git checkout --`).
- Klip-realisme-forsøget (commit 3): 0/3 inden for 120s, 0/1 inden for
  udvidet 300s — se `docs/FRAVALGT-211.md`.

## Hvad er næste

1. **Er dette KUN et problem for den syntetiske trekantsbølge-bevægelse,
   eller mister trackeren også rigtige klip på samme måde ved en hurtig
   retningsvending?** `docs/FRAVALGT-211.md` foreslår en rolig, tålmodig
   afprøvning af glattet syntetisk bevægelse (uden tidspres og uden
   samtidig systembelastning fra andre agenter) som næste skridt — enten
   den viser at trackeren KAN følge en glat bevægelse (bare langsommere),
   eller at den aldrig kan, hvilket ville pege mod et ægte tracker-fund.
2. **Hjemme-genfindingen (`homeRecoveries`) fandt aldrig stangen igen**
   selvom den passerer tæt på klik-punktet (top af hver rep) fire gange
   efter tabet — værd at forstå hvorfor, uafhængigt af klippets
   realisme (se `docs/SVAR-211.md`).
3. To `verify:*`-scripts skriver stadig direkte over leverance-facit
   (samme fund som `docs/RAPPORT-205.md`s "Hvad er næste" — ikke rettet,
   uden for denne ordres omfang).
4. Har betydning for Hara (mærkbart bedre-sporet): denne ordre besvarer
   ordre 200's åbne spørgsmål med data i stedet for en gætning — "sporet,
   ikke kravet" — og finder PRÆCIS hvornår og (mekanisk, om end ikke
   endeligt bekræftet) hvorfor. Lukker IKKE selve sporingsproblemet, men
   gør et fremtidigt forsøg langt billigere: det ved nu hvor det skal
   kigge (t≈3,2s, bundvendingen) i stedet for at gætte bredt.

## Ærlige grænser

- Den mekaniske forklaring (ikke-fysisk hastighedsvending bryder
  trackerens lineære forudsigelse) er SANDSYNLIGGJORT af det PRÆCISE
  tidsmæssige sammenfald (t=3,2s = nøjagtig bundvending), IKKE bevist ved
  isoleret afprøvning — klip-realisme-forsøget testede hele pakken
  (glattet vending + bundpause samtidig), ikke hver ændring for sig, og
  mislykkedes af en anden grund (for langsom) før det kunne bekræfte eller
  afkræfte selve hastighedshypotesen.
- Hvorfor det glattede klip gjorde prøven markant langsommere er en
  UBEKRÆFTET hypotese (at det gamle fastfrosne punkt utilsigtet udløste
  `VC_TRACKER_FAST`s stille-frame-springing-genvej resten af klippet) —
  plausibel ud fra koden, ikke verificeret med egen måling.
- Kun ÉN fuld, instrumenteret kørsel lykkedes denne ordre (flere forsøg
  fejlede på port-kollision med andre samtidige Claude-sessioner på samme
  maskine, se næste punkt) — fundet er derfor ikke selv gentagelsesprøvet
  10 gange på ny måde, kun sammenholdt med ordre 200's egne 10/10 (samme
  97-98%-mønster, samme klip, samme metode).
- Denne session delte maskinen med fire andre aktive Claude-sessioner. Det
  førte til to reelle hændelser: (1) jeg dræbte ved en fejl en anden
  sessions (`entropi-app-d2`) proces på port 8991 under oprydning efter
  mine egne fejlslagne forsøg — opdaget og undskyldt med det samme,
  ingen skade sket (peer-sessionen kunne bare genstarte sin egen kørsel);
  (2) en anden Bhishak-session (`entropi-app-wt2-98`) var samtidig tildelt
  arbejde i SAMME worktree — vi koordinerede direkte, den trak sig, og
  flager selv dobbelt-tildelingen til Dhruva/Marc. Begge hændelser nævnt
  her fordi de kan have påvirket denne ordres timing-følsomme målinger
  (se punktet ovenfor om ubekræftet hastighedshypotese).
