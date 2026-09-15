# Rapport — ordre 209: Marcs rettelser følger ham, ikke browseren

## Gren

Gren `rettelser-i-supabase`, forgrenet fra `main` (`5fe52f5` — ordrens
forventede base, `git log --oneline -1 main` ved start bekræftede det).

- `4683302` — commit 1: migrationen, til godkendelse, ikke kørt
- `9e85d91` — commit 2: lageret bag én grænseflade
- `008b38a` — commit 3: mocken og UI'et
- `8a3c71b` — commit 4: ingen atlet-facing visning findes (dokumenteret, intet at koble op på)
- (denne rapport er commit 5, se hash i `git log` efter commit)

## Commit 1 — migrationen, til godkendelse, ikke kørt

`docs/supabase/20260915-exercise_muscle_overrides.sql`: ny tabel
`exercise_muscle_overrides` — `coach_id` (FK til `profiles`), normaliseret
øvelsesnøgle + det oprindelige øvelsesnavn (se "Valg" nedenfor for hvorfor
begge), `groups jsonb`, `set_by`, `created_at`/`updated_at`, unik pr.
`(coach_id, exercise_key)`. RLS: kun coachen selv læser/skriver sine egne
rækker, samme mønster som `coach_signal_actions`
(`supabase/sql/coach-signal-actions-v1.sql`). Additiv, `begin`/`commit`,
ingen eksisterende tabel/kolonne rørt. Ingen kald mod produktion —
`docs/supabase/20260915-exercise_muscle_overrides.md` er den ene side der
siger hvad Marc godkender og den præcise kommando Dhruva kører efter hans ja
(se "Hvad Dhruva kører" nedenfor).

**Valg (stå på skuldre af 185's egen skitse i `rettelser.js`'s kommentar):**
185's skitse nævnte kun `exercise_name text primary key` (ét felt). Jeg
tilføjede en separat `exercise_key` (normaliseret, den faktiske unikke
nøgle) OG beholdt `exercise_name` (som coachen skrev det, til visning) —
uden det ville UI'et miste "Zercher squat"-casingen og kun vise
"zercher squat", en regression ift. hvad `KortlaegningRedigering.jsx`
allerede viser i dag. Noteret, ikke spurgt, per ordrens egen instruks.

## Commit 2 — lageret bag én grænseflade

`src/volume/rettelser.js` omskrevet: samme fem funktioner (de tre
offentlige — `hentRettelser`/`gemRettelse`/`fjernRettelse` — plus de to
interne `laesAlle`/`skrivAlle`), nu bag to bagender. Valget sker ved
kørsel: ét billigt `select(.., {head:true, count:'exact'})`-opslag mod
tabellen, cachet pr. Supabase-klient, der fejler stille og falder tilbage
til `localStorage` ved enhver fejl (tabel findes ikke endnu, ingen
forbindelse, RLS afviser). Alle tre offentlige funktioner er nu **async**
(en Supabase-bagende kan ikke være andet) — kaldere opdateret i commit 3.

**Flyt-op:** findes der lokale rettelser fra før migrationen, når tabellen
første gang findes, flyttes de op automatisk (delete+insert pr. række,
samme "sidste skrivning vinder"-ånd som `localStorage`-versionen altid har
haft) og markeres flyttet i `localStorage`, så det kun sker én gang pr.
browser. Fejler det (netværk nede midt i flytningen), markeres intet, og
det prøves igen ved næste kald — idempotent, ingen dubletter ved gentagne
forsøg.

**Valg:** delete+insert i stedet for `upsert` — samme "erstat helt"-logik
som `localStorage`-versionens filter+push allerede havde, og undgår at
skulle emulere en sammensat `on_conflict`-nøgle i e2e-mocken (se commit 3).

18 tests i `rettelser.test.js` (op fra 8), begge bagender + flyt-op-stien +
coach-scoping (to coaches deler ikke hinandens rettelser), mod en minimal
fake Supabase-klient bygget til testen (ikke en generel PostgREST-klon,
samme ånd som `e2e/mock-supabase.mjs`, men på unit-niveau uden HTTP).

## Commit 3 — mocken og UI'et

**`e2e/mock-supabase.mjs`** (mocken ændret, specernes indhold urørt):

- Understøtter nu `HEAD`-metoden generelt (brugt af `head:true`-opslaget i
  commit 2) — sætter `Content-Range` for `count`, ingen body. Ingen anden
  del af appen brugte `head:true` før nu, så dette var et reelt hul i
  mocken, ikke kun for denne tabel.
- `DELETE` sætter nu altid `Content-Range` med det faktiske antal slettede
  rækker (`fjernRettelse`s `.delete({count:'exact'})` afhang af det) —
  mocken satte den aldrig før, uanset tabel; en generel rettelse, ikke en
  special-case.
- `E2E_HIDE_TABLES` (kommasepareret env, læst én gang ved mockens opstart —
  IKKE en spec-fil): sætter mocken til at svare "relation findes ikke" for
  navngivne tabeller, så `rettelser.js`s `localStorage`-fald kan proves i
  e2e uden at røre en eneste eksisterende spec. Standard (ingen variabel
  sat, alle nuværende specs): opfører sig som enhver anden tabel i mocken —
  findes, tom, som `ensure()` altid har gjort.

Verificeret manuelt mod en **ægte `@supabase/supabase-js`-klient** (ikke
kun mocken indefra) før UI-koblingen: probe/insert/select/delete i begge
tabel-tilstande, inkl. at `count`/`error` rent faktisk kommer tilbage
korrekt formet — et midlertidigt, ikke committet script, se "Ærlige
grænser" for hvorfor det var nødvendigt (HTTP `HEAD`-svar mister altid sin
body over ægte `fetch`, en detalje der ikke var åbenlys uden at teste den).

**UI:** `VolumenKort.jsx` henter nu rettelser + lagertype i én effekt
(IIFE + "aktiv"-flag, undgår at sætte state efter unmount — fx coachen
skifter atlet midt i opslaget), afhængig af `coachId` (sendt ned fra
`Dashboard.jsx`s `session.user.id`, samme kilde `coach_signal_actions`
m.fl. allerede bruger). `KortlaegningRedigering.jsx` afventer nu de async
`gemRettelse`/`fjernRettelse`, viser **"Gemmes på denne enhed"** eller
**"Gemmes på din konto"** i én linje øverst i redigeringsvinduet, og
deaktiverer sine knapper mens et kald er i gang.

## Commit 4 — atleten ser det samme (findes ikke)

Ordrens egen betingelse: "hvis den findes; ellers skriv at den ikke
findes." Den findes ikke. `src/volume/muskelkort.js`, `beregn.js`,
`planlagt.js` og `rettelser.js` bruges udelukkende fra `src/dashboard/`
(coachens side af appen) — ingen import fra `AthleteView.jsx` eller noget
andet atlet-facing view. Der er intet at koble en "kun læsning"-visning op
på i denne ordre. Dokumenteret i `docs/VOLUMEN.md` (ny sektion "Atletens
egen visning — findes ikke") sammen med hvad en fremtidig sådan visning vil
kræve: enten en ny, snævert scopet SELECT-policy på
`exercise_muscle_overrides` (atleten ser kun rækker fra sin egen coach, via
`athletes.coach_id`) eller en SECURITY DEFINER-funktion — ingen af delene
tilføjet nu, for ikke at åbne en læsevej ingen kode bruger endnu.

## Commit 5 — dokumentation og hvad Dhruva skal køre

`docs/VOLUMEN.md`s "Hvor det gemmes"-afsnit omskrevet: den gamle grænse
("browser-lokal, ikke synkroniseret") er erstattet med hvordan
bagende-valget virker, hvad de to statuslinjer i UI'et betyder, og
flyt-op-mekanikken. Ny "Atletens egen visning — findes ikke"-sektion for
commit 4's fund.

### Hvad Dhruva kører (efter Marcs eksplicitte ja)

Kør `docs/supabase/20260915-exercise_muscle_overrides.sql` mod
produktions-Supabase (samme vej som tidligere godkendte migrationer i
dette repo). Selv-indeholdt (`begin`/`commit`), ingen andre filer skal køres
samtidig. Fuld kontekst i `docs/supabase/20260915-exercise_muscle_overrides.md`.

### Hvad der sker i appen, før og efter

**Før migrationen** (i dag, og under hele denne ordre): uændret adfærd,
"Gemmes på denne enhed" vises, `localStorage` bruges.

**Efter migrationen:** næste gang en coach åbner "Volumen pr.
muskelgruppe", finder appens ene, billige opslag tabellen. Findes der
allerede lokale rettelser i den browser, flyttes de op automatisk, én gang.
Fremover læses/skrives mod tabellen, linjen skifter til "Gemmes på din
konto", og en rettelse lavet på én enhed ses med det samme på Marcs andre
enheder. Ingen synlig ændring for atleten (se commit 4).

## Betydning for Hara

Retter direkte den "ærlige grænse" min egen ordre 185-rapport pegede på som
den næste, reelle begrænsning (rettelser var pr. browser) — hører derfor
under Coaching-planetens delmål "Appen mærkbart bedre for atleterne", selv
om ordrens hovedblok bevidst ikke satte et Delmål-felt (arbejdet flytter en
coach-side friktion, ikke en atlet-synlig en — se commit 4 for hvorfor det
endnu ikke rækker helt til atleten).

## Testresultat

- `npm run lint`: grøn, hele repoet.
- Alle 34 `verify:*`-scripts: grønne (`verify:videocoach-upload-flow`
  kræver ~75s ægte sporing — timede ud mod en 60s-testsele, grøn med rigelig
  tid; urørt kode, ikke min ordre).
- `node --test` (hele `src/`, inkl. de 18 nye/opdaterede
  `rettelser.test.js`-tests): 210/210 grønne.
- `npm run e2e`: grøn ("atlet → coach, ende-til-ende", ~25s) — kørt BÅDE
  uden og med `E2E_HIDE_TABLES=exercise_muscle_overrides` sat, begge grønne
  (ingen eksisterende spec rørt eller påvirket af hvilken vej `rettelser.js`
  vælger).
- `npm run build`: grøn. `Dashboard`-chunken: 323,74 KB (op fra 320,43 KB
  efter ordre 192, +3,31 KB) — ordren satte ingen bundle-grænse, nævnt for
  kontinuitet med tidligere rapporter.
- Manuel ende-til-ende mod en ægte `@supabase/supabase-js`-klient (probe,
  insert, select, delete, begge tabel-tilstande) — midlertidigt script, se
  "Ærlige grænser".
- Visuelt ved 390px (headless Chrome, ikke OS-musen): begge statuslinjer
  ("Gemmes på denne enhed" / "Gemmes på din konto"), øvelsesvalg-listerne,
  og selve redigeringsformularen (inkl. "Sat af Marc"-badge) — midlertidig,
  ikke-committet harness der genbruger den faktiske `KortlaegningRedigering.jsx`
  med syntetiske props, ingen produktions-Supabase-kald udløst ("Gem"/"Fjern
  rettelse" blev ikke klikket).

## Hvad er næste

- **Atlet-facing volumen-visning** (commit 4) — når/hvis den bygges, kræver
  den enten en ny SELECT-policy eller en SECURITY DEFINER-funktion oven på
  `exercise_muscle_overrides`, ikke tilføjet her.
- **`verify:*`-dækning for selve rettelses-flowet i browseren mangler** —
  denne ordre har rene funktionstests (18, begge bagender) og en manuel
  headless 390px-gennemgang, men intet e2e-spec dækker "Ret
  kortlægning"-flowet ende-til-ende i den ægte app (specernes indhold var
  uden for scope her — se grænser). Et fremtidigt `verify:volumen-rettelser`
  eller en ny e2e-spec ville lukke det hul.
- `flyt-op`-mekanikken er kun testet med rene funktionstests (mod fake
  klient) og den manuelle ægte-klient-gennemgang — ikke i selve appens UI
  mod en rigtig, tom-til-fyldt browser-session.

## Ærlige grænser

- **Migrationen er ikke kørt.** Alt ovenfor om "efter migrationen" er
  logisk udledt fra koden og mock-verifikationen, ikke observeret mod en
  rigtig, migreret produktions-tabel — det må afvente Marcs godkendelse og
  Dhruvas kørsel.
- **HTTP `HEAD`-body-detaljen var ikke åbenlys på forhånd.** Node/undicis
  `fetch` fjerner altid response-body på et `HEAD`-svar, hvilket gør
  `postgrest-js`s "404 + tomt body = ikke en fejl"-særtilfælde farligt for
  en naiv "tabel findes ikke"-simulation (ville have rapporteret "findes"
  selv når den ikke gør). Fundet og løst (400 i stedet for 404 til dette
  formål) ved at teste direkte mod en rigtig Node-server FØR koden blev
  skrevet ind i mocken — nævnt fordi det er præcis den slags stille fejl der
  ellers først ville være opdaget i produktion.
- **Ingen test dækker samtidige skrivninger** (to faner, samme coach,
  samme øvelse, tæt på hinanden) — hverken `localStorage`- eller
  Supabase-bagenden har låsning; "sidste skrivning vinder" er bevidst
  samme (u-)sikkerhed som ordre 185's oprindelige `localStorage`-version
  altid har haft, ikke en ny svaghed introduceret her, men heller ikke
  løst.
- **Flyt-op-flaget er pr. browser, ikke pr. rettelse.** Har Marc rettelser
  i to forskellige browsere fra før migrationen, flyttes begge sæt op
  (hver browser første gang den bruges efter migrationen) — den browser der
  synkroniserer sidst vinder ved overlap (samme øvelse rettet forskelligt
  to steder før migrationen), ligesom enhver anden "sidste skrivning
  vinder"-situation i dette lager. Sjældent i praksis, men ikke låst mod.
- Ingen atletdata i filer eller rapport. Ingen kald mod produktions-Supabase
  nogen steder i denne ordre — alle Supabase-interaktioner (unit-tests,
  e2e, det manuelle smoke-script) kørte mod enten en fake klient eller den
  lokale `e2e/mock-supabase.mjs`. Ingen migration kørt. `src/App.jsx`,
  `e2e/`-specernes indhold og videocoachen er urørt. Ingen ny
  runtime-afhængighed. Ingen push.

## Høst

```
node C:\Users\Entropi\Documents\Codex\2026-08-15\entropi-digital-assistent\work\entropi-personligt-dashboard\skills\hara\hoest.mjs docs\RAPPORT-209.md --fra-ordre C:\Users\Entropi\Desktop\ordrer\ORDRE-Vaidya.md --aflever --navn Vaidya
```
