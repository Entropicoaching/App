Ordre 428

# En uge som coach: kopien beholder vægt og ugedag, ugens stemme står på forsiden, og man kan se hvem der har trænet

Alle mål er taget headless i Chromium ved 1280 × 900 (og 390 × 844 for telefonen) mod
e2e-mocken. Der er en syntetisk coach og 6 syntetiske atleter (Alfa-Foxtrot Testsen) med en
realistisk uge (`outputs/428/coach-faelles.mjs`). Træningssignalerne regnes med appens eget
JS-spejl af SQL-reglerne. Der er ingen atletdata og ingen kald mod prod.

## Gren

`coachens-uge` fra `main` (`a5b3058`, 422 merget). Grenen er ikke pushet.
- blok 1: `3904171` ugen målt, C1-C5 i `docs/COACHENS-UGE.md`
- blok 2: `f07d3a5` C1-C3 rettet, før/efter
- blok 3: commit efter `f07d3a5` med build, offline-bevis, VideoCoach-test og denne rapport

En verificeringskommando pr. blok: `node outputs/428/verify-428.mjs --blok 1|2|3`.

## Hvad blev ændret

**Blok 1, målingen.** Marcs uge: se hvem der har trænet, læse RPE, noter og vurderinger, se
en video, kopiere og rette næste uge. Scriptet klikker det hele igennem og tæller. De fem
største irritationer står i `docs/COACHENS-UGE.md` med billeder i `outputs/428/foer/`:

| | Irritation | Før |
|---|---|---|
| C1 | "Kopiér seneste uge" taber anbefalet vægt og ugedag | 32 klik + 22 tegn pr. atlet |
| C2 | Vurderinger, kommentarer og noter ligger tre klik inde pr. atlet | 15 klik for 5 atleter |
| C3 | "Hvem har trænet" står kun bag en knap, og kg-tallene kan ikke sammenlignes | 1 klik, Alfa står til 5,6 × planen |
| C4 | Log viser en sprunget øvelse som gennemført ("7/7 SÆT", grøn) | vildleder |
| C5 | Telefonen: "Kræver dit blik" klipper overskriften (29 % kan læses) | vildleder |

**Blok 2, C1-C3 rettet** (kun coachens side, intet skema og ingen eksisterende data ændret):

- **C1** `dashboard/programHandlinger.js` `copyWeek`: sessionens `weekday` og øvelsens
  `recommended_weight` kopieres med. Marc retter nu kun det, der ændres.
- **C2** `dashboard/ForsideView.jsx`: atletrækken viser ugens laveste vurdering og den
  nyeste pas-kommentar eller sæt-note, fx "★ 1/5 · Knæet gør ondt, stoppede rows +1".
  Et klik på linjen åbner Log. Data kommer fra de to eksisterende læsninger
  (`fetchCalendarWeeks`, `fetchCalendarProgress` i `dashboard/laesninger.js`), som nu også
  henter `athlete_rating`, `athlete_comment`, `session_order` og `note`. Der er ingen ny
  forespørgsel. Reglen står i `ugensStemme` i `dashboard/afvigelse.js`.
- **C3** Standardlinjen siger "Uge 5 · Styrke · 2 af 4 pas · 4d siden". Planlagt kg regnes nu
  som sæt × reps × vægt, og gennemført kg tælles kun på de samme øvelser (`planlagteReps`,
  `taellerIKg` i `afvigelse.js`). Et interval ("4-6") tæller som midten. Reps, der ikke er
  tal ("45s", "AMRAP"), tæller ikke med i kg på nogen af siderne.
- Enhedstest: 3 nye i `dashboard/afvigelse.test.js` (10/10 grønne).
- `e2e/coach-afvigelse.spec.mjs` havde den gamle regning skrevet ind (plan 10 × 80 = 800 kg,
  log med 1 rep mod planens 5). Seedet logger nu 5 reps som planen, og forventningerne er
  4000/800 kg. Specens pointe (sorteringen) er uændret.

**Før/efter** (`outputs/428/efter/foer-efter.md`, maskintid):

| Opgave | Før | Efter |
|---|---|---|
| C1 kopiér næste uge og hæv squat + dødløft 2,5 kg (en atlet) | 32 klik · 13,0 s | 10 klik · 6,6 s |
| C2 læse ugens stemme for alle 6 | 15 klik · 11,4 s | 0 klik |
| C3 se hvem der har trænet | 1 klik, forkert kg | 0 klik, Alfa 0,97 × planen |
| C4 sprunget over i Log | 2 klik, "7/7" | uændret (ikke rettet) |
| C5 telefonens "Kræver dit blik" | 29 % læsbar | uændret (ikke rettet) |

## Testresultat

- `node outputs/428/verify-428.mjs --blok 1`: GRØN (målinger, C1-C5 i dokumentet, alle
  billeder findes).
- `node outputs/428/verify-428.mjs --blok 2`: GRØN. Uge 6 har ugedagene [0, 1, 3, 4] og
  vægtene fra uge 5 med squat 102,5 og dødløft 142,5 (læst i mocken). Alle 6 atleters uge og
  stemme kan læses uden klik. Der var 0 konsolfejl.
- `npm run lint`: grøn.
- `verify:coach-priority`, `verify:coach-inbox-flow`, `verify:athlete-onboarding`,
  `verify:athlete-silent-fail-visibility`, `verify:auth-logout-role-switch`,
  `verify:videocoach-feedback-quality`, `verify:mandagsrunden-tilstande`: grønne.
- `e2e:coach-afvigelse` (efter seed-rettelsen), `e2e:coach-mandagsrunden`,
  `e2e:rolig-forside` og hele `npm run e2e` (atlet → coach, ende-til-ende): grønne.
  `e2e:coach` alene fejler med "venter på #athlete-auth-email". Det gør den også på main uden
  mine ændringer, fordi den er lavet til at køre inde i `run-all`, hvor den er grøn.
- `node outputs/428/verify-428.mjs --blok 3`: `npm run build` (`koersel-build.txt`), offline-beviset
  (`BEVIS_UD=outputs/428/offline-bevis node outputs/414/offline-bevis.mjs`,
  `koersel-offline-bevis.txt`) og VideoCoach-testene upload-flow, submission, buttons-layout,
  upload, labels, film-guide, zoom og clip (`koersel-videocoach-*.txt`). Alle er grønne.

## Hvad er næste

**Det Marc kan mærke efter push:**
- "Kopiér seneste uge" giver en færdig uge med de samme vægte og ugedage. Han retter kun
  progressionen. Det er cirka 22 klik sparet pr. atlet pr. uge, og atletens ugestrimmel viser
  igen dagene i den kopierede uge.
- Forsiden svarer uden klik på "hvem har trænet" ("0 af 4 pas · 8d siden") og "hvad siger
  de" (★ og seneste kommentar). Et klik på kommentaren åbner Log.
- Afvigelsestallene i kg kan nu sammenlignes. Sorteringen kan flytte sig lidt, fordi den
  bruger samme tal.

**C4 og C5 (ikke rettet):**
- **C4:** Log bør tælle sprungne sæt for sig ("4/7 sæt · 3 sprunget over", ingen grøn
  bjælke på en sprunget øvelse). Rettelsen ligger i `dashboard/LogTab.jsx` og er lille.
- **C5:** På telefonen bør overskrift og handling i "Kræver dit blik" bryde over to linjer
  (`-webkit-line-clamp: 2`) i stedet for én linje med "…" (`dashboard/ForsideView.jsx`).

**For Hara** (Coaching, delmål "Appen mærkbart bedre"): atleternes nye vurderinger, noter og
kommentarer når nu frem til coachen på forsiden, og den ugentlige programkopi holder vægt og
ugedag. Begge er med til at gøre atleternes ekstra data nyttige.

## Ærlige grænser

- Tiden er maskintid (klik til næste tilstand), ikke menneskelig tid. Klikkene er rigtige
  klik i scriptet.
- Signalerne kommer fra `detectSignalsV2` (JS-spejlet), ikke fra Postgres-funktionen i prod.
  Mocken har den ikke.
- "Generér næste uge" kalder edge-funktionen `draft-next-week`, som mocken ikke har. Den er
  ikke målt.
- Kopien tager nu den anbefalede vægt med, som den var. Hvis Marc bevidst brugte den tomme
  vægt som en påmindelse om at tage stilling, forsvinder den påmindelse. "Sidst logget" vises
  kun, når en øvelse ikke har en anbefalet vægt.
- Planlagt kg for et interval ("4-6") er midten (5). En atlet, der altid tager den lave ende,
  står derfor lidt under planen i kg.
- "Ugens stemme" viser den nyeste tekst og "+N" for resten. Alle tekster står stadig kun i Log.
- 390 px er målt for forsiden. Programredigering på telefon er ikke målt, fordi Marc gør det
  på computeren.
