# STILLE-FEJL-5 — hele atletens dag, runde 5 (ordre 131)

Runde 1-4 (ordre 41/64/68/76) fandt og rettede G1-G13 (se
`outputs/stille-fejl-4/RAPPORT.md` for det fulde katalog). Denne runde gik
HELE atletens dag igennem én gang til, med ét spørgsmål: hvor kan noget gå
galt UDEN at atleten får det at vide, eller UDEN at coachen får det at vide?

**Metode**: samme som runde 1-4 — statisk gennemgang af hver kode-vej
(`AthleteView.jsx`, `athlete*.js`, `videocoach.html`, upload-vejen) med de
otte fejltyper fra ordren i tankerne ved hvert Supabase-kald: net væk midt
i, 500 fra Supabase, storage-upload afvist, tom respons, langsom respons
> 10s, browser der mister fokus midt i upload. Ingen levende attrap-server
er bygget (se "Ærlige grænser" i `docs/RAPPORT-131.md` for hvorfor og hvad
det betyder for tilliden til fundene) — hvert fund er sporet til en
konkret kodelinje og et konkret scenarie, ikke en formodning.

Gennemgangen fulgte ordrens rækkefølge: login → dagens pas → opvarmning →
sæt-logger (interval-reps) → check-in → videocoach (upload og gå, Vis mig
nu, manuel skive) → logout.

## Nye fund (G14-G16)

| # | Sted | Hvad går galt | Hvad atleten ser | Hvad coachen ser | Alvor |
|---|---|---|---|---|---|
| G14 | Sæt-logger — PR-detektion (`logSet`, `AthleteView.jsx`) | `INSERT` på `personal_records` blev aldrig fejltjekket. Fejler skrivningen (net væk, 500), kører koden videre som om PR'en er gemt. | En ægte "PR!"-fejring (konfetti-toast) på et løft der reelt IKKE er registreret som personlig rekord — atleten fejrer noget databasen ikke ved. | Intet. PR'en mangler stille fra `personal_records`, ingen fejl nogen steder. | **Høj** — sker automatisk hver gang et sæt kvalificerer til PR, giver en ligefrem FORKERT bekræftelse (ikke bare tavshed), og forurener fremtidig PR-sammenligning for øvelsen. |
| G15 | Dagens pas — vægtlogning (`logWeight`, `AthleteView.jsx`) | Hverken `update` eller `insert` på `weight_logs` blev fejltjekket. Feltet ryddes og "gemt"-tilstanden vises UANSET udfald. | Feltet tømmes som ved en normal gemning — ingen fejl, ingen antydning af at intet blev gemt. Kun et efterfølgende blik på kropsvægt-grafen (uændret) ville afsløre det, og kun hvis atleten selv lagde mærke til det. | Intet. | **Mellem** — dagligt/ugentligt tilbagevendende handling, rammer alle atleter, men tabet er "kun" ét datapunkt, ikke træningsdata. |
| G16 | Videocoach — "upload og gå" (`AthleteView.jsx`, besked-handleren for `upload-and-go`) | Lukkes/genindlæses fanen midt i selve videooverførslen (baggrunds-suspendering på mobil, appen tvunget lukket, batteri løbet tør) når INGEN kode nogensinde færdig — hverken succes- eller fejl-håndteringen når at køre. | Ingenting — hvis atleten ikke selv sidder og venter på skærmen til uploaden er færdig, aner hun ikke om videoen nåede frem. Findes intet spor før denne rettelse. | Intet — ingen `video_analyses`-række oprettes for en video der aldrig når hele vejen, så den forsvinder fuldstændig fra coachens side. | **Høj** — det eneste af de otte injicerede fejlscenarier ordren selv fremhæver ("browser der mister fokus midt i upload"), og videoen (ikke kun et datapunkt) går tabt uden nogen mulighed for at opdage det uden denne rettelse. |

Alle tre er nu rettet — se `docs/RAPPORT-131.md` for detaljerne og verify-scriptet
(`npm run verify:athlete-silent-fails-5`).

## Gennemgået, intet nyt fund

Resten af dagens vej blev gennemgået med samme otte fejlscenarier, uden nye
G'er af høj/mellem alvor:

- **Login (`Auth.jsx`)** — `signInWithPassword`/`resetPasswordForEmail`
  tjekker allerede `{ error }` og viser en oversat fejl
  (`athleteAuthErrorMessage`). Ikke Bhishaks filområde (delt med
  coach-login) — ingen ændring foretaget, kun læst.
- **Dagens pas (program/uge-visning)** — `fetchProgram` og de øvrige 18
  læsninger blev allerede lukket i ordre 76 (G1, `athleteReadGuard.js`).
  Ingen ny rå læsning fundet.
- **Opvarmning** — mobilitets-/opvarmningstimeren blev allerede rettet i
  ordre 76 (G5, `restTimer.js`, driftsikker ved baggrundslåst skærm).
  Atletens vægtrettelse pr. opvarmningssæt (`warmupOverride.js`) er
  ren `localStorage`, ingen netværksvej og dermed ingen stille-fejl-risiko.
- **Check-in (parathed)** — `saveReadiness` viser allerede en oversat fejl
  ved en mislykket `insert` (ikke tavs), og udkastet overlever et
  fanelukke via `readinessDraft.js` (ordre 76, G12). Ingen automatisk
  genforsøgskø her — vurderet unødvendigt, da fejlen allerede er synlig
  og ikke tavs.
- **Videocoach — "Vis mig nu" og manuel skivekalibrering** — begge kører
  udelukkende lokalt (sporing/UI i selve videoen) og rammer først et
  Supabase-kald ved selve afsendelsen, som er samme kodevej som G16
  ovenfor. Manuel kalibrering (ordre 109) har allerede sin egen
  whitelistede årsagskode i `session_context.plate_calibration`.
- **Logout** — `signOutHard` (ordre 20, `supabase.js`) rydder ALTID den
  lokale session uanset om netværkskaldet lykkes, fejler eller timer ud.
  Allerede robust.

## Kendte, urørte fund (ikke del af denne runde)

Nævnt for fuldstændighed, ikke rettet her — uden for ordrens
gå-igennem-liste eller allerede vurderet lav alvor i tidligere runder:

- **F3** (`outputs/stille-fejl-4/RAPPORT.md`) — `markTrackRead` (læst-
  markering af en besked-track) har stadig intet fejltjek. Lav alvor
  (kun en ulæst-badge der kan hænge lidt for længe), uændret siden ordre 76.
- **Madlogning** (`deleteTemplate`, `saveCustomFood`) — begge har svage,
  utjekkede skrivninger (opdaget under denne gennemgang, men "beskeder"/
  "kost" er ikke del af ordrens gå-igennem-liste for runde 5). Lav alvor:
  ingen af dem mister TRÆNINGSdata, kun madskabeloner/-favoritter.
