# Rapport — ordre 228: er de seks sekunder ægte? Produktionen målt, og de tunge moduler ud i chunks

## Gren

Gren `chunks-ud`, forgrenet fra `main` (`1e4cf14`, ordrens egen base — 226
allerede merget, live er stadig `162abc6`, Marc pusher).

- `57c18f0` — commit 1: produktionen målt, ikke antaget
- `d55acde` — commit 2: Volumenkortet ud i egen chunk
- `8362e67` — commit 3: næste sten efter commit 2, med tal
- (denne rapport er commit 4, se hash i `git log` efter commit)

Arbejdstræet er rent efter hver commit. Ingen push. Ingen produktions-
Supabase-skrivning. Ingen atletdata. `public/videocoach.html` og
`e2e/coach-sporing*` er ikke rørt.

## Hvad ændret

226 efterlod to åbne ting: om hele måleseriens ~6,2s TTI er kunstigt
pessimistiske (den lokale statiske server sender ukomprimerede bytes), og
om "tunge moduler ud af hovedbundtet" (201's tredje kandidat) er værd at
forsøge. Denne ordre lukkede begge, i rækkefølge.

Commit 1 afgjorde det første med et nyt script, `scripts/maal-produktion.mjs`
(`npm run maal:produktion`) — samme devtools-throttling-metode som
`maal-kaeden.mjs` (226), men mod `https://app.entropicoaching.dk` selv.
Ordrens egne grænser (ingen atletdata, ingen produktions-legitimations-
oplysninger til rådighed) gjorde de tre autentificerede skærme unåelige;
valget (notér-og-fortsæt, se `docs/VALG-228.md`) blev at måle login-/
landingsskærmen på begge sider (lokal ukomprimeret vs. ægte produktion), så
komprimering er den reelle forskel, plus et direkte `fetch()`-headertjek af
hovedscriptet. Et metodefund undervejs: genbrug af samme Chrome-proces på
tværs af de 5 løb gav 4 af 5 løb "0 bytes over ledningen" mod ægte
produktion (Lighthouses egen storage-reset ryddede ikke HTTP-cachen mellem
løb) — rettet med en frisk Chrome-proces pr. løb (kold cache/DNS/TLS hver
gang), en del af det committede script. Resultat: produktionen serverer
GZIP (bekræftet via `content-encoding`-header, ~28,5 % af rå størrelse,
~3,5× mindre over ledningen). Login-skærmens TTI: 2204ms på ægte produktion
mod 3426ms lokalt ukomprimeret — selvom produktionens bundt (`162abc6`, før
226) er STØRRE end den nuværende lokale build. Et estimat (ikke direkte
målt — login mangler) for de tre autentificerede skærme, ud fra Vites egne
gzip-tal: sandsynligvis 3-4s, ikke de lokalt målte ~6,2s. Afstanden til 2s
er altså mindre end antaget, men ikke lukket — commit 2 fortsatte, men i et
mere afmålt omfang end en fuld omskrivning ville have krævet.

Commit 2 fandt at `VolumenKort.jsx` (177/185/209/210, "muskelkortet") var
den klareste, sikreste kandidat af 201's tredje forslag: statisk importeret
i `Dashboard.jsx` selvom den kun renderes på 'oversigt'-fanen i en atlets
profil (aldrig ved coachens første tegning af atletlisten), og den trækker
hele `src/volume/`-træet med sig — inklusive en 53 kB genereret
kortlægnings-JSON (`muskelkort.generet.json`, "den tunge datafil" ordren
nævnte). Rettelsen genbruger PRÆCIS samme `LazyBoundary`-mønster som de tre
eksisterende fane-factories (Indbakke/Analyse/Program, 130/163): en ny
`volumenKortFactory`, den statiske `import VolumenKort from
'./dashboard/VolumenKort'` fjernet, brugsstedet pakket i `<LazyBoundary
factory={volumenKortFactory} .../>`. Ét sammenhængende, velprøvet mønster —
ingen ny abstraktion. (De øvrige kandidater — "videocoach-relaterede
moduler" og "PDF/CSV-værktøj" — blev vurderet og fravalgt for denne ordre:
PDF/CSV-værktøj findes slet ikke i kodebasen; video-coach-modulerne i
`Dashboard.jsx`/`AthleteView.jsx` er spredt over 10+ kaldsteder i to
4800-6600-linjers filer uden en eksisterende opsplitningsstruktur at hægte
sig på — for stort og risikabelt et greb til at "gøre commit 2 mindre"
tillod, se `docs/VALG-228.md`.) `Dashboard`-chunken faldt fra 328,34 kB til
247,79 kB rå (75,90→62,15 kB gzip); den nye `VolumenKort`-chunk vejer 80,78
kB rå/13,92 kB gzip, hentet først når fanen faktisk åbnes. Målt med
`npm run maal:kaeden`: Atletliste (coach) −500ms (6175→5675ms), Dagens
pas/Check-in uændret (±34ms støj — Volumenkortet rører aldrig atlet-siden).
Verificeret manuelt i headless browser (login som coach, klik ind på en
atlet, åbn 'Oversigt'-fanen via "Mere"-menuen): kortet renderer fuldt
udfyldt, ingen konsolfejl, chunken hentes først ved fanevalget.

Commit 3 tog et nyt ad hoc-vandfald (samme metode som 226, ikke committet
som kode) for begge sider efter commit 2. Atletliste: FCP/LCP 5053ms, TTI
5682ms, alle scripts færdige 4737ms (83 % af TTI). Dagens pas: FCP 4888ms,
TTI 6236ms, scripts færdige 4768ms (76 %). Mainthread-arbejdet er stadig
lille (TBT 14ms på Atletliste) — eksekvering er fortsat ikke problemet.
**Den ene største post, navngivet med tal: script-overførslen selv, stadig
~76-83 % af TTI** — samme mønster som 226 (dengang 84 %), bare et lavere
absolut tal efter Volumenkortets udspaltning. Størstedelen er nu `index`
(359 kB, uændret af denne ordre) plus ÉN uspaltet skærmchunk (`Dashboard`
248 kB eller `AthleteView` 251 kB, næsten identisk størrelse).
`AthleteView.jsx` (6598 linjer) har INGEN intern faneopsplitning i dag, i
modsætning til `Dashboard.jsx`s tre `LazyBoundary`-faner — den næste
konkrete, unavngivne kandidat, uden for denne ordres omfang. Bifund: på
Atletliste er Supabase-kaldene overvejende serialiserede og strækker sig
til 6794ms — senere end det rapporterede TTI-tal, værd at vide for en
fremtidig ordre. Intet greb forsøgt mod nogen af delene, jf. commit 3's
egen grænse.

## Testresultat

`npm run lint`: rent ved alle tre kodecommits (commit 3 er kun docs).

Enhedstest (`node --test "src/**/*.test.js"`): alle 231 grønne, kørt efter
commit 2's kodeændring.

Alle 34 `verify:*`-scripts: grønne, kørt efter commit 2.

`npm run e2e`: grøn (26,5s), kørt efter commit 2.

`npm run build`: grøn ved alle commits, bundtstørrelser rapporteret under
"Hvad ændret".

`npm run maal:produktion` (commit 1) og `npm run maal:kaeden` (commit 2,
label `228-commit2-efter`): kørt, tallene står under "Hvad ændret" og i
`docs/VALG-228.md`.

## Hvad er næste

1. `AthleteView.jsx` (6598 linjer, uspaltet, 251 kB rå/59,45 kB gzip) er nu
   den tydeligste tilbageværende kandidat af samme klasse som Volumenkortet
   — men kræver en intern faneopsplitningsstruktur den ikke har i dag
   (i modsætning til `Dashboard.jsx`), et større og mere risikabelt greb
   der fortjener sin egen, afgrænsede ordre.
2. Video-coach-modulerne statisk importeret i `Dashboard.jsx`/
   `AthleteView.jsx` (spredt over 10+ kaldsteder) er stadig uafprøvede som
   dynamic-import-kandidater — samme begrundelse som punkt 1.
3. Supabase-kaldenes serialisering (fundet i commit 3's vandfald: strækker
   sig til 6794ms på Atletliste, senere end det rapporterede TTI) er en
   anden klasse fejl end script-vægt — værd sin egen undersøgelse.
4. Produktionsmåling af de TRE autentificerede skærme direkte (ikke kun
   login-skærmen) kræver enten ægte, sanktionerede test-legitimations-
   oplysninger til produktion, eller Marcs egen, manuelle måling — ingen af
   delene var til rådighed for denne ordre.

Tre linjer til Marc: Din telefon burde føles LIDT hurtigere som coach når du
åbner atletlisten (cirka et halvt sekund mindre ventetid, målt lokalt) —
Volumenkortet på en atlets Oversigt-fane henter nu kun sig selv når du
faktisk åbner den fane. Den store nyhed er dog: produktionen komprimerer
allerede sine filer kraftigt (til under en tredjedel), så den virkelige
ventetid på din telefon er sandsynligvis markant kortere end de ~6
sekunder, målingerne herfra har vist siden 175 — nok nærmere 3-4 sekunder,
ikke direkte målt men velbegrundet. Næste konkrete skridt hedder
"AthleteView.jsx (Dagens pas/Check-in) mangler den samme opsplitning
Dashboard.jsx allerede har" — en større, egen ordre.

## Ærlige grænser

- Commit 1 måler IKKE de tre navngivne, autentificerede skærme direkte mod
  produktion — kun login-/landingsskærmen (den eneste nåelig uden ægte
  produktions-login, som ordrens egne grænser forbød at omgå). De 3-4
  sekunders estimat for de autentificerede skærme er et velbegrundet,
  tydeligt mærket regnestykke (Vites egne gzip-tal × det bekræftede
  produktions-komprimeringsforhold), IKKE en direkte måling. Se
  `docs/VALG-228.md` for hele udregningen og dens forudsætninger.
- Produktionens hovedbundt (`162abc6`) er FØR 226's Realtime-fjernelse,
  altså større end den nuværende lokale build — sammenligningen i commit 1
  er derfor konservativ til produktionens ULEMPE, ikke pyntet til dens
  fordel.
- Commit 2's Volumenkort-verifikation (coach → atlet → Oversigt-fane) er
  gjort manuelt i en ikke-committet headless-kørsel, ikke som en permanent
  e2e-prøve — 'oversigt'-fanen havde ingen eksisterende e2e-dækning før
  denne ordre, og ordren bad ikke om at tilføje en. Fanens indhold blev set
  fuldt renderet, korrekt udfyldt, ingen konsolfejl — men kun det ene
  gennemløb, ikke gentaget over tid.
- Commit 3's vandfald er ét løb pr. skærm (ikke median af 5 som
  `maal:kaeden`), samme ad hoc-metode og samme grænse som 226's tilsvarende
  fund — retningen er pålidelig, det præcise enkelttal kan variere nogle
  hundrede ms mellem kørsler.
- Har betydning for Hara (mærkbart bedre-sporet): denne ordre lukkede den
  vigtigste ÅBNE USIKKERHED fra 226 (er målingerne ægte?) med et klart,
  positivt svar — produktionen er hurtigere end måleserien har vist siden
  175, fordi komprimering allerede virker. Den fjernede også en konkret,
  bekræftet bundtvægt (Volumenkortet, atletliste-skærmen −500ms lokalt).
  2s-målet er STADIG ikke nået, men afstanden er nu bedre forstået og
  mindre skræmmende end de rå ~6,2s antydede — værd for Hara at vide før
  næste greb (AthleteView.jsx's opsplitning) prioriteres.
