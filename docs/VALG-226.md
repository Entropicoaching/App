# Valg — Ordre 226: måling efter, og den næste sten

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Commit 3 — slog Realtime-fjernelsen igennem i TTI?

Samme tre skærme, samme metode (`npm run maal:kaeden`, devtools-throttling,
5 løb, median), FØR (commit 1) og EFTER (commit 2) Realtime-fjernelsen:

| Skærm | TTI FØR (commit 1) | TTI EFTER (commit 2) | Forskel |
|---|---|---|---|
| Atletliste (coach) | 6437ms | 6175ms | −262ms |
| Dagens pas (atlet) | 6570ms | 6226ms | −344ms |
| Check-in (atlet) | 6546ms | 6246ms | −300ms |

**Ja, det slår igennem** — alle tre skærme flytter sig i samme retning med
en ensartet størrelsesorden (260-345ms), langt over den støj devtools-
throttling viser mellem gentagne løb af samme build (typisk under 50ms i
disse målinger). Det er modsat 201's fund: der viste den SIMULEREDE
throttling ingen klar ændring for en bekræftet mekanisk forbedring;
devtools-throttling her viser en konsistent, målbar forbedring for en
bekræftet bundtreduktion. Mistanken fra `docs/RAPPORT-201.md` "Hvad er
næste" punkt 2 er hermed bekræftet: simulate-metoden var for grov til at
vise disse gevinster.

Målet (under 2s) er stadig langt væk — alle tre skærme ligger omkring
6,2s, "føles som en hjemmeside der loader" uændret.

## Den næste sten — hvad fylder resten af de ~6,2s

Ad hoc-vandfald for Atletliste (coach, telefon 390px, devtools-throttling,
samme mock/build som `maal:kaeden`, IKKE committet — kun tallet, jf.
ordrens egen grænse):

- **FCP = LCP = 5537ms.** Intet males på skærmen før 5,5 sekunder er gået.
- **De tre scripts (hovedbundt + Dashboard-chunk + videoCoachUpload-chunk,
  682KB tilsammen) er først færdigdownloadet 5174ms inde i løbet.**
  Det er broderparten af de 6,2s — FCP indtræffer kort efter, lige når
  scripts'ene er hentet og kørt.
- Mainthread-arbejdet SELV er lille i sammenligning: Script Evaluation
  451ms, Style & Layout 289ms, Total Blocking Time kun 20ms. JS-parsing/
  -eksekvering er ikke flaskehalsen — det er selve OVERFØRSLEN.
- Supabase-opslagene (profiler, atletliste, træningssignaler m.fl.) ligger
  EFTER scripts'ene er hentet (fra ~6,0s til ~7,3s) og bidrager til den
  fulde side-oplevelse, men ikke til FCP/TTI-tallet i denne måling.

**Den ene største post, med tal: script-overførslen (682KB, 0→5174ms).**

### En vigtig ærlig grænse fundet undervejs (ikke ordre 226's skyld)

Den lokale målemetodes statiske server (`startStaticServer()` i
`scripts/maal-telefon.mjs`, `maal-coach-telefon.mjs`, `maal-atlet-
telefon.mjs`, `maal-app.mjs` OG denne ordres `maal-kaeden.mjs` — samme
mønster overalt, ikke noget ordre 226 har indført) sender filer med
`readFileSync` og INGEN `Content-Encoding: gzip/br` — de 682KB der måles
er de RÅ, ukomprimerede bytes (359+328+10 KB raw fra `npm run build`s
egen tabel), ikke de ~145KB gzip Lighthouse selv rapporterer i sin
bundtstørrelse-visning. Det har været sandt siden ordre 123 og påvirker
ALLE tal i hele denne målingsserie (175→184→190→193→200→201→226) ligeligt
— før/efter-sammenligninger inden i denne serie er stadig gyldige (samme
skævhed på begge sider), men de ABSOLUTTE TTI-tal er sandsynligvis
markant mere pessimistiske end det GitHub Pages (som typisk serverer
gzip/brotli automatisk) reelt viser en bruger. Ikke verificeret direkte
mod `app.entropicoaching.dk` (ingen internetadgang brugt til det formål
her, og det ville ligge uden for denne ordres afgrænsning) — kun
udledt af koden i de fem målescripts. Værd at efterprøve FØR et nyt
måle-baseret greb forsøges: enten ved at måle de faktiske response-
headers på den rigtige side, eller ved at lade `startStaticServer()`
sende gzippede svar, så tallene matcher produktion bedre.

**Næste sten, i prioriteret rækkefølge:**
1. Efterprøv gzip/brotli-antagelsen (ovenfor) — hvis den holder, er alle
   TTI-tal i hele denne serie for pessimistiske, og den reelle afstand
   til 2s-målet er sandsynligvis meget mindre end 6,2s.
2. Hvis afstanden stadig er stor efter punkt 1: script-overførslen selv
   (682KB) er den næste konkrete flaskehals — kandidat fra 201's egen
   liste ("tunge moduler ud af hovedbundtet og ind i chunks") er stadig
   uafprøvet.
