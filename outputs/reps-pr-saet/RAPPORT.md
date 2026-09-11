# Rapport: reps må være forskellige fra sæt til sæt (ORDRE 106)

## Modellen (commit 1)

**Hvordan et ordineret sæt er repræsenteret**

- `exercises.reps` er en fri tekststreng, ikke et struktureret felt. Coachen
  skriver den i et almindeligt tekstfelt: `src/Dashboard.jsx:3248`
  (`['Reps', 'reps', 'text']`), gemmes uændret ved oprettelse/redigering
  (`src/Dashboard.jsx:1818`, `:1832`) og ligger i formularens state som
  `exerciseForm.reps` (`src/Dashboard.jsx:579`).
- Der findes ingen egen kolonne eller markør for "interval" eller "frit" i
  dag — coachen kan allerede skrive `"4-6"` i feltet, men appen behandler det
  ikke som et interval noget sted. Det eneste sted strengen tolkes som tal er
  `parseInt(...)`, som for `"4-6"` giver `4` (stopper ved bindestregen) — både
  i opvarmningsberegningen (`src/warmup.js:77`) og i sæt-loggeren (se
  nedenfor). Der er ingen eksisterende "frit"-konvention at genbruge.
- `exercises.sets` derimod er numerisk (`['Sæt', 'sets', 'number']`,
  `src/Dashboard.jsx:3248`).

**Hvordan loggede reps gemmes i dag**

- Loggede sæt gemmes allerede **pr. sæt**, ikke pr. øvelse: tabellen
  `exercise_logs` har én række pr. `(exercise_id, set_number)` med kolonnen
  `reps_completed` (bekræftet i alle læsninger/skrivninger, fx
  `src/AthleteView.jsx:2745-2757`, `:2862-2869`, `supabase/sql/training-signals-v1.sql:33`).
  Der er altså **ingen skemaændring nødvendig** — strukturen understøtter
  allerede forskellige reps fra sæt til sæt.
- Problemet er i UI/skrivelogikken: sæt-loggeren i `AthleteView.jsx` har
  ikke noget indtastningsfelt for reps. Linje `4991` viser kun en statisk,
  ikke-redigerbar label `× {ex.reps || '—'}`, og knappen "Log"
  (`src/AthleteView.jsx:4997`) kalder
  `logSet(ex.id, setNum, ex.sets, ex.reps, plannedRpe)` — den sender altid
  **ordinationsstrengen** `ex.reps` ind som `repsCompleted`, uanset hvad
  atleten faktisk lavede. Inde i `logSet` (`:2745-2760`) bliver den
  `parseInt`'et: `reps_completed: parseInt(repsCompleted) || 0` (`:2750`).
  - Ved fast ordination (`"8"`) rammer det tilfældigvis rigtigt, hvis
    atleten laver præcis det antal — men fanger ikke afvigelser.
  - Ved interval-ordination (`"4-6"`) logges **alle** sæt altid som `4`,
    uanset om atleten lavede 4, 5 eller 6 reps i det enkelte sæt. Det er
    kernefejlen ordren beder om at rette.

**Hvad e1RM-grafen, check-in og Coach Briefing læser**

Alle nedenstående læser allerede `exercise_logs.reps_completed` pr. sæt —
ingen af dem skal ændres for at se faktiske reps, når commit 2 begynder at
gemme dem korrekt:

- **e1RM-graf / ugentlig volumen (atlet-visning)**:
  `src/AthleteView.jsx:2507-2545` henter `weight, reps_completed, logged_at`
  pr. logget sæt, summerer tonnage (`weight * reps_completed`, `:2539`) og
  regner ugens bedste e1RM med Epley pr. sæt (`:2541-2543`).
- **"Sidst logget" under hver øvelse (atlet)**:
  `src/AthleteView.jsx:2672-2709` og `:4788-4797` (`exerciseHistory`).
- **PR-detektion** (kører direkte i `logSet`):
  `src/AthleteView.jsx:2811-2857` sammenligner `reps_completed` pr. sæt for
  at afgøre vægt-/rep-/styrke-PR.
- **Coach-visning af ugentlig volumen/PR**:
  `src/Dashboard.jsx:5210-5231`, `:5290-5301`.
- **Coach Briefing** (AI-prompt-teksten coachen sender):
  `src/Dashboard.jsx:2724-2731` (ugentlig tonnage),
  `:2783-2796` (per-sæt-linjer "Sæt N: {weight}kg × {reps}"),
  `:2927-2935` (JSON-payload `reps_completed: log.reps_completed`).
- **Dashboard's egen sæt-for-sæt-visning af atletens log**:
  `src/Dashboard.jsx:7255-7260`, `:7387`, `:7464`, `:7111-7119`.

**Konklusion før noget ændres**

Ingen skemaændring. Fikset er isoleret til `AthleteView.jsx`'s sæt-logger:
den skal (a) genkende hvornår `ex.reps` er et interval (`"4-6"`) eller
markeret "frit", (b) i så fald vise et lille redigerbart repsfelt pr. sæt i
stedet for den statiske label, forudfyldt med intervallets nederste tal, og
(c) sende den faktiske, indtastede værdi til `logSet` i stedet for
`ex.reps`. Alt nedstrøms (e1RM, check-in, Coach Briefing) opdateres
automatisk, fordi det allerede læser `reps_completed` pr. sæt.
