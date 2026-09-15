# Rapport — Ordre 200: coachens sporing e2e, anden runde

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`coachen-sporer-e2e-2`, forgrenet fra `atletlisten` (ordre 193, endnu ikke
merget til `main` da denne ordre startede — `main` stod på `3ed6561`,
ordre 190 merget, ordre 193 ikke). To commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `656a374` | `ensureCoachSporingClip()` — klippet genereres ved prøvens start |
| 2 | `d563356` | `e2e/coach-sporing.spec.mjs` genopbygget + 10x-prøve: 0/10 |
| 3 | (denne commit) | Opdateret fravalgt-liste + denne rapport |

Arbejdstræet er rent efter hver commit. Ingen push. Ingen videofil
committet.

## Hvad ændret

**Baggrund:** ordre 190 fandt at et beskåret klip (under 300 KB) ikke
sporede pålideligt, og rapporterede at det FULDE, urørte 20-sekunders klip
lykkedes "to gange" — men uden en systematisk gentagelsesprøve. Denne ordre
droppede 300 KB-grænsen (Dhruvas, ikke formålets) og byggede den
manglende gentagelsesprøve: generér klippet ved kørsel (aldrig committet),
kør den fulde klik-igennem-prøve ti gange i træk, se om det holder.

**Commit 1.** `ensureCoachSporingClip()` (`e2e/harness.mjs`) kører
`scripts/make-test-clip.mjs` UÆNDRET og kopierer resultatet til
`test-clips/_e2e/coach-sporing-full.mp4` (git-ignoreret), kun hvis filen
ikke allerede findes. Målt genereringstid: **~4,9 sekunder** (600 frames,
alle 5 reps, ~1,9 MB) — billigt nok til at gøre ved hver prøvekørsel hvis
nødvendigt, men genbrugt på tværs af kørsler i samme arbejdstræ for at
spare tiden alligevel.

**Commit 2.** `e2e/coach-sporing.spec.mjs` genopbygget fra
`docs/RAPPORT-190.md`s fund — samme fire klik, samme `truePos(t)`→canvas-
koordinat-oversættelse, samme genforsøgslogik for kalibreringen. Ny fil
`e2e/coach-sporing-reliability.mjs` kører prøven N gange i træk (frisk
mock/browser pr. kørsel) og skriver en tabel.

**Resultatet, ti kørsler i træk, mod det FULDE, urørte klip:**

| Kørsel | Gennemført | Slutprocent | Tid |
|---|---|---|---|
| 1 | Nej | 97% | 80,7s |
| 2 | Nej | 98% | 80,7s |
| 3 | Nej | 97% | 80,6s |
| 4 | Nej | 97% | 80,6s |
| 5 | Nej | 97% | 80,7s |
| 6 | Nej | 97% | 80,6s |
| 7 | Nej | 97% | 80,6s |
| 8 | Nej | 98% | 80,7s |
| 9 | Nej | 97% | 80,6s |
| 10 | Nej | 98% | 81,4s |

**0/10.** Ikke tilfældig, spredt fejl — bemærkelsesværdigt ENS på tværs af
alle ti: samme slutprocent-interval (97-98%, ikke bredt spredt), samme
varighed inden for ét sekund. Kalibreringen (auto-kalibreringen finder
skiven, klik 1-2) lykkedes i ALLE ti forsøg. Det er selve
stangbane-sporingen EFTER kalibrering, der konsekvent — men først efter at
have behandlet praktisk talt HELE klippet (97-98%) — ikke finder "en
tydelig rep" (finit `mcv`/`romCm` for mindst én af de fem reps).

**Dette modsiger ordrens egen præmis.** Ordre 190 rapporterede to
observerede succeser med det fulde klip; denne ordres langt mere
systematiske gentagelsesprøve (samme klip-genereringskode, samme
klik-flow) fandt nul. Den mest sandsynlige forklaring: de to succeser i
190 var reelle, men sjældne udfald af en lav, ikke-nul succesrate — ikke
bevis for generel pålidelighed. En prøve der lykkes ~15-20% af tiden ville
sagtens kunne give "to succeser" blandt et større, ikke fuldt optalt antal
forsøg i 190's egen, mindre systematiske afprøvning.

## Testresultat

**npm run lint:** rent.

**Alle 31 `verify:*`-scripts:** grønne (ingen ændring i `src/` denne ordre).

**npm run e2e:** grøn, uændret (`e2e/coach-sporing.spec.mjs` er IKKE
tilføjet til `e2e/run-all.mjs` — ordrens egen regel: under 10/10 = ikke i
run-all).

## Hvad er næste

**Ingen fejl i sporingen eller broen til Dashboard blev rettet** — der er
intet SPECIFIKT, afgrænset fund at rette i eget commit (ordrens Commit 3
forudsætning). Fundet er i stedet et ÅBENT SPØRGSMÅL, der kræver bedre
værktøj end denne og forrige ordres banner-tekst/DOM-tilstand-diagnostik:

- **Hvorfor stopper sporingen konsekvent ved 97-98%, ikke tidligere og ikke
  100%?** Det tyder på at trackeren rent faktisk NÅR igennem næsten hele
  klippet (alle fem reps) uden at give helt op undervejs, men at INGEN af
  de fem reps ender med at opfylde kravet om finit `mcv`+`romCm`. Værd at
  undersøge: er kravet for strengt for denne SYNTETISKE bevægelse (måske
  mangler den noget en ægte stangbevægelse har), eller mister trackeren
  reelt sporet konsekvent på samme måde hver gang (deterministisk, ikke
  tilfældigt — matcher de ens sluttal)?
- **Hvad det ville koste:** et ægte performance-/logik-trace (Chrome
  DevTools' Performance-panel, eller at instrumentere
  `startMultipointTracking`/`runFullAnalysis` midlertidigt med console.log
  af hver reps `mcv`/`romCm`-beregning) — ikke kun banner-tekst. Samme
  klasse værktøjsbegrænsning som `docs/FRAVALGT-184.md` #2 og
  `docs/RAPPORT-190.md` allerede pegede på for en beslægtet, uforklaret
  sporings-opførsel.
- **Hvad det ville give:** enten en reel fejl at rette (hvis sporingen har
  en systematisk brist på netop denne type syntetisk bevægelse), eller en
  forklaring på hvorfor headless/CPU-begrænset sporing generelt er
  upålidelig nok til at gøre e2e-dækning af dette specifikke flow dyrt at
  opnå.
- Har betydning for Hara (mærkbart bedre-sporet): selve MÅLINGEN her
  (0/10, ikke "det virker for det meste") er en mere ærlig og brugbar
  status end 190's "to succeser" — det forhindrer en fremtidig ordre i at
  antage prøven kan gøres grøn med et lille ekstra forsøg.

## Ærlige grænser

- Jeg fandt IKKE rodårsagen til hvorfor sporingen konsekvent stopper ved
  97-98% uden en brugbar rep — kun at den gør det, hver gang, med
  påfaldende ens tal. En hypotese (kravet til "brugbar rep" er for
  strengt for netop denne syntetiske bevægelse) er nævnt, ikke bekræftet.
- De "to succeser" ordre 190 rapporterede, og de "0/10" denne ordre målte,
  er begge ærlige gengivelser af hvad der blev observeret på hver sin
  tidspunkt — jeg har ikke forsøgt at forene dem udover hypotesen om en
  lav, ikke-nul succesrate ovenfor.
- Klippet er genereret og testet i DENNE session/maskines aktuelle
  tilstand — samme forbehold som ordre 190 tog om mulig
  ressourcebelastning fra en lang, sammenhængende arbejdssession, uden at
  kunne bekræfte det som årsag denne gang (10 ens resultater peger snarere
  på en DETERMINISTISK, ikke miljø-afhængig, opførsel).
- `e2e/coach-sporing.spec.mjs` og `e2e/coach-sporing-reliability.mjs` er
  committet som fungerende, genbrugelig infrastruktur til et FREMTIDIGT
  forsøg — men leverer selv ingen dækning i `npm run e2e` lige nu.
