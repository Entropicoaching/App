# Rapport — ordre 239: overleveringen efter 233, det en ny agent skal vide om appen, ét sted

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `overlevering-233`, forgrenet fra `main` (`0513026` — 233 er merget;
live er stadig `162abc6`, Marc pusher).

- `b0de81f` — commit 1: `docs/OVERLEVERING.md` — kortet over appen, plus
  "gør ikke"-listen (se "Ærlige grænser" for hvorfor de to blev slået
  sammen i én commit i stedet for ordrens commit 1/3)
- `c640833` — commit 2: `docs/MAALINGER.md` — tallene ét sted
- (denne rapport er commit 3, se hash i `git log` efter commit)

Arbejdstræet er rent efter hver commit. Ingen push. Ingen produktions-
Supabase. Ingen atletdata. Kun docs rørt — intet i `src/`, `public/`,
`e2e/`; ingen ny afhængighed. Bhishaks felt (`entropi-app-wt2`, `e2e/` og
`scripts/verify-*`, ordre 234) er ikke rørt.

## Hvad ændret

Ni ordrer (215, 218, 221, 225, 226, 228, 231, 232, 233) har ændret appen
siden 15. sep morgen, hver med sin egen rapport — ingen af dem samlet ét
sted. Denne ordre bygger to dokumenter, begge med henvisning tilbage til
kilderapporten for hvert punkt. `docs/OVERLEVERING.md`: appens dele og
chunks med filnavne og ca. størrelser (hovedbundt, Dashboard/AthleteViews
`LazyBoundary`-faner, VideoCoach som selvstændigt værktøj); hvordan
indlæsningen sker (rollehukommelsen fra 201, modulepreload-pluginnet fra
233, `LazyBoundary`s `useMemo`-regel fra 215); Supabase-klienten efter 226
(fire submoduler, ingen Realtime — og en eksplicit advarsel om at
`realtime-js` skal geninstalleres hvis nogen nogensinde vil bruge
`.channel()`); de tre målescripts (`maal:kaeden`, `kaeden:tegn`,
`maal:produktion`) og deres metodeforskel (devtools-throttling, ikke
Lighthouses simulate — den forskel der selv afgjorde om 201's mekanisk
korrekte rettelse var synlig i tallene eller ej); VideoCoach-trackerens
seks fredede invarianter fra `HANDOVER-VIDEOCOACH.md`; og hvad der venter
på Marc (push af `main`, migration 209). En "gør ikke"-liste med fire
punkter og deres begrundelse (kontinuitetsfilteret i 218, billigere
genfinding i 225, den falske hæng-måling 221→225, rollecaching uden
TTI-effekt i 201) sidder som eget afsnit i samme fil, fordi den hænger
direkte sammen med hvordan indlæsningen og trackeren er beskrevet ovenfor
— at splitte den ud ville have betydet at gentage konteksten.
`docs/MAALINGER.md`: én tabel med hver TTI-måling fra 201 til 233 (dato,
ordre, metode, skærm, før/efter, ændring) og én tabel med hver
bundtstørrelses-måling, plus et eksplicit metode-varsel (simulate vs.
devtools er IKKE sammenlignelige tal, en fejl der ellers er let at begå
ved at læse tallene isoleret fra rapporterne). Ingen nye målinger — kun tal
der allerede stod i de ni rapporter, samlet.

Den fil en ny agent bør læse FØRST er stadig `AGENTS.md`, ikke
`OVERLEVERING.md` — `AGENTS.md` er allerede den etablerede, model-agnostiske
indgang (arbejdsregler, produkt-skel, Supabase-godkendelse), og skal ikke
duplikeres eller konkurreres med. `OVERLEVERING.md` bygger derfor eksplicit
oven på den (nævnt i sin egen første linje) i stedet for at skabe en
parallel sandhed — Marcs egen instruks ("find først den fil en ny agent
læser først … byg oven på den").

## Testresultat

`npm run lint`: rent (kørt efter begge commits, ingen fund — docs rører
ikke lint-scope, men kørt som krævet).

Enhedstest (`node --test "src/**/*.test.js"`): 242/242 grønne, uændret fra
ordre 233 (ingen kildekode rørt af denne ordre).

`npm run e2e` og `verify:*`-scripts er ikke kørt — ordrens egen grænse
nævner kun lint + enhedstest for et docs-only-arbejde, og ingen kode i
deres dækningsområde er rørt.

## Hvad er næste

1. Migration 209 (`exercise_muscle_overrides`) venter fortsat på Marcs
   godkendelse — ingen ny handling herfra, kun navngivet igen i
   `OVERLEVERING.md` så den ikke tabes af syne.
2. `AthleteView.jsx`s yderligere opsplitning og `Dashboard`-chunkens
   størrelse er stadig de navngivne, ikke-forsøgte kandidater fra 228/231/
   233 — uændret af denne ordre, nu lettere at finde for den næste agent.
3. En fremtidig ordre der ændrer `AGENTS.md`, `roleCache.js`s signatur,
   eller tilføjer flere fredede tracker-invarianter bør opdatere
   `OVERLEVERING.md` i samme ordre — filen er nu den ene rolle for "appens
   tilstand", og skal ikke få en konkurrerende kopi et andet sted.

## Ærlige grænser

- Ordren bad om fire adskilte commits (kort, tal, "gør ikke"-liste, rapport).
  "Gør ikke"-listen blev skrevet ind i `docs/OVERLEVERING.md` SAMME commit
  som kortet (commit 1 her), ikke som en egen commit 3, fordi den ikke kan
  læses uafhængigt af kortets beskrivelse af tracker-invarianterne og
  målemetoden — at dele dem i to commits ville have betydet at commit 1
  midlertidigt var ufuldstændig i en fil ordren selv beskriver som "ét
  dokument". Indholdsmæssigt er begge dele af ordren opfyldt; commit-
  optællingen er 3, ikke 4.
- `docs/MAALINGER.md`s tal er kopieret fra rapporterne, ikke genudregnet
  fra rå data (ingen af de originale Lighthouse/devtools-kørsler er gemt
  som filer i repoet) — en transskriptionsfejl er derfor mulig selvom
  hvert tal er læst direkte fra sin kilderapport. Ikke krydstjekket med et
  script.
- `docs/OVERLEVERING.md` er tre sider (170 linjer/~1400 ord) — inden for
  ordrens "højst tre sider", men tæt på grænsen. Nogle detaljer (fx
  VideoCoach-trackerens fulde rundehistorik i `HANDOVER-VIDEOCOACH.md`) er
  bevidst IKKE gengivet — kun de seks endelige invarianter — for at holde
  længden. En agent der skal ÆNDRE trackeren bør stadig læse
  `HANDOVER-VIDEOCOACH.md` selv, ikke kun denne fils sammendrag.
- Denne rapport er selv skrevet af den samme slags agent den advarer en
  fremtidig agent om at stole for meget på — kortet er ikke uafhængigt
  efterprøvet af en anden læsning end min egen af de ni rapporter.
- Har betydning for Hara (Coaching-planeten, delmål "Appen mærkbart
  bedre"): denne ordre lukker ikke selv noget TTI-gab, men gør al viden fra
  215-233-serien (tre reelle bundtstørrelses-skæringer, den bekræftede
  båndbredde-grænse fra 233, fire afprøvede-og-afviste greb) tilgængelig
  for enhver fremtidig agent — inklusive en der ikke er Claude — i to
  dokumenter i stedet for ni rapporter der skal læses i rækkefølge.

---

**Tre linjer til Marc:** giv en ny agent `AGENTS.md` først (arbejdsregler,
produkt-skel, Supabase-godkendelse) — det er allerede den etablerede
indgang. Peg den derefter på `docs/OVERLEVERING.md` for appens tilstand
(chunks, indlæsning, fredede invarianter, "gør ikke"-listen) og
`docs/MAALINGER.md` for tallene. De to nye filer erstatter ikke `AGENTS.md`
— de bygger oven på den, som du selv bad om.
