# RAPPORT-137 — 130 lagt oven på 131, og videoklyngen på coachens side

## Gren

`coachen-maalt`, rebaset på `main` (`3f0e13b`, ordre 131 med). Seks commits:

- `49626e6` — ordre 130 · commit 1: `npm run maal:coach` (mål før)
- `ef32cb5` — ordre 130 · commit 2: split `Dashboard.jsx` i lazy-chunks (nu inkl. rebase-konfliktløsningen mod ordre 131, se nedenfor)
- `5ad3e82` — ordre 130 · commit 3: billige gevinster (trykflader, labels, tom check-in)
- `731fe59` — ordre 130 · commit 4: mål efter + liste til Marc
- `02bcfe3` — **ordre 137 · commit 2**: video-review-rækkens tre "Åbn"-knapper til 44px
- `2cd0a3f` — **ordre 137 · commit 3**: `docs/COACH-BRIEFING-PLACERING.md`

## Hvad ændret

**Commit 1 (rebasen, tæller som ordre 137's del 1).** `git rebase main` flyttede
`coachen-maalt`s fire eksisterende commits oven på `main` (nu med ordre 131
mergetf). Konflikt i `Dashboard.jsx`, landede i ordre 130 · commit 2 (splitten):

- **Import-linjen** (linje 19-28): 131 tilføjede `import AthleteSilentFailNote`,
  130 erstattede hele importblokken med `dashboardShared`. Løst ved at fjerne
  `AthleteSilentFailNote`-importen fra `Dashboard.jsx` helt — filen renderer
  ikke længere analyse-fanen selv.
- **Rendering-stedet** (linje 4304-5336): 131 satte `<AthleteSilentFailNote>`
  ind lige før "Kropsvægt"-kortet inde i den store, inline `activeTab ===
  'analyse'`-blok; 130 havde allerede flyttet HELE den blok til
  `src/dashboard/AnalyseTab.jsx` som en lazy chunk. Løsningen: behold 130's
  lazy-render af `<AnalyseTab>` i `Dashboard.jsx`, og flyt 131's
  `AthleteSilentFailNote`-import + rendering ind i `AnalyseTab.jsx` selv,
  på præcis samme sted (lige før "Kropsvægt") som 131 havde tænkt det.
- **`verify:athlete-silent-fail-visibility`** opdateret bevidst (samme mønster
  som ordre 126): scriptet krævede før "Dashboard.jsx kun rørt ét sted".
  Kravet er nu flyttet til `AnalyseTab.jsx` (0 forekomster i Dashboard.jsx,
  præcis 1 i AnalyseTab.jsx) — samme "præcis ét sted"-garanti, i den fil
  koden faktisk bor i efter splitten. Begrundelse skrevet direkte i scriptet.

Ingen anden logik rørt. `npm run build`: `Dashboard` 246,42 KB (uændret fra
RAPPORT-130), `AnalyseTab` 46,85 → 47,40 KB (den forventede vækst fra at
bære 131's komponent med over), `ProgramTab`/`IndbakkeView` uændrede.

**Commit 2 — videoklyngen** (fra FORSLAG-TIL-MARC.md punkt 3, ordre 130).
De tre "Gennemgå måling"-knapper i analyse-fanens video-kø delte række med
titel og statusmærke og stod under 44px. Løst: titel og knap/status-gruppe i
egne div'er, der stables til to linjer under 1300px bredde (titel øverst,
44px-knapper i en fuld-bredde række under — rammer iPad landscape 1180px) og
forbliver én linje derover (desktop 1440px). Knappen selv løftet til 44px
min-height, samme `display:inline-flex; alignItems:center`-mønster som
`s.btnEdit` (ordre 130 · commit 3). Ingen ny farve. `scripts/maal-coach.mjs`s
videoer-harness holdt synkroniseret med samme klasser/knap-højde.

**Commit 3 — Coach Briefing-placering.** `docs/COACH-BRIEFING-PLACERING.md`
(30 linjer): "Coach Briefing" er ikke en tredje visning, men to kanaler
(app-indbakke + n8n-fallback-mail, se `n8n/README.md`) ind til samme
prioritetskø — mailens link peger tilbage på Indbakken. 1 klik fra
atletlisten. To muligheder (A: behold som Indbakke, B: byg egen visning) med
ét argument hver.

## Testresultat

- `npm run lint`: **0 fejl**, samme 13 præeksisterende
  `react-hooks/exhaustive-deps`-advarsler som før (ingen nye).
- Alle **32** `verify:*`-scripts kørt to gange (efter rebasen og igen efter
  commit 2) — **grønne begge gange**, inkl. `verify:athlete-silent-fail-visibility`
  (opdateret) og `verify:videocoach-clip` (grøn denne kørsel, ingen ny timing-
  flakiness observeret).
- `npm run build`: grøn begge gange, chunk-tabel ikke vokset ud over 131's
  forventede tilføjelse (se commit 1 ovenfor).
- `npm run maal:coach`: trykflader <44px på "Videoer" 4 → 0 på begge profiler
  (iPad landscape 1180×820 og desktop 1440×900) — **alle 20 skærm×profil-
  kombinationer nu 0**. Før/efter-skærmbilleder (1180px og 1440px) i
  `outputs/maal-coach-video-cluster/`.

## Hvad er næste

- Marcs svar på `docs/COACH-BRIEFING-PLACERING.md` (ét ord: A eller B).
- De øvrige fire punkter i `outputs/maal-coach/FORSLAG-TIL-MARC.md`
  (kontrast, video-review-knapklyngens godkend/ugyldig/del-rækkefarver, om
  log/stævne/kost-fanerne skal splittes) står stadig åbne — uden for denne
  ordres omfang.
- Bhishaks arbejde i `entropi-app-wt2` på `videocoach.html` er urørt herfra.

**Betydning for Hara:** samler ordre 130 og 131's arbejde på coachens side
(begge dele af "Appen mærkbart bedre") i én sammenhængende gren uden at
miste nogen af delene, plus lukker det sidste kendte 44px-trykflade-hul på
coach-siden (alle målte skærme nu 0). Relevant for delmålet under
Coaching-planeten.

## Ærlige grænser

- **`outputs/maal-coach/EFTER.md`/`EFTER.json` er overskrevet** af denne
  ordres commit 2-måling (differ stadig mod den oprindelige `FOER.md` fra
  ordre 130 · commit 1, dvs. mod tilstanden FØR alle 130+137's rettelser).
  Ordre 130's egen "efter"-øjebliksbillede findes derfor ikke længere isoleret
  i disse to filer — kun i `outputs/maal-coach-video-cluster/foer-*.png`
  (som jeg gemte bevidst før min ændring) og i git-historikken (commit
  `731fe59`s tilstand).
- **Uændret grænse fra RAPPORT-130**: `maal-coach.mjs`s ti skærme er
  isolerede harnesses (ægte stilarter/hjælpefunktioner, attrap-data), ikke
  selve `Dashboard.jsx` renderet med en levende Supabase-session.
- **Rebase-konfliktens løsning er ikke selv gen-anmeldt af ordre 131's egen
  forfatter** — jeg har fulgt RAPPORT-131's beskrivelse af det tilladte sted
  (lige før "Kropsvægt") så tæt som muligt, men det er min læsning af
  intentionen, ikke en bekræftet gennemgang fra den ordre.
- **1300px-grænsen i video-rækkens layout er et skøn**, ikke målt til en
  præcis pixel-kant — den er bekræftet rigtig ved de to profiler ordren
  navngiver (1180px og 1440px), ikke ved alle bredder derimellem.
- Ingen atletdata brugt eller vist noget sted (attrap-data/attrap-atleter
  gennem hele ordren). Ingen ændring af datamodel, Supabase, migrations. Ingen
  ny afhængighed. `videocoach.html` og atletsidens filer (`AthleteView.jsx`,
  `athlete*.js`) urørte. Ingen push.
- De fire untracked filer i arbejdstræet (`docs/videocoach/ENT0092-AUDIT-*.md`,
  `drafts-2026-08-*/`) er ikke mine — urørte og ikke committet af mig.
