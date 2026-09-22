**main kan pushes: ja**

# Rapport — ordre 325: coachen kan markere et punkt under "Kræver dit blik" som set, og mailen ved det (to blokke)

Planet: coaching · Spor: spor-check-in-bevist-over-en-hel-blok-56aed8

n8n's Coach Briefing-mail (RAPPORT-317) sender nu kun når noget under "Kræver dit blik" har ventet over 48 timer. Men RPC'en `entropi_coach_briefing_v1` havde intet "set"-felt — den kunne kun bruge alder, aldrig se om Marc allerede havde set punktet i appen. RAPPORT-317's eget fund var præcist: hullet gjaldt `unread_messages[].latest_at` og `video_drafts[].created_at` — ikke træningssignaler, som allerede kvitteres/udsættes via `coach_signal_actions` og derfor aldrig når RPC'en igen.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja — det lukker et navngivet, dokumenteret hul (RAPPORT-317) i Marcs sikkerhedsnet-mail, så en allerede-set besked eller video ikke gentager sig i indbakken.

## Gren

Gren `set-i-briefing`, forgrenet fra `main` (`8fadcd0`).

- `7cb9ae6` blok 1: "Set" i appen (besked/video-punkter) + `coach_briefing_seen`-tabellen og RPC-udvidelsen (SQL, ikke kørt)
- denne commit: blok 2 (enhedstest på punkt-nøglens stabilitet, headless prøve på to viewports, `proever.mjs` som nr. 15, denne rapport)

Arbejdstræet er rent efter denne commit. Ingen push, ingen migration kørt, ingen atletdata. Atletens visninger er ikke rørt.

## Hvad ændret

**Blok 1**
- `supabase/sql/coach-briefing-seen-v1.sql` (ny, **ikke kørt** — Dhruva kører først efter Marcs ja): opretter `public.coach_briefing_seen` (coach_id + point_key + seen_at, RLS kun egen coach, samme mønster som `coach-signal-actions-v1.sql`) og erstatter `entropi_coach_briefing_v1`s krop (samme signatur/adgang) så hvert punkt i `unread_messages`, `video_drafts` og `training_signals` bærer `point_key` og `seen_at`. Beskeders punkt-nøgle er atlet+spor+UTC-dato af seneste ulæste besked (`to_char(... at time zone 'utc', 'YYYY-MM-DD')`); video er atlet-uafhængig analysens id; signal er atlet+detector (allerede filtreret af `coach_signal_actions`, så `seen_at` her er mest for ensartethed).
- `src/coachBriefingSeen.js` (ny): `coachBriefingPointKey(item)` — samme nøgleform som SQL'en over, brugt af appen ved skrivning; `coachBriefingSeenErrorMessage(error)` — samme "kopieret, ikke stille"-princip som `automationAlertResolveErrorMessage` (301): findes tabellen ikke endnu (kode `42P01`/`PGRST205`/`PGRST202`), vises "databasetabellen findes ikke endnu" i stedet for en stille fejl.
- `src/Dashboard.jsx` ("Kræver dit blik"-forhåndsvisningen på forsiden):
  - nyt state `coachBriefingSeen` (punkt-nøgle → `seen_at`), hentet i `refreshCoachInbox` via `fetchCoachBriefingSeen()` (fejler stille til tomt, da en manglende tabel er det FORVENTEDE normaltilstand før SQL'en køres — kun selve trykket skal larme).
  - `handleCoachBriefingSeen(item)`: upserter `{coach_id, point_key, seen_at}`, viser samme grønne/røde flash som automatiseringsfejl.
  - besked- og video-punkter får et 44×44 px "Set"-tryk; sete punkter dæmpes (opacity) og synker til bunden af listen (stabil sortering, punktet fjernes ikke). Signal-punkter beholder deres eksisterende "Set" (kvittér/udsæt via `coach_signal_actions`) uændret — se "Ærlige grænser" for hvorfor der ikke er to "Set"-knapper på samme punkt.

**Blok 2**
- `src/coachBriefingSeen.test.js` (ny, 7 tests): punkt-nøglens stabilitet — signal er stabil for samme atlet+detector og skifter ved en anden af de to; video er stabil pr. id; besked er stabil INDEN FOR samme UTC-dag men skifter ved en ny kalenderdag (regressionstest for hele pointen: uden dato-delen ville "Set" på en besked i dag dæmpe en ægte NY besked i morgen for evigt); teknik/besked er to forskellige punkter; manglende data giver `null`, aldrig en vildledende nøgle; fejlteksten dækker både fejlkode og tekstmønster for "tabel findes ikke".
- `e2e/coach-briefing-seen.spec.mjs` (ny) + `npm run e2e:coach-briefing-seen`: seeder tre punkter (to ulæste beskeder på hvert sit spor + et video-udkast), trykker "Set" på video-punktet, bekræfter at det dæmpes og synker til bunden (bliver stående, `mock.table('coach_briefing_seen')` får præcis én række), og at et helsides `page.reload()` stadig viser punktet dæmpet nederst — beviser at "Set" kommer fra mocken (den ægte hente-vej), ikke kun fra React-state. Kørt på **390×844** og **desktop 1280×900**, skærmbilleder i `outputs/_seneste/e2e/`.
- `scripts/proever.mjs`: ny prøve nr. 15.
- `package.json`: `e2e:coach-briefing-seen`.

## Testresultat

- `npm run lint`: ren.
- `node --test src/coachBriefingSeen.test.js`: 7/7 grønne.
- **Headless prøve** (`e2e/coach-briefing-seen.spec.mjs`, mod mock-Supabase og lokal vite, 390×844 og desktop): alle tre punkter vises uden noget sat fra start → "Set" på video-punktet dæmper det og sender det til bunden (de to andre punkter uændrede, stadig aktive) → mockens `coach_briefing_seen` har præcis én række (`coach_id` + `point_key` + `seen_at`) → et helsides genindlæs viser punktet dæmpet nederst igen uden en ekstra række. Ingen browser-fejl på nogen af de to viewports.
- **Én ubrudt `npm run proever`, port 8991 tjekket først (fri): 88/88 grønne** (0 fejl, 0 sprunget over) — 35 enhedstestfiler (heraf 1 ny), 37 `verify:*` og 16 e2e (heraf 1 ny).
- `outputs/314/` og `outputs/ugen-faar-dato/` blev igen overskrevet af den fulde prøve-kørsel og rullet tilbage med `git checkout`, så de sporede skærmbilleder ikke er med i denne commit (samme kendte adfærd som i rapport 320/314/301/293).

## Hvad er næste

- Dhruva kører `supabase/sql/coach-briefing-seen-v1.sql` mod produktion, efter Marcs ja — det opretter `coach_briefing_seen` og erstatter `entropi_coach_briefing_v1`s krop (samme signatur, additiv).
- **Til Vidhi (entropi-n8n):** når SQL'en er kørt, kan Coach Briefing-workflowets "Keep unresolved backup items"-node læse `seen_at` på hvert punkt i `unread_messages[]`/`video_drafts[]`/`training_signals[]` (null = aldrig set) i stedet for kun alder — RAPPORT-317's `fallback_policy.seen_field_available: false` kan da sættes til `true`, og et punkt Marc allerede har set i appen kan udelades af mailen selv om det er over 48 timer gammelt.
- Dhruva merger, Marc pusher (push = deploy) — men først efter SQL-kørslen, ellers fejler "Set" synligt i appen (det er testet og tilsigtet, ikke en fejl).

## Ærlige grænser

- **Kun besked- og video-punkter får den nye "Set"-knap i appen.** RAPPORT-317's fund var specifikt de to typer; træningssignaler har allerede en fungerende "Set"/"Udsæt" via `coach_signal_actions`, som allerede fjerner dem fra RPC'en helt (ikke bare dæmper). At tilføje endnu en "Set"-knap med samme label på et signal-punkt ville give to knapper med identisk tekst og to forskellige, delvist overlappende betydninger — en unødig forvirring ordren ikke bad om at løse. Automatiseringsfejl har sin egen "Markeret som set" inde i selve Indbakken og indgår slet ikke i denne RPC. Dette er et valg truffet uden at spørge (ordrens egen regel: vælg det fornuftige, notér, fortsæt), ikke en ordre-instrueret afgrænsning.
- **RPC-udvidelsen er skrevet, men ikke kørt eller verificeret mod en rigtig Postgres.** SQL'en er læst grundigt mod originalen og genbruger dens eksisterende mønstre (samme adgang, samme signal-motor-swap), men `to_char(... at time zone 'utc', ...)`-udtrykket for beskeders punkt-nøgle er kun bekræftet ved læsning, ikke ved kørsel — det er uden for denne ordres "ingen migration"-grænse at teste mod en ægte database.
- **`coachBriefingSeen`-state genindlæses ikke øjeblikkeligt på tværs af faner/enheder.** Ligesom automatiseringsfejl og træningssignaler hentes den kun ved `refreshCoachInbox` (mount, fokus, 5-minutters-interval) — trykker Marc "Set" på telefonen, ser han det ikke på computeren før næste opdatering.
- Alt er kørt headless mod mock-Supabase og lokal vite, ikke mod produktion.

main kan pushes: ja
