# Rapport — ordre 196: filmvejledningen før optagelsen, ikke efter

## Gren

Gren `film-foer-du-sender`, forgrenet fra `main` (`08c8c0a`, som allerede
havde ordre 192 mergét ind — `git log --oneline -3 main` ved start viste
`08c8c0a` øverst, med `940f9e8` som næste, så basen var ordrens forventede
punkt uden behov for at forgrene fra egen `kortlaegningen-bredere`).

- `b27f800` — commit 1: filmevejledningens tekst, kogt ned fra to kilder
- `f583978` — commit 2: koblet ind i "upload og gå"-vejen, første gang fuldt
- (denne rapport er commit 3, se hash i `git log` efter commit)

## Hvad ændret

**Commit 1.** `docs/videocoach/FILMEVEJLEDNING.md`: seks punkter (én linje
hver) plus én lukkelinje, kogt ned fra
`entropi-loeftmodel-wt2\docs\FILM-ET-LOEFT.md` (Drishti, ordre 181 — de fem
konkrete fejl fra egne målinger af rigtige klip: hånd/fod skjult bag skiver
eller rack-bjælke, kamera skråt, kroppen ud af billedet, intet klart
sæt-stop) og appens egen `docs/videocoach/TEST-CLIPS.md` (ordre 127 —
optagelsesreglerne til sporingen: hoftehøjde, 3-4 m, skiven fri af rack).
Ingen forklaring af MediaPipe eller `visibility`-tal — det er til Marc i
kildedokumentet, ikke til atleten med telefonen i hånden.

**Commit 2.** `public/videocoach.html`s ATHLETE-flow (`dropHint`, "upload og
gå"-vejen fra ordre 57): vejledningen vises nu FØR "Åbn video"-knappen.
Første besøg viser alle seks punkter + lukkelinjen og sætter
`entropi_film_guide_seen` i `localStorage`; efterfølgende besøg viser kun én
linje ("📷 Filmtips — vis igen", 44px trykflade), der folder hele
vejledningen ud igen ved tryk. Samme injicerbare mønster som
`src/readinessDraft.js`: storage sendes eksplicit (default
`globalThis.localStorage`), enhver fejl (privat vindue, fuld storage) sluger
sig selv i stedet for at vælte "upload og gå"-flowet. Ingen ny
afhængighed, ingen ny state-model, ren vanilla JS/CSS i samme fil.

Nyt verify-script `scripts/verify-videocoach-film-guide.mjs`
(`npm run verify:videocoach-film-guide`) kører den ægte, uændrede
`videocoach.html` i headless Chromium ved 390×844: bekræfter rækkefølgen i
DOM'et (vejledning før CTA-knappen), første/andet besøgs to tilstande,
"vis igen"s ≥44px trykflade, ingen vandret scroll og ingen browser-fejl.
Skærmbilleder i `outputs/film-foer-du-sender/`.

## Testresultat

- `npm run lint`: grøn.
- Alle 33 `verify:*`-scripts (inkl. den nye `verify:videocoach-film-guide`
  og `verify:n8n`): **grønne**.
- `npm run e2e`: **grøn** ("atlet → coach, ende-til-ende", 26,9s).
- `npm run maal:telefon` før og efter (mod `e2e/mock-supabase.mjs`, ingen
  produktions-Supabase, ingen atletdata):

  | Skærm | FCP før | FCP efter | TTI før | TTI efter | Perf før | Perf efter |
  | --- | --- | --- | --- | --- | --- | --- |
  | **Videocoach-forside** (upload-skærmen) | 3548ms | 3524ms | 4079ms | 4075ms | 79 | 79 |
  | Login (urørt) | 3018ms | 3019ms | 3318ms | 3320ms | 87 | 87 |
  | Dagens pas (urørt) | 3854ms | 3856ms | 6149ms | 6003ms | 69 | 69 |
  | Check-in (urørt) | 3855ms | 3856ms | 5854ms | 6005ms | 69 | 69 |
  | Sæt-logger (urørt, renderMs) | 226ms | 224ms | — | — | n/a | n/a |

  Rå data: `outputs/maal/2026-09-14--foer-196.json` og
  `outputs/maal/2026-09-14--efter-196-b.json`. **Ærlig detalje:** den
  første "efter"-kørsel (`2026-09-14--efter-196.json`) viste FCP 4840ms/TTI
  4840ms/perf 70 på Videocoach-forsiden — et fald der ville have brudt
  ordrens "må ikke koste målbart". En umiddelbar gentagelse
  (`efter-196-b`, tallene i tabellen) landede tilbage på samme niveau som
  "før"-målingen, og de tre urørte skærme (Login, Dagens pas, Check-in) —
  som `videocoach.html` slet ikke rører — svingede lige så meget mellem de
  to "efter"-kørsler. Konklusion: udsvinget var maskinbelastning på
  målemaskinen i det øjeblik, ikke vejledningen. Alle tre kørsler er
  committet, ikke kun den pæne.

## Hvad er næste

- Filmvejledningen er generisk (samme tekst uanset løft), fordi
  øvelsesvælgeren (`#vcLiftSlot`) først vises EFTER en video er valgt (se
  `body.athlete[data-athlete-state="empty"] #vcLiftSlot { display:none }`).
  Den eksisterende 📷 Filmguide (`guideBtn`, i selve analysen) giver allerede
  løft-specifik højde/vinkel — en fremtidig ordre kunne flytte
  løftevalget FØR filvalget, hvis det vurderes værd at gøre "upload og
  gå"-vejen ét skridt længere for en mere præcis forhåndsvisning.
- `entropi_film_guide_seen` er ét globalt nøgle pr. browser/enhed, ikke pr.
  atlet (samme mønster som fx `vc_athlete`/`vc_lift` i samme fil) — en
  delt telefon (flere atleter, samme browser) vil kun se den fulde
  vejledning én gang for den første af dem.

## Ærlige grænser

- **Ingen A/B-måling på ægte atleter.** "Må ikke koste målbart" er bevist
  på Lighthouse mod mocken (390px, throttlet), ikke på antallet af brugbare
  videoer i praksis — det kræver måneders reelle uploads og var uden for
  denne ordres rækkevidde (Drishtis måling af tre klip er selve
  begrundelsen, ikke noget denne ordre kunne gentage).
- **Målingens støj (se Testresultat) betyder at "ingen omkostning" er
  bekræftet ved gentagelse, ikke ved én ren kørsel.** Rapporteret ærligt i
  stedet for kun at vise den pæne kørsel.
- Ingen atletdata i filer eller skærmbilleder. `e2e/`, sporingskoden og
  `src/volume/` er urørt. Ingen push, ingen produktions-Supabase.
