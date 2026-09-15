# Valg — ordre 231, commit 3: næste sten efter commit 2, med tal

Ad hoc Lighthouse-vandfald (samme metode som 226/228, ikke committet som
kode — kun tallet, mock/build/login-infrastrukturen kørt engangs og kasseret
bagefter), på dist/ efter commit 2's rettelse.

Atletliste (coach): TTI 5133ms, TBT 0ms.
Dagens pas (atlet): TTI 6305ms, TBT 206ms.

De to største filer på begge skærme er UÆNDREDE af denne ordre (231 rørte
ingen bundtstørrelser, kun kaldrækkefølgen):

- `index-*.js` (hovedbundtet): 351kB rå / 101,57kB gzip — starter ved 96-
  131ms, tager ~2,5s at hente, samme størrelse som 228 rapporterede
  (359,04kB rå dengang — de ~8kB forskel er build-determinisme, ikke en
  ændring).
- Skærmens egen uspaltede chunk: `Dashboard` 242kB / `AthleteView` 245kB rå
  — starter FØRST når index.js er kørt færdig (~2,8-2,85s), altså i
  SERIE efter hovedbundtet, ikke parallelt. Tager selv ~2s at hente.

Scripts total færdige: 4811ms på Atletliste (94% af TTI), 4794ms på Dagens
pas (76% af TTI). Mainthread-arbejde stadig lille (TBT 0-206ms) — det er
fortsat overførslen, ikke eksekveringen, samme mønster som 226/228.

**Den ene største post, navngivet med tal: script-overførslen selv, uændret
af denne ordre — konkret index.js (351kB rå/101,57kB gzip) efterfulgt i
SERIE af den ene uspaltede skærmchunk (Dashboard 242kB eller AthleteView
245kB), tilsammen 76-94% af TTI.** Samme fund som 228's commit 3 (dengang
76-83%), nu med en ekstra detalje: de to chunks er ikke parallelle
netværkskald der konkurrerer om samme rør (228's bekymring om spekulativ
dobbelt-hentning) — screen-chunken starter simpelthen ikke før index.js's
modulgraf er færdig eksekveret og det lazy import kan opløses. At splitte
DEN kæde (fx ved at forudindlæse screen-chunken tidligere, eller gøre
AthleteView.jsx's 6598 linjer internt faneopdelt som Dashboard.jsx's tre
LazyBoundary-faner allerede er) er samme, større, afgrænsede greb 228 pegede
på i sit "Hvad er næste" punkt 1 — uden for denne ordres omfang.

Bifund: Lighthouses network-requests-audit viser at det SIDSTE
Supabase-kald på begge skærme stadig slutter EFTER det rapporterede
TTI-tal (Atletliste: 7004ms vs. TTI 5133ms; Dagens pas: 7892ms vs. TTI
6305ms) — samme retning som 228's bifund (6794ms dengang), selv efter
commit 2's parallellisering af fetchReadiness. Det er ikke en regression:
disse sene kald er lavprioritets baggrundslæsninger (fx video-historik,
måltidsskabeloner) der aldrig var på TTI's kritiske vej — men det bekræfter
at TTI-metrikken reelt afgøres af scriptvægten, ikke af hvornår ALLE
netværkskald er færdige.

Intet greb forsøgt mod nogen af delene, jf. commit 3's egen grænse.
