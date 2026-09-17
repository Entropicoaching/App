# Rapport — Ordre 262: atleten filmer selv og får svar uden at vente på Marc

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

`atleten-filmer`, forgrenet fra `main` (`950fd8d`, ordre 256 merget). Tre commits:

| Commit | Hash | Indhold |
|---|---|---|
| 1 | `b42e48a` | Forudsætnings-rettelse: upload-validatorens kalibrerings-allowlist |
| 2 | `07ab65a` | "Film et sæt" — entry, guide, lokal sporing, resultat, gem/kassér |
| 3 | `7cacd7f` | e2e for hele flowet + `proever`-integration |

Arbejdstræet er rent efter hver commit. Ingen push, ingen produktions-Supabase,
ingen migration, ingen ny tabel, ingen ny afhængighed. Ingen atletdata i filer
eller i denne rapport. Vaidyas område (`src/volume/`, ordre 259) er urørt.

## Hvad ændret

I atletvisningen er der nu et nyt kort, "Film et sæt", ved siden af det
eksisterende VideoCoach-kort — det sidste er helt urørt og fortsætter med sin
egen adfærd (lokal sporing efterfulgt af automatisk afsendelse til coachen).
Det nye kort åbner det samme værktøj i en ny, sideordnet tilstand
(`?instant=1` på iframe-URL'en), styret af en enkelt ny konstant
(`VC_ATHLETE_INSTANT`) i `public/videocoach.html` — selve trackeren er ikke
rørt, kun UI-laget og afsendelses-beslutningen omkring den. Flowet er: en
kort, tre-linjers filmvejledning (kogt yderligere ned fra
`docs/videocoach/FILMEVEJLEDNING.md`, samme kilde som ordre 196) vises FØR
atleten optager eller vælger en video fra telefonen — alt lokalt, ingen
video-sheet popper op automatisk og intet uploades. Herefter kører den
eksisterende, fredede sporing helt uændret (samme kalibrering, samme
kontinuitetsregel, samme 10-sekunders ærlige loft fra ordre 225 hvis stangen
tabes — beskeden "Stangen blev tabt ved rep X · klip fra Ys eller klik stangen
igen" vises identisk, uændret kodesti). Lykkes sporingen, viser et nyt panel
antal reps fundet, stangens bane tegnet ovenpå det sidste billede (videoen
pauses ved klippets slutning i stedet for at loope, mens den eksisterende
tegne-løkke fortsat maler banen live), vandret afvigelse i cm PR. REP og tid
pr. rep — ingen snithastighed, ingen score, ingen "du gjorde det forkert". Cm-
afvigelsen pr. rep er en ny, lille funktion (`instantRepDriftCm`) der genbruger
nøjagtig samme regnestykke som `collectMetrics`s eksisterende, aggregerede
`driftCm` (maksimal vandret afstand fra startpositionen), blot afgrænset til
den enkelte reps eget tidsvindue i stedet for hele klippet — den læser kun
allerede beregnede punkter og rører intet i selve sporingen. Atleten vælger
herefter selv: Kassér (værktøjet genindlæses fra bunden — en frisk indlæsning
er den enkleste garanti for at intet ligger tilbage lokalt, uden at skulle
nulstille hver global tracker-variabel enkeltvis) eller Gem til sit eget pas
(kalder den samme `vcAthleteUploadAndGo`-funktion som standardvejens "Send til
coach" — samme bucket, samme tabel, samme postMessage-bro i
`src/AthleteView.jsx`, ingen ny kode i app-lagets Supabase-håndtering). Den
eksisterende video-vej fandtes allerede og kunne genbruges 1:1, så commit 3's
faldback ("gem kun tallene, ikke videoen") var ikke nødvendig.

Under afprøvning af Gem-stien (commit 1) viste det sig at
`src/videoCoachUpload.js`s validator (`PLATE_CALIBRATION_REASONS`) kun tillod
de FEJLENDE og manuelle kalibrerings-årsager (`plate:fail:auto`,
`plate:fail:small-video`, `plate:manual:ok`), ikke de tre VELLYKKEDE
auto-kalibrerings-ruter (`plate:auto:ring`/`farve`/`lum`) som
`wizardClick` rent faktisk sætter, når skiven findes automatisk. Enhver
atlet der nogensinde har kørt lokal sporing med en vellykket
auto-kalibrering FØR afsendelse — uanset flow, også standardvejen, hvis den
bruges sådan — ville derfor altid ramme "Kalibreringsårsagen er ugyldig" og
lande stille i sendearkets faldback i stedet for at sende. Rettet ved at
udvide allowlisten med de tre manglende værdier; ingen sammenhæng med
trackeren, ingen migration (feltet er en fri tekstkolonne uden
database-constraint, kun klientvalideret).

## Testresultat

- `npm run lint`: rent.
- `npm run build`: grøn (262ms).
- `npm run proever`: **59/59 grønne**, 0 fejl, 0 sprunget over — inklusive den
  eksisterende `verify:videocoach-clip` (real tracker-regression på syntetiske
  scenarier, uændret grøn — beviser at tracker-invarianterne ikke er rørt) og
  den nye `e2e (athlete-film-et-saet.mjs)`.
- Ny `e2e/athlete-film-et-saet.mjs` (`npm run e2e:film-et-saet`, ~80s): kører
  det RIGTIGE klik-igennem-flow som atlet mod den ægte app + mock-Supabase, to
  gange på samme deterministiske klip (`scripts/make-test-clip.mjs`s "glat"-
  variant — samme klip `e2e/coach-sporing.spec.mjs` bruger, genereret ved
  testkørsel, aldrig committet, ingen rigtig krop). Første gennemløb: log ind →
  "Film et sæt" → vælg klip → sæt start → markér skiven → analysér → 5/5 reps
  vist med cm-afvigelse og tid pr. rep → Kassér → asserter at
  `video_analyses` er UÆNDRET. Andet gennemløb, samme klip: samme flow →
  Gem → asserter en ny `awaiting_analysis`-række med
  `source_mode=athlete_submission` (den eksisterende video-vej, verificeret
  levende, ikke kun læst i koden). Ingen browser-fejl i nogen af kørslerne.

## Hvad er næste

1. Filmvejledningens tre linjer er generiske (samme tekst uanset løft), af
   samme grund som ordre 196's seks-punkts-udgave: øvelsesvælgeren vises
   først efter en video er valgt. Uændret her — ingen ny beslutning, samme
   afvejning som dengang.
2. `instantRepDriftCm` bruger samme "afstand fra startposition"-definition
   som den eksisterende `driftCm` — en fremtidig ordre kunne overveje en
   anden reference (fx afstand fra en lodret linje gennem bundpositionen),
   hvis Marc finder tallet misvisende i praksis. Ikke afprøvet mod en rigtig
   atlets klip, kun mod det syntetiske testklip.
3. Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
   bedre"): atleten kan nu få et øjeblikkeligt, tal-baseret svar på sit eget
   løft uden at afsende noget eller vente på Marc — det er præcis den
   oplevelse ordrens "Hvorfor"-afsnit beskriver som målet. Uverificeret i
   praksis endnu (kun det syntetiske testklip), men den tekniske vej er
   bevist levende end-to-end (kalibrering → sporing → tal → gem/kassér).

## Ærlige grænser

- Aldrig testet på et rigtigt klip eller en rigtig telefon — kun det
  syntetiske "glat"-testklip i headless Chromium (samme grænse
  `verify:videocoach-clip` og de fleste andre videocoach-prøver i dette
  repo allerede lever med). Mobil-visningen (390px) er ikke skærmbillede-
  verificeret for det nye resultatpanel specifikt.
- Kassér-knappen genindlæser hele værktøjet i stedet for at nulstille
  tilstanden i hukommelsen. Simplere og mere robust (garanteret rent), men
  betyder at "Kassér" ikke er øjeblikkelig — der er en kort, synlig
  genindlæsning. Vurderet en rimelig pris for pålideligheden.
- Ordrens tre kommandoer (1: optagelse, 2: svaret, 3: gem/kassér) er leveret
  som ÉT commit (commit 2 her), ikke tre — de deler samme funktioner i
  `public/videocoach.html` (dropHint-grenen, `runFullAnalysis`s
  post-analyse-gren, `setAthleteState`), og en kunstig opdeling ville have
  efterladt mellemliggende commits i en tilstand der enten ikke virkede
  (fx et resultatpanel uden en måde at komme videre på) eller ikke
  afspejlede hvordan koden faktisk blev bygget. Vurderet mest ærligt sådan;
  selve funktionsopdelingen (entry/guide → sporing/resultat → gem/kassér) er
  stadig synlig i koden og beskrevet ovenfor.
- Kalibrerings-validator-fejlen (commit 1) var IKKE indført af denne ordre —
  den er et pre-eksisterende hul i `src/videoCoachUpload.js`, fundet fordi
  "Film et sæt" er den FØRSTE flow der altid kører lokal sporing før en
  eventuel afsendelse. Standardvejens automatiske afsendelse (ordre 57) ville
  ramme samme fejl, HVIS en atlet der bruger den også manuelt kører lokal
  sporing med vellykket auto-kalibrering før "Send" — ikke undersøgt om det
  reelt er sket i produktion, kun at koden tillod det.
- "Vis mig nu" (👁, tre-repræsentative-reps-forhåndsvisning) er skjult helt i
  instant-flowet fremfor at ændre dens egen automatiske afsendelse
  (`vcAthletePreviewThree` sender stadig altid selv) — valgt for at undgå at
  røre en tredje, separat kodesti i en allerede stor ordre. Ikke et tab for
  atleten: standardvejen (VideoCoach-kortet) har den stadig.

**Tre linjer til Marc:** atleten trykker "Film et sæt", ser en kort
filmguide, optager eller vælger en video — intet sendes endnu. Med det samme
sporingen er færdig, ser hun antal reps, stangens bane, hvor meget den
vandrede sidelæns pr. rep og hvor lang tid hver rep tog — ingen dom, ingen
karakter. Trykker hun Gem, lander den i dit indbakke-flow som i dag (samme
video-vej); trykker hun Kassér, er intet gemt eller sendt noget sted.
