# Ordre 173, commit 1 — de fem skærme, målt i den ægte app (ikke en harness)

Metode: samme som ordre 167 — Lighthouse mobilprofil (390×844, 4x
CPU-nedsættelse + langsomt netværk), 3 løb pr. skærm, medianen brugt. Men i
stedet for de tre isolerede harnesses ordre 167 brugte til "Dagens pas",
"Sæt-logger" og "Check-in", er alle fem skærme her målt gennem den ÆGTE,
uændrede app mod `e2e/mock-supabase.mjs` (ordre 153/155), logget ind som
testatleten (`e2e/fixtures.mjs`). `npm run maal:telefon foer-rettelser`.
Ingen rettelser i denne commit.

## Tabel — harness (167) vs. virkeligt (173), samme fem skærme

| Skærm | TTI · harness (167) | TTI · ægte app (173) | Forskel | Perf-score 167→173 |
|---|---|---|---|---|
| Login | 3319 ms | 3322 ms | ~0 (samme metode, ingen ægte ændring) | 87 → 87 |
| Dagens pas | **735 ms** (harness) | **6000 ms** (ægte) | **+5265 ms — 8× langsommere** | 100 → **69** |
| Sæt-logger | **751 ms** (harness) | 244 ms (klik→synlig, se note) | ikke sammenlignelig tal-for-tal (se note) | 100 → n/a (se note) |
| Check-in | **660 ms** (harness) | **6001 ms** (ægte) | **+5341 ms — 9× langsommere** | 100 → **66** |
| Videocoach-forside | 4118 ms | 4076 ms | ~0 (samme metode, ingen ægte ændring) | 78 → 79 |

Skærmbilleder: `outputs/maal/2026-09-13--foer-rettelser/*.png`. Rå tal:
`outputs/maal/2026-09-13--foer-rettelser.json`.

## Hvor meget løj harness-tallene

**Login og Videocoach-forside løj ikke** — de var den ægte app i 167 også, og
tallene her matcher (indenfor normal måle-støj, se `docs/RAPPORT-167.md`s egen
note om samme fænomen på Videocoach-forsiden).

**"Dagens pas" og "Check-in" løj markant.** Ordre 167s harnesses var
statiske HTML-sider med hårdkodet attrapdata og INGEN netværkskald — deres
perf-score 100 og TTI < 1s målte harnessens EGEN, trivielle vægt, ikke den
ægte, autentificerede AthleteView. Den ægte skærm skal først downloade+parse
Dashboard- og AthleteView-bundterne (251+246 KB) og derefter afvente **57
netværkskald** til mocken (mod harnessens 1-2) før den er brugbar — TTI lander
på ~6s, perf-score 66-69. Det er netop den advarsel ordrens "Hvorfor"-afsnit
efterlyste: "100 i perf-score ... for pæne".

**Vigtig ærlig detalje: "Dagens pas" og "Check-in" er i den ægte app SAMME
skærm.** Begge er faneblad "hjem" i `src/AthleteView.jsx` — sessionskortet
("Mit program") og parathedskortet ("Dagens parathed") renderes side om side
i samme DOM (se linje ~3993-4200), ikke to separate visninger. Ordre 167s to
isolerede harnesses (`harnessHjem`/`harnessCheckIn`) fremstillede dem som to
uafhængige 100-tal; i virkeligheden er det ÉT tal for ÉN skærm, målt to gange
her som en kontrol (og de stemmer da også overens: 5999-6001ms TTI, 69/66
perf — forskellen i perf-score/CLS mellem de to er selve målestøjen på en
enkelt, fælles skærm, ikke to reelt forskellige skærme).

**Sæt-logger kan slet ikke Lighthouse-måles i den ægte app.** `AthleteView.jsx`
har ingen URL-baseret routing — sæt-loggeren nås kun via et klientside
faneskift (`setTab('program')`), som en kold Lighthouse-sidenavigation ikke
kan ramme. Målt i stedet som en klik→synlig-overgang under samme
CPU/netværks-emulering (se `scripts/maal-telefon.mjs`s kommentar) — 244ms,
"Føles som en app". Dette er den ÆRLIGE pointe: harnessens perf-100 var ikke
"løgn" for selve klik-overgangen (den er faktisk hurtig, fordi data allerede
er hentet ved app-åbning) — løgnen lå i at harnessen aldrig betalte prisen for
at KOMME DERTIL (de 6s/57 kald "Dagens pas" nu viser).

## Netværkskald-fund (uddybes med rettelse i commit 2a)

Netværksloggen for "Dagens pas"/"Check-in" viser `profiles?select=role`
hentet TO GANGE (med hver sin CORS-preflight) ved hver eneste app-åbning — et
race i `src/App.jsx` mellem `supabase.auth.getSession().then(...)` og
`onAuthStateChange`s første fyring, begge kaldende `resolveRole` for samme
bruger samtidig. Rettes i commit 2a.

## Grænser

Målt mod en lokal mock (`e2e/mock-supabase.mjs`), ikke en rigtig
Supabase-instans, og over localhost, ikke et rigtigt mobilnet. Se
`docs/MAAL-TELEFON.md`.
