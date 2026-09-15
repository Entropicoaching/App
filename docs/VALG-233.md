# Valg — ordre 233, commit 3: næste sten efter commit 2, med tal

Ad hoc Lighthouse-vandfald (samme metode som 226/228/231 — ét løb pr. skærm,
ikke median af 5, mock/build/login-infrastruktur kørt engangs og kasseret
bagefter), på `dist/` efter commit 1's forudindlæsning.

Atletliste (coach): TTI 7231ms, TBT 16ms.
Dagens pas (atlet): TTI 5920ms, TBT 391ms.

## Kaldrækkefølgen er rettet — men sad ikke fast på rundtursforsinkelse

Vandfaldet bekræfter commit 1's greb MEKANISK: `index.js` og skærmchunken
starter nu reelt samtidigt.

- Atletliste: `index.js` starter 160ms, `Dashboard-*.js` starter 202ms
  (42ms senere — parallelt, ikke i serie).
- Dagens pas: `index.js` starter 114ms, `AthleteView-*.js` starter 145ms
  (31ms senere — samme mønster).

Før commit 1 startede skærmchunken FØRST når `index.js`s modulgraf var kørt
færdig (se `docs/RAPPORT-231.md` punkt 2 og denne ordres commit 1) — flere
sekunder senere, ikke 30-40ms.

**Den ene største post, navngivet med tal: selve BYTE-MÆNGDEN, ikke
rækkefølgen.** `index.js` (351kB rå) og skærmchunken (Dashboard 242kB rå /
AthleteView 118kB rå) deler nu samme begrænsede, throttlede rør (Lighthouses
mobileSlow4G, devtools-metoden — bekræftet af NPM builds egne komprimerede
tal: `index.js` 359,08kB rå/101,61kB gzip). Under en BÅNDBREDDE-begrænset
forbindelse (til forskel fra en RUNDTURSFORSINKELSE-begrænset) flytter det
at starte to store hentninger samtidigt ikke den samlede transporttid ret
meget — de to downloads deler den samme, faste bitrate, så den kombinerede
byte-mængde (~593kB rå på Atletliste, ~469kB rå på Dagens pas) stadig skal
igennem samme flaskehals uanset rækkefølge. Det forklarer, med tal, hvorfor
commit 2's måling viste en lille (og i to af tre tilfælde støjagtig) TTI-
gevinst selvom kæden er bevist brudt: rettelsen sparer nu KUN rundturs-
forsinkelsen mellem de to hentninger (i praksis ét round-trip, få hundrede
ms på en throttlet profil), ikke selve overførselstiden, som forbliver
båndbredde-bundet af de UÆNDREDE bytetal.

Samme retning som ordre 201's egen advarsel (spekulativ parallel-hentning
af BEGGE mulige chunks blev en regression under throttling, fordi de delte
samme rør) — denne ordre undgik netop den fælde ved kun at forudindlæse
den GÆTTEDE (typisk korrekte) chunk, ikke begge. Men selv med kun ÉN ekstra
parallel hentning viser dette vandfald at bånd­bredde-delingen stadig er
den reelle grænse for hvor meget en ren rækkefølge-rettelse kan give.

Sidste script-request slutter 4944ms på Atletliste (68% af TTI) og 4253ms
på Dagens pas (72% af TTI) — samme størrelsesorden som 231/228's fund
(76-94%, andet enkelt-løb, samme støj-forbehold), fortsat script-transport,
ikke Supabase eller mainthread-arbejde (TBT 16-391ms, lille).

Intet greb forsøgt mod nogen af delene, jf. commit 3's egen grænse. Den
konkrete, unavngivne kandidat for et fremtidigt greb der REELT ville flytte
byte-mængden (ikke bare rækkefølgen) er stadig 228/231's "Hvad er næste"-
punkt: AthleteView.jsx's manglende interne faneopsplitning (6598 linjer,
ingen LazyBoundary-faner, i modsætning til Dashboard.jsx's tre) — og,
symmetrisk, at Dashboard-chunken (247,85kB rå/62,17kB gzip) heller ikke er
splittet yderligere. Begge uden for denne ordres omfang.
