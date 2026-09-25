# Rapport: ordre 377, coachens rækkefølge som mailens, og Dashboard.jsx delt i moduler

Ordren havde tre blokke. (1) Appens coach-kø skulle have samme rækkefølge
som Coach Briefing-mailen. (2) Et kort over `src/Dashboard.jsx` og en
sikkerhedslinje før flytning. (3) Selve flytningen, uden at coachen mærker
noget, med bevis. Resultat: køen følger nu mailen (smerte, fravær,
afvigelse fra plan, beskeder/videoer, fremgang), testet på de syntetiske
atleter fra 370. `Dashboard.jsx` er gået fra 6.271 til **762 linjer** (mål:
under 800) plus 35 nye moduler i `src/dashboard/`. Alle 45 kontroller består
både før og efter. 33 af 35 skærmbilleder har 0 % afvigelse, og de to
sidste afviger kun i indbakkens ur. 5.499 flyttede linjer er genfundet tegn
for tegn.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): **ja.** Blok 1 kan coachen mærke direkte: den atlet, mailen sætter øverst (fx smerte), står nu også øverst i Coach Briefing i appen, og ikke under en ulæst besked. Blok 2–3 mærker ingen (det var kravet). Gevinsten er, at fremtidige coach-ordrer (briefing, VideoCoach-analysen, programmer) kan nøjes med at læse den ene fil, der passer (typisk 30–600 linjer), frem for 6.271 linjer. Ordre 325 læste filen 12 gange.

## Gren

Gren `dashboard-moduler`, forgrenet fra `main` (`c8aa336`, 373 merget). 18 commits:

- Blok 1: `4398aa8` coachPriority som mailen, `f1eaa83` verify:coach-inbox-flow til den nye rækkefølge, `5e17eb0` Coach Briefings forklaringstekst
- Blok 2: `bd3a736` kortet og sikkerhedslinjen FØR
- Blok 3: `5394be1` de fire tekst-tjek læser `scripts/dashboardKilde.mjs` · `d3debaf` rene hjælpere og konstanter · `eca1f92` læsninger · `5b49f1d` navigation · `73d4fc1` indbakke-handlere · `7bfe865` video-review-handlere · `63f426c` atlet-handlere og AI-rapport · `310cfc7` program- og kalender-handlere · `bdba3db` VideoCoach-broen som hook · `4657094` bibliotek, kalender, forside, profilfaner og tre modaler · `ca41b30` overlays, sidebar, mobilnav, profilhoved · `aeab72d` ugedagsvælger, øvelsesformular, blok-editor, profiltal · `4fd70ee` effekterne og køen som hooks, lint · plus commit'en med denne rapport, kortet og EFTER-beviset

## Hvad ændret

**Blok 1.** `src/coachPriority.js` rangerer nu med mailens tabel
(`DETECTOR_RANK`/`signalRank` fra `coachBriefingRules.js`, som n8n spejler):
smerte 0 · fravær 1 · afvigelse fra plan 2 · beskeder/videoer 3 · fremgang (PR)
4, alert før context inden for samme rang (+0,5). Ved lige rang: ældste
besked/video, så atletens navn, som i mailen. Før var det "alert 0,
besked/video 1, automatiseringsfejl 2, context 3". En automatiseringsfejl
findes ikke i mailen. Mit valg: den står efter beskeder/videoer og før
fremgang (rang 3,75). Nye tests i `src/coachPriority.test.js` (6 tests på
fixturerne a–g): appens rækkefølge er lig `briefingOrder`, uanset kildens
rækkefølge. `verify:coach-priority`, `verify:coach-inbox-flow` og
`automationAlerts.test.js` forventer den nye rækkefølge. Coach Briefings
forklaring ("Alerts først · …") siger nu "Som mailen: smerte · fravær ·
afvigelse fra plan · beskeder og videoer · fremgang."

**Blok 2.** `docs/DASHBOARD-KORT.md` (FØR-kortet: dele, linjeintervaller,
afhængigheder, snit). `outputs/377/foer.json`: build, lint og alle 43
`verify:*` (samme runner som 373). 35 headless skærmbilleder
(`outputs/377/skaermbilleder.mjs`) på 1280 og 390 px mod den ægte app og
e2e-mocken, kun med seedens syntetiske data plus tre opdigtede beskeder:
forside, Coach Briefing, kalender, bibliotek, værktøjer/menu, profilens ti
faner, "Gennemgå måling", stævneresultat og (390) ny atlet.

**Blok 3.** 35 nye filer i `src/dashboard/`, alle flyttet uændret (kun
import/export og en omsluttende funktion er nye):

- Handler-fabrikker (`lavX(ctx)`, kaldt i hvert render før effekterne): `laesninger.js`, `navigation.js`, `indbakkeHandlinger.js`, `videoReviewHandlinger.js`, `atletHandlinger.js`, `aiRapport.js`, `programHandlinger.js`, `profilTal.js`.
- Hooks, kaldt nøjagtig hvor koden stod (samme effekt-rækkefølge): `useVideoCoachBro.js`, `useDashboardEffekter.js`, `useCoachPrioritet.js`.
- Komponenter med samme navne som props: `ForsideView`, `KalenderView`, `BibliotekView`, `ProfilHoved`, `HubTab`, `OversigtTab`, `KostTab`, `LogTab`, `OpvarmningTab`, `StaevneTab`, `NoterTab`, `BeskederTab`, `VideoReviewModal`, `StaevneResultatModal`, `NyAtletModal`, `Sidebar`, `MobilNav`, `Overlays`, `WeekdayPicker`, `ExFormRow`, `BlockSequenceRows`.
- Rene moduler: `coachVideoHjaelp.js`, `coachKonstanter.js`, `hubSektioner.jsx`.

For skærme med en betingelse står `{view === 'x' && (() => {` og slutlinjen
uændret i Dashboard, og kun kroppen er flyttet. Så dækker flytte-tjekket
også JSX'en. Alle frie navne er fundet af ESLints `no-undef`, ikke gættet.
Et tjek af alle fabrik- og hook-kald viser 0 navne, der bruges før deres
erklæring. De fire tekst-tjek, der læste `Dashboard.jsx`, læser nu
`dashboardKilde()`: filen + de nye moduler (fast liste). Regex'erne er
uændrede. `docs/DASHBOARD-KORT.md` er omskrevet til det nye kort med en
"Læs KUN src/dashboard/X"-tabel.

## Testresultat

- `node outputs/377/koer-verify.mjs foer|efter`: **foer 45/45, efter 45/45, samme scripts bestået** (build, lint, 43 × verify). Første FØR-kørsel fejlede `verify:coach-inbox-flow`, fordi jeg havde glemt det script i blok 1. Det blev rettet (`f1eaa83`) og kørt om. Udfaldet er bevaret i `foer.json` under `foersteKoersel`. EFTER bestod alle i første kørsel.
- `node --test` på alle `src/**/*.test.js`: 393/393 (efter blok 1). `src/coachPriority.test.js`: 6/6.
- Pixel-sammenligning (`node outputs/377/sammenlign.mjs`, pixelmatch, threshold 0): **33 af 35 skærme 0 %**. `1280-02-coach-briefing` 0,0036 % og `390-02-coach-briefing` 0,0064 %: forskellen ligger præcis på linjen "Opdateret kl. HH.MM" (minuttallene). To FØR-kørsler afviger samme sted (0,0013 % / 0,003 %, `pixel-foer-foer2.json`), så det er uret, ikke koden.
- `node outputs/377/flytte-tjek.mjs`: **5.499 linjer flyttet uændret, 0 forsvundne linjer ikke genfundet** (multimængde, samme indrykning, uden importlinjer).
- e2e efter opdelingen, alle grønne: `npm run e2e` (atlet → coach, 31,3 s), `e2e:coach-automation-alerts`, `e2e:coach-briefing-seen`, `e2e:coach-mandagsrunden`, `e2e:coach-afvigelse`, `e2e:coach-ser-maaling`.
- Bundtstørrelse (`npm run build`, målt pr. chunk med sourcemaps): coach-chunken `Dashboard` **257,13 → 283,21 kB (gzip 64,88 → 72,75)**. Blok 1 alene: 257,34 kB (gzip 64,93), så opdelingen koster +25,9 kB (gzip +7,8). `IndbakkeView` +0,02 kB (den nye tekst). Alle andre chunks er uændrede. Atletens chunks er ikke berørt. NB: listen i `efter.json` viser `ProgramTab` 46,01 → 32,04 kB. Det er en navnekollision i runnerens liste (atletens og coachens `ProgramTab` hedder det samme), ikke en ændring: coachens `ProgramTab` er 46,06 → 46,05 kB.

## Hvad er næste

1. **Coach-ordrer skriver "Læs KUN src/dashboard/X"** ud fra tabellen i `docs/DASHBOARD-KORT.md`. Ny tilstand eller en ny prop kræver `Dashboard.jsx` (762 linjer). Ny fil under `src/dashboard/` skal føjes til `scripts/dashboardKilde.mjs`.
2. De største coach-filer er nu `AnalyseTab.jsx` (1.050) og `ProgramTab.jsx` (1.015), begge urørt. Skal VideoCoach-analysen eller programmerne have mange ordrer, er de næste kandidater til samme metode.
3. Bundtet: mål `maal:coach`/`maal:coach-telefon` på grenen før merge, hvis de +7,8 kB gzip skal vurderes i tid og ikke kun i bytes.

## Ærlige grænser

- **Blok 1 ændrer, hvad coachen ser først.** Et context-signal om afvigelse (fx stagnation) står nu over en ulæst besked, og en PR står under den. "Alerts først" gælder ikke længere på tværs af typer. Det er ordren, men det er en synlig adfærdsændring. Automatiseringsfejlens plads (efter beskeder/videoer, før fremgang) er mit valg. Før stod den over alle context-signaler.
- **Jeg glemte to steder i blok 1:** `verify:coach-inbox-flow` og indbakkens forklaringstekst. Sikkerhedslinjen fangede det første, og FØR-skærmbillederne fangede det andet. Begge er rettet i egne commits før blok 2. FØR-billederne er taget efter rettelsen.
- **Bundtet voksede med 25,9 kB (7,8 kB gzip)** i coach-chunken. Kun coachen henter den. Årsagen er den samme som i 373: fabrikkernes, hooks'enes og komponenternes navnelister er objekt-nøgler, som minifieren ikke forkorter, og her er der flere af dem. Indlæsningstid er ikke målt.
- **Lint ser nu kode, den ikke så før.** På `main` gav `Dashboard.jsx` 0 fund. Efter opdelingen kan React Compiler-reglerne analysere `Dashboard`, og de melder mønstre, der fandtes allerede. 16 nye direktiver, alle med begrundelse: én `refs`-blok om fabrikskaldene, 3 × `refs` (startvisning læst fra en ref, `showFlash`/`askConfirm` givet som props), 2 × `purity` (`Date.now()` i render) og 10 × `exhaustive-deps` i de nye hooks. Compileren kører ikke i build. Mellem-commits i blok 3 er bygget grønt hver for sig, men lint er først grøn fra `4fd70ee`. Ordren krævede build efter hvert modul, og lint-rydningen er gjort én gang til sidst.
- **Ikke fotograferet:** toast, bekræft-modal, "Fjern atlet"-modalen, VideoCoach-iframen, "Se som atlet"-vælgeren, kalenderens dato-panel og blok-bygger i åben tilstand, beskedfejl-tilstande og Ny atlet på desktop (den findes kun i mobilens menu). De er flyttet uændret (flytte-tjekket dækker dem), og flere køres af e2e (toast, "Set", automatiseringsfejl, måling), men de er ikke pixel-sammenlignet.
- **Små flytninger ud over ren tekst:** fire komponenter (sidebar, mobilnav, overlays, profilhoved) returnerer deres linjer i et fragment (ingen DOM-ændring). `weekdayPicker`, `exFormRow` og `blockSequenceRows` returnerer nu et komponent-element i stedet for rå JSX (samme DOM, et ekstra niveau i React-træet, ingen egen tilstand). `lavProfilTal` regnes nu før effekterne i stedet for efter køen (rene beregninger). `verify:auth-logout-role-switch` fik CRLF-normaliseringen med over på den samlede kilde.
- **Uden for "Læs KUN"-listen** har jeg læst: `scripts/verify-coach-priority.mjs`, `verify-coach-inbox-flow.mjs`, `automationAlerts.test.js`, rang-afsnittet i `n8n/build-coach-briefing.code` og `coachBriefingRules.js`, de fire tekst-tjeks Dashboard-linjer og login-delen af `e2e/coach-briefing-seen.spec.mjs`. Det var nødvendigt for at teste blok 1 og bygge sikkerhedslinjen.
- `e2e:coach` alene fejler (venter på `#athlete-auth-email`), men den fejler på samme måde på `main`. Den er ikke undersøgt. Den samlede `npm run e2e` er grøn.
- `verify:ugen-faar-dato` overskriver committede leverancebilleder i `outputs/ugen-faar-dato/` med dagsdatoen. De er sat tilbage med `git checkout`. Ingen af dem hører til leverancen.

main kan pushes: ja
