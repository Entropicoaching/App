# Valg — Ordre 228: er de seks sekunder ægte?

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Commit 1 — serverer produktionen komprimeret, og hvad er den ærlige TTI?

### Grænsen der afgjorde metoden

Ordren beder om at måle "de tre skærme" (Atletliste, Dagens pas, Check-in) på
den LIVE app. De skærme kræver et ægte, indlogget produktions-login. Denne
ordre har ingen produktions-legitimationsoplysninger, og ordrens egne grænser
forbyder atletdata og produktions-Supabase-skrivning ud over den læsning
appen selv gør — et automatiseret login med opdigtede/lånte credentials mod
ægte produktion ville enten fejle eller kræve en ægte konto, ingen af delene
sanktioneret her. Valget (jf. ordrens egen regel "spørg aldrig blokerende —
vælg det mest fornuftige, notér valget, fortsæt"): mål i stedet den ENESTE
skærm der er nåelig uden login — login-/landingsskærmen — på BEGGE sider
(lokal og produktion), så komprimering er den eneste reelle forskel mellem
målingerne, og suppler med Vites egne gzip-tal (allerede beregnet ved hver
`npm run build`) for at vurdere de tre autentificerede skærme uden at logge
ind på dem. Se "Ærlige grænser" i `docs/RAPPORT-228.md` for hvad dette IKKE
dækker.

Nyt script: `scripts/maal-produktion.mjs` (`npm run maal:produktion`).
Samme metode som `maal-kaeden.mjs` (226): devtools-throttling (reel
CDP-nedsættelse), mobil 390×844, 5 løb, median. Hvert løb får sin EGEN
Chrome-proces — se fundet nedenfor for hvorfor det var nødvendigt.

### Et metodefund undervejs: genbrugt browser skjulte de rigtige tal

Første forsøg genbrugte SAMME Chrome-proces/profil til alle 5 løb (som
`maal-kaeden.mjs`s authed runs gør, med vilje, for at bevare login). Mod
ægte produktion gav det 4 ud af 5 løb "0 bytes over ledningen" for
hovedscriptet — HTTP-cachen overlevede Lighthouses egen storage-reset
mellem løb, så 4 af 5 "målinger" reelt var cache-hjulpne genbesøg, ikke
kolde førstegangsbesøg. Rettet ved at give hvert af de 5 løb sin egen,
friske Chrome-proces (kold cache, kold DNS/TLS hver gang) — mere retvisende
for "en atlet åbner appen første gang på sin telefon" end et varmt cache.
Rettelsen er en del af `scripts/maal-produktion.mjs` som committet, ikke en
efterfølgende patch.

### Målingen: samme login-skærm, lokal (ukomprimeret) mod produktion (ægte)

| Måling | TTI/FCP | Hovedscript over ledningen | Hovedscript afkodet | Perf-score |
| --- | --- | --- | --- | --- |
| Lokal (ukomprimeret statisk server) | 3426ms | 359 225 B | 359 042 B | 85 |
| Produktion (`app.entropicoaching.dk`, ægte) | 2204ms | 121 304 B | 424 917 B | 97 |

Direkte header-tjek (uafhængigt af Lighthouses egne tal, en almindelig
`fetch()` med `Accept-Encoding: gzip, deflate, br`, samme som en rigtig
browser sender): `content-encoding: gzip`, `content-length: 121046`B mod et
afkodet indhold på 424 917 B — **komprimeringsforhold ~28,5 %, altså ~3,5×
mindre over ledningen end de rå bytes.** (`curl --compressed` gav samme tal
uafhængigt, før scriptet blev skrevet — se kommandoen i `git log`-historien
for denne ordre om nødvendigt.)

**Svaret: ja, produktionen serverer komprimeret (gzip, ikke brotli — Fastly/
GitHub Pages svarede kun med gzip selv når `Accept-Encoding` bad om br).**
Hele måleseriens antagelse (175→...→226) om at den lokale, ukomprimerede
måling er unødigt pessimistisk, er hermed BEKRÆFTET, ikke kun mistænkt.

Bemærk: produktion (`162abc6`) er FØR 226's Realtime-fjernelse, så dens
hovedbundt (424,9 kB rå) er større end den nuværende lokale build (359,0 kB
rå, efter 226) — selv med det handicap slår produktionen den lokale,
ukomprimerede måling med over 1,2 sekund. Det er et konservativt (til
produktionens ULEMPE) sammenligningsgrundlag, ikke et der er pyntet til
produktionens fordel.

### Hvor tæt er de tre autentificerede skærme på 2s? Et estimat, ikke en måling

Login-skærmen er lettere end Atletliste/Dagens pas/Check-in — de kræver
`Dashboard`- eller `AthleteView`-chunken oveni. Direkte produktionsmåling af
dem er ikke gjort (grænsen ovenfor). I stedet: Vites egen gzip-beregning
(samme zlib-baserede tal `npm run build` altid printer) for nuværende
`main`s bundter, sammenholdt med det bekræftede produktions-komprimerings-
forhold (~28–29 %, matcher Vites egne 28,3 % for hovedbundtet næsten
præcist — stærkt sammenfald, ikke tilfældigt: gzip-forhold for minificeret
JS er notorisk stabilt uanset præcist indhold):

| Chunk (nødvendig for Atletliste) | Rå | Gzip (Vite) |
| --- | --- | --- |
| Hovedbundt (`index`) | 359,04 kB | 101,59 kB |
| `Dashboard` | 328,34 kB | 75,90 kB |
| `videoCoachUpload` (delt chunk) | 10,28 kB | 3,60 kB |
| `athleteSilentFailLog` (delt chunk) | 1,70 kB | 0,76 kB |
| **I alt** | **699,36 kB** | **181,85 kB** |

Det er ~26 % af de rå bytes den lokale, ukomprimerede måling brugte 5174ms
på at overføre (`docs/VALG-226.md`). Overførselstid under et
båndbredde-loft (devtools-throttlingens mobileSlow4G-profil) skalerer
nogenlunde med bytes — men IKKE perfekt: hver anmodnings faste
round-trip-tid (150ms i profilen) forsvinder ikke bare fordi der er færre
bytes, og login-skærmens egen produktionsmåling (121 kB gzip → 2204ms TTI,
inkl. DNS/TLS/CDN-latens) viser at der ER en gulv-omkostning uafhængigt af
komprimering. **Et forsigtigt, tydeligt mærket ESTIMAT** (ikke en direkte
måling): Atletliste-skærmens produktions-TTI ligger sandsynligvis i
omegnen af 3-4 sekunder — bedre end de lokalt målte ~6,2s, men
sandsynligvis STADIG over 2s-målet.

### Konklusion for commit 2's omfang

Afstanden til 2s er IKKE lille nok til at gøre commit 2 overflødig — men den
er heller ikke de fulde ~4,2 sekunder (6,2s minus 2s) den lokale, ukomprimerede
måling antydede. Commit 2 fortsætter som planlagt (tunge moduler ud i
chunks), men holdes til det tydeligt sikre og velbegrundede (jf. ordrens
"gør commit 2 mindre" hvis afstanden er lille — den er mindre, men ikke
lille; commit 2 er derfor mindre AGGRESSIV end en fuld omskrivning af
Dashboard.jsx/AthleteView.jsx's video-coach-håndtering ville have været,
ikke sprunget over).

## Commit 3 — vandfald efter commit 2: hvad fylder nu mest?

Ad hoc Lighthouse-vandfald (devtools-throttling, ét løb pr. skærm, samme
mock/build som `maal:kaeden`, IKKE committet som kode — kun tallet, jf.
226-mønsteret og ordrens egen grænse for dette commit) for begge sider
efter VolumenKort-splittet:

**Atletliste (coach):** FCP/LCP 5053ms, TTI 5682ms, TBT 14ms.
- `index` (hovedbundt): 90→2613ms, 359 218B
- `Dashboard`: 2784→4737ms, 247 976B (starter først når hovedbundtet har
  kørt nok til at kalde `dashboardFactory()` — ~170ms afstand fra forrige
  scripts slutning)
- `videoCoachUpload` (delt chunk): 2784→3473ms, 10 467B
- **Alle scripts færdige: 4737ms — 83 % af de 5682ms TTI.**
- Mainthread-arbejde (uændret lille, som i 226): scriptEvaluation 406ms,
  styleLayout 267ms, TBT kun 14ms — eksekvering er stadig ikke problemet.
- Supabase-kaldene (athletes/weeks/exercise_logs/training_signals/messages
  m.fl.) starter ikke for alvor før 4874ms (efter scripts) og fortsætter,
  overvejende SERIALISEREDE (ikke i parallel), til 6794ms — SENERE end det
  rapporterede TTI-tal. En rigtig coach der venter på en fyldt atletliste
  (ikke bare "siden reagerer") oplever formentlig tættere på 6,8s end 5,7s.

**Dagens pas (atlet):** FCP 4888ms, LCP/TTI 6236ms.
- `index`: 86→2612ms, 359 224B
- `AthleteView`: 2780→4768ms, 251 294B (uspaltet — hele filen, 6598 linjer,
  én chunk)
- `videoCoachUpload` + `athleteSilentFailLog` (delte chunks): færdige 3485ms
- **Alle scripts færdige: 4768ms — 76 % af de 6236ms TTI.**

### Den ene, med tal

**Script-overførslen er stadig den største post: ~4,7 af de 5,7-6,2
sekunders TTI (76-83 %) går til at hente og evaluere hovedbundt +
skærmspecifik chunk, PRÆCIS som i 226 (dengang 5174 af 6163ms, 84 %) — bare
et lidt mindre absolut tal efter commit 2's Volumenkort-udspaltning.**
Størstedelen af den post er stadig `index` (359 kB, uændret af denne ordre —
det er selve login/app-skallen, ikke en skærmspecifik chunk) plus ÉN
uspaltet skærmchunk (`Dashboard` 248 kB eller `AthleteView` 251 kB, næsten
identisk størrelse). `AthleteView.jsx` (6598 linjer) har INGEN intern
fane-opsplitning i dag (i modsætning til `Dashboard.jsx`s tre
`LazyBoundary`-faner) — det er den næste konkrete, unavngivne kandidat af
samme klasse som Volumenkortet var, men uden for denne ordres omfang.
Intet greb forsøgt her, jf. commit 3's egen grænse.
