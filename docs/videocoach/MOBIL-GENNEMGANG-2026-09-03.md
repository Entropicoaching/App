# MOBIL-GENNEMGANG — videocoach.html, athlete-flow — 2026-09-03

ORDRE 26. Appen kørt headless i 390×844 (iPhone 12/13/14-bredde) mod den lokale
`vite`-server, i selve `videocoach.html`'s athlete-tilstand (ingen query-params —
`ATLETE=true` er default uden `?coach=1`). Uploadflowet er testet med en rigtig,
i-browser genereret WebM-klip (MediaRecorder over et canvas), fordi der ikke
findes noget versioneret testklip i repoet og `file_upload`-værktøjet kræver en
lokal fil. Da synthetiske klip ikke giver browseren `loadedmetadata` (ingen
rigtig video-kodning), er "video klar"-tilstanden sat direkte via de samme
kald appen selv foretager i `begin()` (canvas-dimensioner, `dropHint.hidden`,
`setAthleteState('ready')`) — det ændrer intet ved UI'et, kun ved hvordan
video-afkodningen blev omgået for at nå frem til det.

Gennemgået: åbn video → afspil/spol → sæt start → markér skiven (skive ikke
fundet, faldt til 3-punkts manuel guide, som forventet uden ægte billede) →
zoom/panorering (kode-gennemgang — rent gestus-baseret, ingen dedikerede
knapper; senest rettet i `401c86f` og låst af `verify:videocoach-zoom`, ingen
nye fund) → Send-arket (åbnet direkte via `setAthleteSubmitOpen(true)`).

## Friktionspunkter (alle fund)

| # | Sted | Fund | Mål |
|---|---|---|---|
| 1 | Top: statusbanner (`#banner`) vs. systembjælke + øvelsesvælger | Banneret ligger `top:10px`, men den faste systembjælke (`#vcSystemBar`, højde 67px, z-index 40) og øvelsesvælgeren (`#vcLiftSlot`, `top:68px`) ligger BÅDE oven på OG lige under banneret. Statustekster som "Kunne ikke finde skivens kant · 1/3 · Tryk på skivens TOP" bliver delvist skjult bag bjælken — atleten kan gå glip af den ene guide-tekst, appen har til at fortælle hvad der skal ske nu. | Overlap 68×44 px mod fane-bjælken, 14×14 px mod vælgeren (se screenshot) |
| 2 | Transportrække (`#scrubRow`) | Fire ikonknapper i træk: "sæt start"-cirklen (↤), frame-tilbage (‹), frame-frem (›), mute — alle under 44 px i mindst én led, tæt pakket (8 px mellemrum til nabo-knap) | ↤ 38×38 · ‹/› 38×42 · mute 36×36 |
| 3 | "Sæt start her" (`#athleteMarkStartBtn`) | Den FØRSTE obligatoriske handling i hele flowet (uden den er "Stangbane"-knappen låst) har kun 36 px højde | 112×36 |
| 4 (mindre, ikke rettet) | `#vcLiftSlot select` (øvelse-vælger) | 4 px under grænsen | 104×40 |
| 5 (mindre, ikke rettet) | `#vcWorkspaceTabs` faneknapper i athlete | Selve tryk-fladen er 44 px (fint), men label-teksten er kun 8 px — svær at læse, ikke et tryk-mål-problem | — |

Ingen tekst var reelt AFKLIPPET (ingen `overflow:hidden` der skar ord over),
og ingen knap krævede pixel-præcision et tryk ikke kan ramme — problemerne er
konsekvent for små tryk-flader og ét reelt visuelt overlap.

## De tre rettede (én commit hver, kun `body.athlete`-scopede regler)

1. **Banner-overlap** — `#banner` flyttet ned til `top:116px` for `body.athlete`,
   under både systembjælken (67px) og øvelsesvælgeren (68–108px). Kun
   `body.athlete`, så coachweb/desktop er uændret.
2. **Transportrækkens ikoner** — `#athleteStartBtn`, `#backS`/`#fwdS` og
   `#muteBtn` sat til 44×44 px under `body.athlete`. Rækken har rigeligt
   plads (målt bredde 366 px, fire knapper á 44 px + skyder fylder ~324 px).
3. **"Sæt start her"** — `min-height:44px` tilføjet til
   `body.athlete #athleteMarkStartBtn`.

Alle tre rettelser er scopet til `body.athlete …`-selektorer, som kun
tilføjes når `ATHLETE` er sand (aldrig på desktop — `DESKTOP` og `SLIM` er
gensidigt udelukkende i koden). Desktop-CSS er ikke rørt.

## Screenshots

Før/efter ligger som separate filer i afleveringen (se rapport til Marc).

## Ærlige grænser

- Video-afspilning er ikke testet med en RIGTIG optagelse (ingen klip i
  repoet, intet netværksadgang til at hente ét) — kun det UI, der er
  uafhængigt af faktisk billedindhold. Fejl der kun opstår ved ægte
  video-afkodning (f.eks. Android-specifik `loadeddata`-timing) er ikke
  dækket af denne gennemgang.
- Zoom/panorering er vurderet ved kodegennemgang + eksisterende
  `verify:videocoach-zoom`, ikke ved en ny fysisk to-finger-gestus i
  automationen (ingen touch-emulering med ægte multi-touch-koordinater var
  tilgængelig) — men logikken er identisk med det, testen allerede låser.
- Skive-detektionen faldt til den manuelle 3-punkts-guide, fordi
  testvideoen er blank — den automatiske ring-UI (`plateConfirm`) er derfor
  ikke visuelt afprøvet på mobil i denne omgang.
- Fire mindre fund (#4, #5 i tabellen) er IKKE rettet — de er under
  budgettet for "de tre værste", og #5 er en læsbarheds-, ikke et
  tryk-mål-problem.
