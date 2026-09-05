# ORDRE 54 — Atleten skal ikke vente på os

Gren: `atleten-venter-ikke` (fra main `e4f217f`, ordre 50 allerede merget)

Commits:
- `20318b8` — commit 1: "film og send", analysen kommer bagefter (auto-send)
- `c9df961` — commit 2: "Vis mig nu", tre reps med det samme
- `4ec88d5` — commit 3: mobil-overlap i atlet-tilstanden

Filer: `public/videocoach.html` (kirurgiske tilføjelser, ikke omskrevet),
`scripts/gate-tracker.mjs` (én linje: ny rig tilføjet til gate) + én ny fil,
`docs/videocoach/rep-preview-rig.mjs`. `dist/` er git-ignoreret (uændret
praksis) og røres ikke lokalt, da den rigtige build sker via GitHub Pages'
deploy-pipeline fra `main`, ikke fra min arbejdsmappe.
Ikke rørt: coach-tilstanden, benkæden, bænkens skulderanker, sættets
start (ORDRE 43/45/47/50) — kun genbrugt (`vcMotionSeries`), aldrig ændret.

## Opgaven

Marc testede de fem foregående hastighedsgreb på rigtige videoer: hurtigere,
men stadig 2-3 minutter for otte reps. Hans konklusion — problemet er ikke
farten, det er at atleten venter overhovedet — betyder at løsningen ikke er
mere tuning af selve trackeren, men at ændre HVAD hun skal gøre og se, mens
den kører.

## Commit 1 — "film og send", analysen kommer bagefter

**Hvad der IKKE ændrede sig:** selve sporingen. Der findes ingen video-upload
eller server-side analyse i denne app (ingen Supabase Storage-bucket, ingen
kø-service uden for browseren) — `video_analyses`-tabellen gemmer kun det
FÆRDIGE resultat (bar_path/metrics/findings), aldrig selve videofilen. At
bygge det ville være et skema-/infrastrukturskifte, som ordren udtrykkeligt
forbyder. Sporingen kører derfor stadig lokalt på hendes telefon, lige som
i dag.

**Hvad der ændrede sig:** hun skal ikke længere overvåge den eller selv trykke
Send bagefter. Så snart hun trykker Start (efter at have bekræftet ringen),
sætter appen sig i en "Video modtaget ✓"-tilstand i stedet for den gamle
"Vi følger stangen / Hold siden åben, mens hele sættet gennemgås" — ingen
fremdriftsbjælke, ingen krav om at kigge på skærmen. Når sporingen er færdig,
sender flowet automatisk hele sættet til hendes coach
(`vcAthleteAutoSubmit`, kaldt fra `runFullAnalysis`s eksisterende
succes-gren) ved at genbruge `saveBtn.onclick` 1:1 — samme felter, samme
validering, og samme kø-fald-tilbage i `AthleteView.jsx`
(`queueVideoCoachDraft`/`flushVideoCoachDraftQueue`) hvis nettet svigter.
Intet nyt sende-flow, som ordren bad om.

## Commit 2 — "Vis mig nu", tre reps med det samme

Ny knap ved siden af Start, kun synlig mens ringen venter på bekræftelse:
sporer kun tre gentagelser (første, en fra midten, sidste) og viser dem med
det samme; den fulde baggrunds-analyse fra commit 1 fortsætter derefter
stille, så coachen stadig får hele sættet.

**Hvorfor ikke bare hoppe direkte til de tre reps:** `startMultipointTracking`
forudsætter, at det punkt hun klikkede ER stangens position ved
starttidspunktet — den kan ikke bare søge til et vilkårligt sted midt i en
gentagelse uden at miste identiteten øjeblikkeligt. Løsningen er en ny,
billig forudsøgning (`vcFindRepAnchors`/`vcRunRepWindowsPresearch`), der
finder PAUSER inde i det allerede bekræftede sæt (samme princip som ORDRE
50's `vcMotionSeries`, genbrugt uændret) — men med en anden støjgrænse: hvor
en hel video mest er i ro (ORDRE 50 kan bruge en percentil af klippets egen
støj), er selve sættet mest i BEVÆGELSE med kun korte pauser imellem reps.
En percentil-baseret grænse ramte derfor midt i selve op/ned-bevægelsen —
fanget af riggen selv under udvikling (se "Ærlige grænser" for detaljen) og
rettet til en brøkdel af klippets egen spidsbevægelse i stedet.

Finder forudsøgningen færre end tre brugbare pauser (fx et rent
touch-and-go-sæt uden hvil mellem reps), falder flowet stille tilbage til
den fulde analyse — hun mister ikke noget, "Vis mig nu" bliver bare identisk
med Start i det tilfælde.

### Målt: tre reps mod otte

`docs/videocoach/rep-preview-rig.mjs` udtrækker den LEVENDE tracker-kode
(samme teknik som `tracker-live-bench.mjs`) og kører den mod et syntetisk
8-reps-sæt, dels kontinuerligt (alle otte), dels som tre isolerede vinduer
(hårdkodet fra scenens egen definition, ikke fra forudsøgningens output —
se filen for hvorfor de to ting er bevidst adskilt).

| | Node-rig-tid |
|---|---|
| 8 reps kontinuerligt | ~20,0 s |
| 3 reps (1., midt, 8.) | ~3,8 s |
| **Forhold** | **~5,25×** |

Ekstrapoleret til Marcs egne tal (2-3 minutter for otte reps på en rigtig
telefon): **2-3 min ÷ 5,25 ≈ 23-34 sekunder.** Det rammer klart under et
minut — men se "Ærlige grænser": det er en ekstrapolering fra et syntetisk,
CPU-bundet forhold, IKKE en måling på en rigtig telefon med en rigtig video.
Jeg har ingen browser-video-decode-tid eller batteripåvirkning at sammenligne
med, og har ikke pyntet på den forskel.

Rig'en tester også, at forudsøgningen finder en brugbar opdeling på et
pauset 8-reps-sæt (fandt alle 8 vinduer i test) og falder korrekt tilbage
(< 3 vinduer) på et touch-and-go-sæt uden pause. Begge dele er nu en fast
del af `npm run gate:tracker`.

## Commit 3 — mobil-overlap

Gennemgået headless i browseren (Claude-in-Chrome), men **ikke** i præcis
390px som 2026-09-03-audittet — se "Ærlige grænser". Fik i stedet ~500px
bredde, stabilt nok til at afsløre tre reelle overlap, alle `body.athlete`-
scopede rettelser:

| # | Sted | Fund | Rettelse |
|---|---|---|---|
| 1 | Footer i `confirm`-tilstand | "Vis mig nu" (commit 2) væltede ned i en ekstra række i stedet for at stå ved siden af Start/Afspil — den generelle 2-kolonne-regel (`:not([data-athlete-state="done"]):not([data-athlete-state="sent"])`) har HØJERE CSS-specificitet end en simpel `[data-athlete-state="confirm"]`-regel, uanset kildeorden | Gav den generelle regel samme udelukkelse som den allerede havde for done/sent: `:not([data-athlete-state="confirm"])` tilføjet |
| 2 | `#athleteStatus` (top:52px) vs. systembjælken (0-67px) og øvelsesvælgeren (68-108px) | Statuskortet lå oven i BEGGE i alle tilstande hvor det vises (target/confirm/analyzing/error) — commit 1's "Video modtaget ✓"-besked kunne blive delvist skjult, samme mønster som `#banner`-fundet i 2026-09-03-audittet | `top:52px` → `top:116px`, samme løsning som dengang |
| 3 | `#trackerFastBtn` (⚡/🐢, ORDRE 45) | "Altid synlig" nederst til venstre — dækkede footerens Afspil-knap på en smal skærm. Ingen brug for atleten | Føjet til den eksisterende hide-liste for ATHLETE |

Før/efter er dokumenteret som skærmbilleder i selve arbejdssessionen
(zoom + `getBoundingClientRect()`-målinger for #1 og #2's overlap-areal, ikke
kun gæt ud fra hvordan det "ser bedre ud") — ingen atletdata i nogen af dem
(kun tomt UI, ingen video indlæst).

## Testresultat

- `npm run lint` — 0 fejl (samme 12 præeksisterende React-hook-advarsler i
  `AthleteView.jsx`/`Dashboard.jsx`, urørt af denne ordre).
- `npm run gate:tracker` — GRØN, inkl. den nye `rep-preview-rig.mjs` (nu en
  fast del af gaten).
- `verify:videocoach-submission`, `verify:videocoach-labels` — grønne
  (de to `videoCoachSubmission.js`/lift-relaterede scripts, uberørt af mine
  ændringer, kørt som ekstra sikkerhed siden commit 1 læner sig 100% på den
  eksisterende sendevej).
- `node --check`-ækvivalent (parse af det udtrukne script) — fejlfrit efter
  hver commit.
- Appen har ingen samlet `npm test`-kommando (bekræftet: intet `test`-script
  i `package.json`) — `gate:tracker` + de relevante `verify:*`-scripts ER
  appens testkommando for dette område.

## Ærlige grænser

- **Ingen ægte "video-upload, analysen kommer bagefter".** Ordren bad om at
  atleten ikke skal opleve nogen sporing på telefonen, kun selve
  overførslen. Det er teknisk ikke muligt uden en video-lagringsmekanisme,
  som IKKE findes i appen i dag (bekræftet: ingen `supabase.storage`-brug
  nogen steder i repoet) — og at bygge én ville være præcis den slags
  skema-/infrastrukturændring, ordren udtrykkeligt forbyder. Det jeg har
  leveret i stedet: sporingen kører stadig lokalt, men hun behøver ikke
  længere overvåge den eller trykke Send — det sker automatisk. Det er en
  ægte forbedring af den OPLEVEDE ventetid, ikke af den faktiske
  regnetid. Skærmen skal blive åben, til der står "Sendt" — lukker hun
  VideoCoach eller navigerer væk i appen midt i, stopper sporingen (samme
  begrænsning som i dag, bare mindre synlig, fordi hun ikke længere ser en
  fremdriftsbjælke der minder hende om det).
- **"Vis mig nu" sporer sættet to gange.** Tre reps foreløbigt, otte reps
  bagefter i baggrunden — samme klip, samme stang, dobbelt CPU-/batteriforbrug
  sammenlignet med kun at køre standardvejen én gang. Bevidst valg (enkleste
  vej der virker), men værd at vide hvis batteri bliver et tema.
- **Tre-reps-hastighedstallet (~23-34s) er en ekstrapolering, ikke en
  device-måling.** Samme ærlige begrænsning som ORDRE 45/50's rigge: Node-
  rig-tiden måler algoritmens rene løbetid mod syntetiske frames, ikke en
  rigtig telefons video-decode/seek-omkostning. Jeg har ingen rigtig video
  og intet device at måle på i dette miljø. Forholdet (5,25×) er sandsynligvis
  en god retningsgiver, fordi tre vinduer rent faktisk søger forbi 5 af 8
  reps' videodata i stedet for at spore dem — men det ER en ekstrapolering.
- **Rep-forudsøgningen kræver en reel, om end kort, pause mellem reps.** Et
  helt igennem touch-and-go-sæt uden hvil ved toppen/bunden finder ingen
  interne ankre og falder tilbage til fuld analyse (verificeret i riggen) —
  "Vis mig nu" bliver da bare identisk med Start. Det er den rigtige,
  sikre fejlmåde (ingen forkert sporing), men det betyder at knappen ikke
  altid leverer det hurtige kig, den lover.
- **Mobil-gennemgangen kørte ikke i præcis 390px.** `resize_window`-værktøjet
  satte sig fast på ~500px bredde i denne session uanset hvilken værdi jeg
  bad om (afprøvet flere gange, også på en helt ny fane) — et værktøjs-
  miljøproblem, ikke noget jeg kunne løse ved at prøve igen. 500px er stadig
  smalt nok til at afsløre de tre fund ovenfor (de er alle POSITIONELLE
  kollisioner, ikke tekstombrydning, så de forværres kun ved en smallere
  skærm), men jeg har ikke bekræftet dem ved præcis 390px eller på en rigtig
  telefon.
- **Ingen rigtig video testet.** Som i 2026-09-03-audittet er der intet
  versioneret testklip i repoet. Jeg drev atlet-flowets tilstande direkte
  via `setAthleteState(...)` (tilgængeligt som globalt navn i sideskriptet,
  selvom det ikke hænger på `window`) i stedet for en ægte fil-upload — det
  tester UI/CSS-laget troværdigt, men IKKE hvordan et rigtigt kompressions-
  støjet klip opfører sig i selve trackeren eller forudsøgningen.
- **Note/belastning/RPE indtastes ikke længere før automatisk afsendelse.**
  Den gamle "Send til coach"-arket (løft/variation/belastning/notat) fyldes
  nu kun med hvad der allerede var sat, fordi commit 1 sender automatisk med
  det samme analysen er færdig — hun får ikke længere lejlighed til at skrive
  en note til coachen i det øjeblik. Bevidst afvejning for at holde
  standardvejen til "vælg video, send, færdig"; ikke bygget om, fordi
  ordren bad om minimal friktion i default-flowet.

## Betydning for Hara

Under "Appen mærkbart bedre": atletens oplevede ventetid for videosporing er
gået fra "2-3 minutter, skal overvåges, tryk Send bagefter" til "vælg video,
bekræft skiven, du er færdig — coachen får den, når den er klar", med en
ekstra, tydeligt mærket "se 3 af 8 med det samme"-vej for den, der vil se
noget straks. Tre reelle mobil-overlap i atlet-tilstanden er også rettet
undervejs.

## Hvad er næste

- Mål "Vis mig nu"s faktiske hastighed og forudsøgningens træfsikkerhed på
  en rigtig telefon med en rigtig optagelse, når det er muligt — Node-riggen
  er en målestok, ikke det sidste ord.
- Overvej en let, valgfri "tilføj en note bagefter" (fx fra beskeder/
  coach-fanen) siden auto-afsendelse fjernede den indtastning fra det
  øjeblik, hun sender.
- Gentag mobil-gennemgangen ved en ægte 390px-bredde, når
  `resize_window`-værktøjet virker pålideligt, eller på en rigtig enhed.
