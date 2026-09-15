# Rapport — ordre 232: AthleteView i faner, 6.598 linjer bliver til dele der hentes når de bruges

## Gren

Gren `athleteview-faner`, forgrenet fra `main` (`ea8618e`, ordrens egen base
— din 225 og Vaidyas 228 allerede merget, live er stadig `162abc6`).

- `c5d22b2` — commit 1: kortet over `AthleteView.jsx`, ingen kodeændring
- `70b3865` — commit 2: mobilitet + stævnedag ud i lazy chunks
- `de1a35d` — commit 3: program + kost + beskeder ud i lazy chunks
- (denne rapport er commit 4, se hash i `git log` efter commit)

Arbejdstræet er rent efter hver commit. Ingen push. Ingen produktions-
Supabase-skrivning. Ingen atletdata. `src/Dashboard.jsx`, `src/supabase.js`
og datahentningen (Vaidyas område, ordre 231) er ikke rørt.

## Hvad ændret

228 navngav `AthleteView.jsx` (6.598 linjer, 251,10 kB rå/59,45 kB gzip) som
den tydeligste tilbageværende kandidat af samme klasse som Volumenkortet —
hentes helt før atleten ser sit første pas, uden den interne faneopsplitning
`Dashboard.jsx` allerede har. Commit 1 kortlagde filen (`docs/ATHLETEVIEW-
KORT.md`): en `tab`-state og `NAV_ITEMS`-array fandtes allerede (seks faner:
hjem/program/kost/mobilisering/beskeder/stævnedag), bare aldrig hægtet på
`LazyBoundary` (215/163). Mobilitetsfanen pegede sig selv ud som den tungeste
kandidat — ~1.325 linjer (20 % af filen), mest statiske øvelsesdata
(`WARMUP_BASE`/`WARMUP_ADDONS`/`MOBILITY_LIBRARY`) der aldrig rammer skærmen
før atleten selv vælger fanen. Stævnedag var lettere men endnu sjældnere:
kun synlig i navigationen for atleter med stævnedato/-plan sat.

Commit 2 flyttede mobilitet og stævnedag til `src/athlete/MobiliseringTab.jsx`
og `src/athlete/StaevnedagTab.jsx`, PRÆCIS samme `LazyBoundary`-mønster som
Dashboard.jsx's fire faner (130/163/228): ren udflytning af JSX'en, ALLE frie
variable gjort eksplicitte som props (som `ProgramTab.jsx`/`AnalyseTab.jsx`
allerede gør i Dashboard) — ingen logikændring, ingen ny global tilstand.
`s` (stilarterne) og `CountdownRing` udskilt til `athleteShared.js` hhv.
`athlete/CountdownRing.jsx` (react-refresh tillader kun komponent-eksporter i
en JSX-fil). Gevinsten var reel og målt: chunken faldt til 178,64 kB rå
(43,03 kB gzip), Dagens pas/Check-in -398/-453ms TTI.

Commit 3 fortsatte derfor (ordrens egen regel: reel gevinst → fortsæt) med de
tre resterende faner — program, kost, beskeder — samme mønster, hver sin fil
i `src/athlete/`. `ExerciseTimer`/`parseDuration`/`RPE_VALUES`/`blockColor`/
`computePhases` var kun brugt af programfanen og flyttede helt ind i
`athlete/ProgramTab.jsx`; `today`/`shiftDate`/`dateLabel`/`unitsForFood` er
brugt af BÅDE hjem (eager) og kost og blev udskilt til `athleteShared.js` i
stedet. Skrivefunktionerne (`logSet`, `skipSet`, `quickLogFood`, `deleteLog`,
...) blev i `AthleteView.jsx` og sendes ned som props — verify:athlete-write-
failures's garanti (F1-G3, ordre 41/64/68) rører derfor ikke ved dem. Fem
andre `verify:*`-scripts pegede statisk ind i `AthleteView.jsx` på tekst/
struktur der flyttede med fanerne; alle fem opdateret til at læse fra den nye
fil, SAMME tjek, ikke svækket (se hvert scripts egen kommentar for hvilken
commit der rørte det): `athlete-rest-timer-drift`, `athlete-tap-targets`,
`athlete-first-day-flow`, `athlete-read-failures`, `athlete-jargon-explained`.

Alt data-tabellerne fra mobilitetsfanen (`WARMUP_BASE` m.fl.) blev VERIFICERET
mekanisk, ikke bare eyeballet: et lille, ikke-committet script (acorn/acorn-
jsx, allerede en eslint-afhængighed) parsede hver udflyttet JSX-blok og
udregnede dens frie variable — sammenlignet linje for linje mod de props
`AthleteView.jsx` rent faktisk sender ned. Nul afvigelser i nogen af de fem
faner. `HJEM`-fanen (default, "Dagens pas") og de ~2.100 linjer delt
state/effekter/skrivefunktioner ALLE faner deler er bevidst IKKE rørt —
samme grænse ordren selv satte.

| Chunk | Før (ordre 232 base) | Efter commit 2 | Efter commit 3 |
|---|---|---|---|
| `AthleteView` | 251,10 kB / 59,45 kB gzip | 178,64 kB / 43,03 kB gzip | **120,34 kB / 32,96 kB gzip** |
| `athlete/MobiliseringTab` | — | 60,55 kB / 14,67 kB gzip | 60,58 kB / 14,70 kB gzip |
| `athlete/StaevnedagTab` | — | 14,41 kB / 3,53 kB gzip | 14,40 kB / 3,53 kB gzip |
| `athlete/ProgramTab` | — | — | 32,32 kB / 8,37 kB gzip |
| `athlete/KostTab` | — | — | 24,00 kB / 5,35 kB gzip |
| `athlete/BeskederTab` | — | — | 6,32 kB / 2,05 kB gzip |
| `athlete/CountdownRing` | — | — | 1,35 kB / 0,65 kB gzip |

`AthleteView`-chunken selv: **-52 % rå / -45 % gzip** fra ordrens base. De nye
chunks hentes kun når atleten faktisk åbner fanen (bekræftet manuelt, se
Testresultat).

TTI (`npm run maal:kaeden`, samme devtools-throttling-metode som 226/228):

| Skærm | Før | Efter commit 2 | Efter commit 3 |
|---|---|---|---|
| Atletliste (coach) | 5820ms | 5838ms | 6025ms |
| Dagens pas (atlet) | 6385ms | 5987ms (-398ms) | **5749ms (-636ms, ~10,0 %)** |
| Check-in (atlet) | 6403ms | 5950ms (-453ms) | **5743ms (-660ms, ~10,3 %)** |

Atletliste (coach) er støj (±200ms på tværs af alle tre målinger) — den
skærm bruger kun `Dashboard.jsx`, uændret af denne ordre; tallet er med for
gennemsigtighed, ikke fordi en ændring var ventet der.

## Testresultat

`npm run lint`: rent ved alle fire commits (commit 1 og 4 er kun docs).

Enhedstest (`node --test "src/**/*.test.js"`): alle 231 grønne, kørt efter
commit 2 og igen efter commit 3.

Alle 34 `verify:*`-scripts: grønne efter commit 2 og igen efter commit 3
(fem opdateret undervejs, se "Hvad ændret").

`npm run e2e`: grøn (27,5s efter commit 2, 28,5s efter commit 3).

`npm run build`: grøn ved alle commits, chunkstørrelser i tabellen ovenfor.

Manuel headless klik-igennem (Playwright, samme metode som RAPPORT-228,
ALDRIG OS-musen — engangs-scripts, ikke committet): login som atlet, klik
gennem alle seks faner (opvarmning + daglig mobilitet under Mobilitet,
stævnedag-standby under Stævne efter at have sat `competition_date` i
seeden, ugeplan + session under Program, søgning under Kost, tråd under
Beskeder). Alle syv nye chunks (fem faner + CountdownRing, ProgramTab talt
med) bekræftet hentet over netværket (200), nul browser-fejl i alle
gennemløb.

## Hvad er næste

1. VideoCoach-modulerne (postMessage-håndtering + kortet i HJEM-fanen,
   ~1937-2161/4454-4502 i den oprindelige linjenummerering) er stadig
   spredt over 10+ kaldsteder i den delte 2.100-linjers blok, som RAPPORT-228
   allerede vurderede: for stort og risikabelt et greb, og ikke en "tung,
   sjælden" fane i samme forstand (vises i HJEM, den mest brugte fane).
   Uændret vurdering, ikke forsøgt her.
2. `LOCAL_FOODS`/`PORTION_UNITS` (kost-database, ~220 linjer) blev IKKE
   flyttet ud af `AthleteView.jsx` — de bruges kun af søgehandleren
   (`onSearchInput` m.fl.), som blev i hovedfilen sammen med de øvrige
   skrivefunktioner (bevidst valg, se "Ærlige grænser"). En fremtidig ordre
   kunne flytte selve søgehandleren ind i `KostTab.jsx` for at få denne
   sidste bid med — mindre gevinst end commit 2/3 (kun ~220 linjer), ikke
   forsøgt her.
3. HJEM-fanen (default, "Dagens pas") er bevidst urørt — den SKAL være
   eager. Ingen yderligere kandidat tilbage i `AthleteView.jsx` af samme
   klasse som de fem udflyttede.
4. Supabase-kaldenes serialisering (RAPPORT-228's commit 3-bifund: strækker
   Atletlistens reelle klar-tid til 6794ms, senere end det rapporterede
   TTI) er stadig uundersøgt — en anden klasse fejl end script-vægt.

Tre linjer til Marc: AthleteView (atletens hele app — Dagens pas, Program,
Kost, Mobilitet, Beskeder, Stævne) er nu splittet i seks dele ligesom
Dashboard allerede var — atleten henter kun de ~120 kB fanen "Hjem" selv
kræver, resten først når de rent faktisk trykker på en fane. Målt lokalt:
Dagens pas og Check-in er omkring et halvt sekund hurtigere at blive klar
til brug (~10 %). Næste konkrete skridt er navngivet ovenfor, men ingen af
dem er i samme størrelsesorden som denne ordre — AthleteView er den sidste
STORE skærm af sin slags.

Betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): denne
ordre lukker den næststørste tilbageværende "uspaltet skærm"-kandidat efter
Dashboard.jsx (228) — begge appens to hovedskærme har nu samme interne
faneopsplitning. Målt, ikke antaget: atletens to mest brugte skærme
(Dagens pas, Check-in) er ~10 % hurtigere klar til brug.

## Ærlige grænser

- TTI-tallene er fortsat mock-mod-lokal (samme metode/samme grænser som
  226/228): ingen ægte produktions-Supabase, ingen ægte netværksvej, ingen
  ægte atletdata. Den RELATIVE forbedring (kortere script-overførsel giver
  kortere TTI) er dog en direkte konsekvens af mindre bytes over ledningen —
  samme fysik som gjorde 228's Volumenkort-tal troværdige.
- `LOCAL_FOODS`/`PORTION_UNITS`/sæge-handlerne blev bevidst IKKE flyttet
  (se "Hvad er næste", punkt 2) — en mindre, ikke-forsøgt gevinst,
  ikke en fejl, men værd at nævne præcist.
- Den mekaniske frie-variabel-verifikation (acorn/acorn-jsx) dækker
  IDENTIFIER-niveauet (ingen manglende/overflødige props) — den beviser IKKE
  at hver fane opfører sig pixel-for-pixel som før. Det er e2e/verify/manuel
  klik-igennem der bærer den garanti her, ligesom i 130/163/228.
- Stævnedag-fanens fulde forsøgs-logger (SBD-toggle, `markGoodAndSave`s
  RPC-kald) blev IKKE klikket igennem manuelt med en rigtig `meet_plans`-
  række i mock-seeden — kun standby-grenen (ingen stævneplan endnu, den
  gren de fleste atleter rent faktisk ser). `verify:athlete-write-
  failures` dækker `markGoodAndSave`s skrive-garde statisk; den fulde
  UI-gren er IKKE manuelt bekræftet i browser denne gang.
