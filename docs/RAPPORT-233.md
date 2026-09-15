# Rapport — ordre 233: skærmchunken hentes samtidig med hovedbundtet, ikke efter

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `modulepreload`, forgrenet fra `main` (`d7ba5d4` — 231 og Bhishaks 232
er merget; live er stadig `162abc6`, Marc pusher).

- `6c9ead1` — commit 1: forudindlæsning af den gættede rolles skærmchunk
- `803a85d` — commit 2: målt, før/efter
- `dea9d96` — commit 3: næste sten, med tal
- (denne rapport er commit 4, se hash i `git log` efter commit)

Arbejdstræet er rent efter hver commit. Ingen push. Ingen skrivning mod
produktions-Supabase. Ingen atletdata. `e2e/` og `scripts/verify-*` urørt
(Bhishaks felt, ordre 234).

## Hvad ændret

231 (og 226/228 før den) fandt at 76-94% af TTI er script-transport:
hovedbundtet (`index.js`, 359,08kB rå/101,61kB gzip) og skærmens egen
uspaltede chunk (`Dashboard` eller `AthleteView`) hentes i SERIE — chunken
venter på at hovedbundtets modulgraf er kørt færdig og App.jsx's lazy
`import()` kan opløses, selvom de to filer intet reelt afhænger af
hinanden. Med 201's rollehukommelse (`localStorage`, pr. bruger-id) ved
browseren allerede ved første byte hvilken rolle der sandsynligvis logger
ind. Commit 1 flyttede 201's `roleCacheKey`/`readCachedRole`/
`writeCachedRole` fra `App.jsx` til et nyt `src/roleCache.js`, sammen med to
nye, rene funktioner: `guessRoleFromStorage` (finder GoTrues gemte
bruger-id i `sb-*-auth-token`, samme mønster som `authSignOut.js`s
`isSupabaseAuthTokenKey`, og slår rollen op i cachen) og
`preloadHrefForRole` (vælger hvilken chunk-href der hører til en gættet
rolle). Begge er enhedstestet (`roleCache.test.js`, 11 tests, aldrig kaster
— korrupt JSON, manglende nøgle eller en storage der selv kaster giver
alle sammen blot "intet gæt"). `vite.config.js` fik et nyt plugin
(`entropi-role-guess-preload`) der ved byggetid læser Rollups
chunk-manifest for at finde `Dashboard`- og `AthleteView`-chunkens
faktiske, hashede filnavne, bager `roleCache.js`s kildekode ind ORD FOR ORD
(kun `export` fjernet — samme kode som enhedstesten dækker, ingen separat
kopi der kan gå i utakt) i et lille, pakket (IIFE) inline-script, og
indsætter det i `index.html` lige EFTER `<meta charset>` (bevidst placering:
for tidligt ville skubbe charset-deklarationen over HTML5's 1024-byte-
grænse, for sent ville lægge scriptet efter hovedbundtets eget
`<script type="module">`, som Vite selv flytter ind i `<head>`). Scriptet
lægger et `<link rel="modulepreload">` for den gættede rolles chunk. Intet
gæt eller forkert gæt: ingen fejl, ingen forudindlæsning — adfærd som i dag,
samme garanti-stil som 201's egen rettelse.

Commit 2 målte med `npm run maal:kaeden` (5 løb, median, devtools-
throttling, telefon 390px), FØR (`d7ba5d4`, ingen forudindlæsning) mod
EFTER (`6c9ead1`, commit 1), samme metode som 226/228/231:
Atletliste 7198→7014ms (-184ms), Dagens pas 5803→5751ms (-52ms), Check-in
5793→5835ms (+42ms) — se `docs/KAEDEN-233.md`. Et engangsscript (ikke
committet, samme metode som 201's egen waterfall-diagnose) bekræftede
MEKANISK at greebet virker: med en cachet rolle indsættes
`<link rel="modulepreload">`, og skærmchunken begynder at hente ~5ms efter
hovedbundtets egen request i stedet for slet ikke før hovedbundtets
modulgraf er færdig.

Commit 3 tog et nyt ad hoc-vandfald (samme metode som 226/228/231, ikke
committet som kode) efter commit 1. Det bekræftede MEKANISK at kæden er
brudt — på Atletliste starter `Dashboard-*.js` 202ms inde, kun 42ms efter
`index.js`s egen start (161ms); på Dagens pas starter `AthleteView-*.js`
145ms inde, 31ms efter `index.js` (114ms). Før commit 1 startede
skærmchunken FØRST flere sekunder senere. **Den ene største post, navngivet
med tal: selve BYTE-MÆNGDEN, ikke rækkefølgen.** `index.js` (351kB rå) og
skærmchunken (Dashboard 242kB rå / AthleteView 118kB rå) deler nu samme
begrænsede, throttlede rør — under en BÅNDBREDDE-begrænset forbindelse
(til forskel fra en rundturs-begrænset) flytter det at starte to store
hentninger samtidigt ikke den samlede transporttid ret meget, fordi de to
downloads deler samme faste bitrate. Det forklarer, med tal, hvorfor
commit 2's TTI-gevinst var lille og i to af tre tilfælde inden for støj,
selvom kæden beviseligt er brudt — se `docs/VALG-233.md`. Intet greb
forsøgt.

## Testresultat

`npm run lint`: rent ved alle commits.

Enhedstest (`node --test "src/**/*.test.js"`): 242/242 grønne (231 fra før
+ 11 nye i `roleCache.test.js`), kørt efter commit 1.

Alle 34 `verify:*`-scripts: grønne, kørt efter commit 1 (ingen af dem rørt
af denne ordre).

`npm run e2e`: grøn (29,8s), kørt efter commit 1.

`npm run build`: grøn ved alle commits. `dist/index.html`: 1,10kB → 2,77kB
(det nye inline-script), resten af bundtstørrelserne uændret af denne
ordre.

`npm run maal:kaeden` (commit 2, labels `233-commit1-foer`/
`233-commit1-efter`) og det ad hoc-vandfald (commit 3): kørt, tallene står
under "Hvad ændret" og i `docs/KAEDEN-233.md`/`docs/VALG-233.md`.

## Hvad er næste

1. Den reelle, unavngivne grænse er nu bekræftet at være BYTE-MÆNGDEN, ikke
   rækkefølgen (commit 3's fund) — kaldrækkefølgen mellem hovedbundt og
   skærmchunk er nu rettet så langt den kan blive uden at røre bytetal.
   Fremtidige greb der REELT skal flytte TTI skal skære i selve
   størrelserne: `AthleteView.jsx` (6598 linjer, ingen intern
   faneopsplitning, i modsætning til `Dashboard.jsx`s tre
   `LazyBoundary`-faner efter 228) er stadig den tydeligste, allerede
   navngivne kandidat (228/231's "Hvad er næste"-punkt, endnu ikke
   forsøgt).
2. `Dashboard`-chunken (247,85kB rå/62,17kB gzip) er den enkeltstørste
   chunk tilbage efter `index.js` selv — en tilsvarende, yderligere
   opsplitning (ud over 228's `VolumenKort`-udtræk) er en mulig, ikke-
   forsøgt kandidat.
3. Ingen flere greb af "hent-tidligere"-typen bør forsøges uden at regne på
   båndbredde-deling først (commit 3's fund) — et nyt forsøg på at
   forudindlæse MERE (fx dele af skærmchunkens egne afhængigheder) vil
   sandsynligvis ramme samme flaskehals, ikke løse den.

Tre linjer til Marc om hele serien 226-233: Hovedbundtet er 16% mindre i
gzip end da 226 startede (120,99kB→101,61kB, den døde Supabase Realtime-
klient fjernet), Dashboard-chunken 25% mindre (328,34kB→247,85kB rå, 228's
VolumenKort-udtræk), og AthleteView-chunken 51% mindre (245kB→120,31kB rå,
232's faneopsplitning) — tre reelle, bekræftede skæringer i selve
byte-vægten appen skal sende. Denne ordre (233) rettede den sidste
kaldrækkefølge-fejl i kæden (hovedbundt og skærmchunk hentes nu parallelt,
mekanisk bekræftet), men fandt samtidig at rækkefølgen aldrig var den
reelle flaskehals under en båndbredde-begrænset forbindelse — kun
byte-mængden er, og den er stadig størst i `AthleteView.jsx`s manglende
interne opsplitning, samme retning 228 og 231 allerede pegede mod. De
absolutte TTI-sekundtal i serien (~5,8-7,2s afhængigt af session/host,
samme støj-forbehold som 201/231 selv nævner) er ikke pålidelige nok til
selv at bruges som "fra-til"-tal på tværs af ordrer — bytetallene ovenfor
er de tal der reelt kan stå til troende.

## Ærlige grænser

- Commit 1's rettelse er mekanisk bevist (to dedikerede diagnoser, én pr.
  commit, viser skærmchunken starte ~30-40ms efter hovedbundtet i stedet
  for flere sekunder senere), sikker (ingen regression i lint/e2e/verify,
  242/242 enhedstests grønne), men dens effekt på aggregeret TTI er lille
  og i to af tre tilfælde inden for normal støj (samme mønster som 201's
  egen, tilsvarende rettelse — se `docs/RAPPORT-201.md`). Jeg har ikke
  skjult at TTI-tallet knap flyttede sig.
- Commit 3's forklaring (båndbredde-deling, ikke rækkefølge, er den reelle
  grænse) er en velbegrundet, tal-understøttet hypotese (bekræftet
  transfer-tider for begge parallelle hentninger, konsistent med
  Lighthouses egen mobileSlow4G-bitrate), men den er udledt af ÉT ad hoc-
  løb pr. skærm (ikke median af 5, samme metode-grænse som 226/228/231's
  egne commit 3'er) — retningen er pålidelig, det præcise ms-tal kan
  variere.
- `dist/index.html`s inline-script bager `src/roleCache.js`s kildekode ind
  RÅT (kun `export` fjernet og kommentarlinjer strippet) i stedet for at
  importere den som et modul — bevidst, for at scriptet kan køre
  synkront og ikke-blokerende FØR hovedbundtets eget `<script
  type="module">`, men det betyder at enhver fremtidig ændring af
  `roleCache.js`s SIGNATUR (ikke bare dens indhold) automatisk følger med
  ved næste build, uden en separat, eksplicit påmindelse — værd at vide
  for en fremtidig ordre der rører den fil.
- Den lokale måleservers ukomprimerede bytes (ingen gzip/br, kendt siden
  ordre 123/226, se `docs/VALG-226.md`) gælder stadig hele denne
  målingsserie, inkl. denne ordres tal — de absolutte ms-tal er
  sandsynligvis mere pessimistiske end produktion reelt viser, men
  RETNINGEN (parallelt vs. serielt, båndbredde-delt eller ej) er upåvirket
  af det.
- Har betydning for Hara (mærkbart bedre-sporet): denne ordre lukkede
  ordre 231's "Hvad er næste"-punkt 2 (forudindlæsning af den gættede
  rolles chunk) med en verificeret, testet rettelse, og fandt samtidig
  PRÆCIS hvorfor den ikke slår markant igennem endnu (båndbredde, ikke
  rækkefølge) — samme retning 228/231 allerede pegede Hara imod
  (AthleteView.jsx's manglende faneopsplitning er den reelt største
  hævstang), nu med en konkret grund til HVORFOR rene rækkefølge-greb ikke
  er nok alene.
