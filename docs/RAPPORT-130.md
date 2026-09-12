# Rapport — Ordre 130: coachens side målt og gjort let

## Gren

`coachen-maalt` (fra `main` = `690edd7`). Fire commits:

- `e181a0e` — commit 1: `npm run maal:coach` (mål før)
- `7699e29` — commit 2: split `Dashboard.jsx` i lazy-chunks
- `10236b9` — commit 3: billige gevinster (trykflader, labels, tom check-in)
- (dette commit) — commit 4: mål efter, liste til Marc

## Hvad er ændret

**Commit 1.** Nyt script `scripts/maal-coach.mjs` (`npm run maal:coach`), bygget efter samme metode som `scripts/maal-app.mjs` (ordre 123): to profiler (iPad landscape 1180×820, desktop 1440×900 — begge over Dashboard.jsx's egen 768px isMobile-grænse, fordi Marc bruger coachsiden på netop disse to), ti skærme (atletliste med 12 attrap-atleter + tom variant, én atlets uge, check-in-gennemgang + tom variant, program-redigering med reps-interval-formular, Coach Briefing/indbakke + tom variant, videoer + tom variant). Måler Lighthouse (desktop-formfaktor), sidevægt, axe kritisk/alvorlig, ≥44px-trykflader, vandret scroll, tekst-overflow, og tid til interaktiv (Lighthouse "interactive"-audit) på atletlisten. Skærmene er isolerede harnesses med ægte, kopierede style-objekter/hjælpefunktioner fra `Dashboard.jsx` og attrap-data (samme princip som maal-app.mjs bruger for AthleteView) — Dashboard.jsx kræver en levende Supabase-session for at boote.

**Commit 2.** `Dashboard.jsx`'s tre tungeste dele udskilt til egne lazy-loadede chunks via `React.lazy` (samme `lazyWithReload`-genforsøgsmønster som `App.jsx` allerede brugte til selve Dashboard/AthleteView — nu udskilt til `src/lazyWithReload.js` så begge kan dele det):

- `src/dashboard/AnalyseTab.jsx` — video-review + træningsgrafer (analyse-fanen)
- `src/dashboard/ProgramTab.jsx` — ugeplan, sessioner, øvelsesformular (program-fanen)
- `src/dashboard/IndbakkeView.jsx` — Coach Briefing / indbakke (`view === 'inbox'`)

Delte stilarter og rene hjælpefunktioner (style-objektet `s`, `readinessSignal`, `initials`, video-status-konstanter m.fl.) flyttet til `src/dashboardShared.js`; de tre SVG-graf-komponenter (`LineChart`/`BarChart`/`ScatterPlot`) til `src/dashboardCharts.jsx` for sig selv, fordi ESLints `react-refresh/only-export-components` slår ud på en fil der blander komponent- og konstant-eksports. Ren udflytning — alle frie variable identificeret præcist med et scope-analyse-script (espree + eslint-scope, samme motor som ESLint selv bruger) og gjort eksplicitte som props; ingen logik ændret. Bygget og lintet i små skridt mellem hver udflytning, som ordren bad om.

Chunk-størrelser (npm run build, samme fiktive nøgler som maal:coach bruger):

| | Før | Efter |
|---|---|---|
| `Dashboard-*.js` | 342,01 KB | 246,37 KB |
| `AnalyseTab-*.js` | — | 46,85 KB (kun ved åbning af Analyse) |
| `ProgramTab-*.js` | — | 44,71 KB (kun ved åbning af Program) |
| `IndbakkeView-*.js` | — | 11,20 KB (kun ved åbning af Indbakke) |

Atletlisten og check-in-gennemgangen henter nu **~96 KB (28 %) mindre** JavaScript end før, fordi de aldrig rører video-review/program-redigering/indbakke-koden.

**Commit 3.** Billige gevinster fundet i FOER.md:

- `s.btnEdit` (bruges ~20 steder: "Rediger"/"Kopiér"/reorder-pile) løftet fra 18px til 44px min-height — samme tekst/farve, kun større trykflade.
- Program-fanens øvelsesformular (`exFormRow` — Navn/Sæt/Reps/Intensitet/Note, dét ordren kalder "reps som interval") løftet fra ~30px til 44px på alle fem felter.
- "Ny videoanalyse"-knappen i analyse-fanen løftet fra 25px til 44px.
- Reorder/rediger/slet-ikonknapper (↑/↓/✎/✕) på session- og øvelsesrækker i program-redigering fik `aria-label` — var kun et glyf uden tekst for skærmlæsere.
- Intensitetsvælgeren i øvelsesformularen fik `aria-label` (rettede axes kritiske "select-name"-fund).
- Check-in-gennemgang (oversigt-fanen) viste **intet** når atleten ikke havde logget check-in i dag (`return null`) — viser nu "Ingen check-in logget i dag endnu."

Fravalgt til Marcs liste (se `outputs/maal-coach/FORSLAG-TIL-MARC.md`): farvekontrast (bredt brugt designvalg, ikke en lokal rettelse) og de tætte godkend/ugyldig/del-knapklynger i video-reviewet (kræver omlægning af selve rækken, ikke kun mere padding).

**Commit 4.** `npm run maal:coach` kørt igen → `outputs/maal-coach/EFTER.md` med før/efter-diff pr. skærm/profil, plus `outputs/maal-coach/FORSLAG-TIL-MARC.md` (5 punkter der kræver Marcs dom).

## Testresultat

- `npm run lint`: **grøn** (0 fejl, samme 13 præ-eksisterende `react-hooks/exhaustive-deps`-advarsler som på `main` — ingen af mine ændringer tilføjede nye).
- Alle `verify:*`-scripts kørt: **grønne** (29 scripts, athlete-/videocoach-/coach-/n8n-familierne). `verify:videocoach-buttons-layout` fejlede én gang med en transient `ERR_NO_BUFFER_SPACE` (OS-netværksressource, urelateret til videocoach.html) — grøn ved gentagelse.
- `npm run build`: grøn, chunk-størrelser som ovenfor.
- `npm run maal:app`: kørt og bekræftet uændret grønt. Regenereringen (`outputs/maal-app/EFTER.*`) er **ikke** gencommittet — den hører til ordre 123's eget område, og en frisk kørsel afslørede kun at dét outputs allerede var forældet ift. ordre 126/127's rettelser (fx videocoach-knappernes trykflader), ikke noget jeg har ændret.
- `outputs/maal-coach/EFTER.md`: alle 6 tap-target-fund fra program-redigering er væk (6 → 0 på begge profiler), check-in-gennemgangs "Rediger"-fund væk (1 → 0), analyse-fanens axe-a11y-score op fra 74 til 92 på program-redigering (select-name rettet). De 3 resterende "Åbn"-trykflader i video-review-rækken er bevidst urørt (se Ærlige grænser).

## Hvad er næste

- Marcs dom på de 5 punkter i `outputs/maal-coach/FORSLAG-TIL-MARC.md`: farvekontrast-tokens, video-review-knapklyngens layout, "Åbn"-knappen i videokøen, om flere faner (log/stævne/kost) skal splittes yderligere, og om "Coach Briefing" faktisk skal være Indbakken eller en separat visning.
- Hvis Marc vil have de resterende trykflader rettet, kræver det en lille redesign-beslutning for video-review-rækken (fx to linjer, eller større knapper med kun ikon) — ikke en ren mål-og-ret-opgave.

## Ærlige grænser

- `scripts/maal-coach.mjs`'s ti skærme er **isolerede harnesses** (ægte, kopierede style-objekter og hjælpefunktioner, attrap-data) — ikke selve `Dashboard.jsx` renderet med en levende Supabase-session. Det gælder også commit 4's EFTER-tal: de viser at harnessens kopi af de rettede elementer nu er ≥44px, ikke en live-målt version af den ægte app. Jeg holdt harnessens kopierede stilarter synkroniseret med de ægte ændringer i commit 3 (samme filer, samme værdier), så tallene er retvisende for de konkrete rettelser — men en fuld, autentificeret gennemmåling af `Dashboard.jsx` er stadig ude af scope for dette script, af samme grund som for `maal-app.mjs`.
- "Coach Briefing" i ordren er tolket som Indbakken (`view === 'inbox'`, coachPriority/coachInboxState) — det er navnet der matcher nærmest i koden, men det er kun ~172 linjer, langt under video (~1000) og program (~960). Se punkt 5 i FORSLAG-TIL-MARC.md.
- Lighthouse-perf/TTI-tallene i FOER/EFTER.md svinger ±100-150 ms mellem kørsler på identisk kode (kendt Lighthouse-støj, samme mønster som maal-app.mjs's egne målinger) — brug dem som størrelsesorden, ikke som eksakte tal.
- Farvekontrast-fundene (axe "serious", 2-16 elementer pr. skærm) er bevidst urørt: de stammer fra farvetokens der bruges i hele appen (både coach- og atletsiden), og at ændre dem er en designbeslutning, ikke en lokal rettelse.
- Ingen atletdata brugt eller vist noget sted (attrap-atleter/attrap-data gennem hele ordren). Ingen ændring af datamodel, Supabase, migrations eller upload. `AthleteView.jsx`, `athlete*.js` og `videocoach.html` er ikke rørt. Ingen ny runtime-afhængighed (kun devDependencies der allerede lå i `node_modules` via eslint/playwright/lighthouse blev genbrugt). Ingen push.
- Under arbejdet blev det delte arbejdstræ midlertidigt skiftet til `main` og merget med `stille-fejl-5` (ordre 131) af en ekstern proces (formentlig Marcs egen git-arbejdsgang) — det påvirkede ikke `coachen-maalt`-grenens commits, men en baggrunds-`npm run maal:app`-kørsel nåede at starte på `main` i mellemtiden; dens output blev ikke brugt eller committet.

## Delmål (til Duta → Hara)

Arbejdet gør "Appen mærkbart bedre" håndgribeligt for coach-siden: Dashboard.jsx (appens største fil, aldrig tidligere målt) er nu målt på iPad og desktop, dens tre tungeste dele er lagt i lazy-chunks (28 % mindre at hente for atletliste/check-in), og seks konkrete tilgængeligheds-/trykflade-fund er rettet uden at ændre hvordan Marc arbejder.
