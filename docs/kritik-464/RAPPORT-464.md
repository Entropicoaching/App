Ordre 464

# Appen efter Vaidyas 456: klar til Marcs push?

**Klar til push: ja**, med to ting før og under:
- prod's "Max rows" skal stå på 1000;
- i kældertesten skal Marc blive på net et minut efter første åbning.

A1-A9 fra min 446 er alle lukket, målt med mine egne scenarier på main `e5089f7`. Vaidyas kældertest holder på alle
punkter i varianten, hvor Marc venter: 17 af 17 tjek grønne. Fundene står øverst i
`docs/kritik-464/KRITIK-app-push-2.md`, og status for A1-A9 står i `docs/kritik-464/STATUS-A1-A9.md`.

## Gren

`kritik-464` fra `main` (`e5089f7`). Ikke pushet, ingen merges.
- blok 1: `febcdb3`: A1-A9 og det, Vaidya ændrede ud over ordren. Kældertest-scriptet (`kaelder-464.mjs`) og
  revert-tjekket kom med i denne commit, fordi jeg skrev dem, mens blok 1's målinger kørte.
- blok 2: commit efter `febcdb3` med kælderkørslen, KRITIK-app-push-2 og denne rapport.

Verificering: `npm run verify:kritik-464`, eller `node outputs/kritik-464/verify-kritik-464.mjs 1|2` for én blok.

## Hvad ændret

Intet i appen. Nyt:
- `docs/kritik-464/`: STATUS-A1-A9, KRITIK-app-push-2 og RAPPORT-464.
- `outputs/kritik-464/`: målinger, scripts og billeder.
- Én linje i `package.json` (`verify:kritik-464`), som i 461.

Scripts:
- `uge-`, `graense-`, `coach-` og `tid-464.mjs` er mine 446-scenarier i Vaidyas 456-kopier. Jeg har kun ændret
  stierne. Hans ændringer (vent på rekord-indekset, loftet i mocken, siderne, dobbelttrykket med touch) har jeg læst
  og godtaget.
- `ekstra-464.mjs`: rekord-indeks v2 med et plantet 450-indeks, siderne med loft ingen/1000/100, og dobbelttryk på
  60 og 120 ms.
- `kaelder-464.mjs`: Vaidyas otte punkter fra prod-versionen `dc39052` til main på samme adresse, i to varianter.
- `diag-loft-464.mjs`: fundet N2.

## Testresultat

- **A1-A9 er lukket** (`STATUS-A1-A9.md`):
  - Min uændrede 446-verify er rød på præcis fundene (15 linjer).
  - Vaidyas 456-verify er grøn mod mine målinger (`koersel-verify-446-og-456.txt`).
- **Rekord-indeks v2** (loft ingen, 1000 og 100):
  - Version 1 kasseres ved første åbning, og der fejres intet under opbygningen (0 af 3).
  - Bagefter er "bedst før" squat 128, og 115 × 5 fejres (3 af 3).
  - En genåbning henter kun 2 sider.
  - Loft 100 giver 31 sider på 9,8 s efter Dagens pas, og Dagens pas bliver ikke langsommere.
- **Dagens pas, droslet (median af 3):** tung historik 3307 ms mod 3334 ms før 439, let 995 mod 962 ms.
- **Dobbelttryk på "Kopiér seneste uge"** ved 60, 120, 150 og 250 ms giver én uge.
- **Kældertesten** (`koersel-kaelder.txt`):
  - "vent": 17/17 grønne.
  - "straks": 16/17. Punkt 7 fejler, fordi kælderens rekorder mangler i PR-tidslinjen (K1).
- **Fund:**
  - K1 (kældertestens instruks) og N2 ("Max rows" under ca. 150 klipper ugerne): middel.
  - K2 (Vaidyas punkt 1, 3/4 og 8) og N1 ("Intet aktivt program" kort hos coachen): lav.
- **Tjek:**
  - `npm run verify:kritik-464`: grøn.
  - `npm run lint`: grøn.

## Hvad er næste

**Marc, før pushet:** i Supabase (prod) → Settings → API skal **"Max rows"** stå på 1000 (standard) eller højere.
Står den lavere, så push ikke. Send værdien til Vaidya (N2).

**Marcs push og kældertest** (Vaidyas otte punkter, rettet):
1. Push `main`. `klar-til-push` er allerede merget (`e5089f7`), og alt siden prod (`dc39052`) går ud på én gang.
2. Åbn appen som atlet på din telefon med net. Når Dagens pas er vist, så **bliv på net et minut**. Rekorderne bygges
   første gang, og du kan ikke se, hvornår de er færdige (K1).
3. Gå i kælderen (flytilstand). Log halvdelen af passet, og spring ét sæt over.
4. Luk appen helt, og åbn den igen uden net. Vægtfeltet skal være udfyldt. Log resten af passet, og giv det en
   vurdering.
5. Tag nettet igen. "☁ … sæt gemt lokalt" skal forsvinde inden for ca. 10 s.
6. Som coach på telefonen, Log: hvert sæt én gang, "1 sprunget over", vurderingen som stjerner og dagens dato på
   dansk.
7. Som coach: PR-tidslinjen har passets rekorder én gang hver. Tryk to gange hurtigt på "Kopiér seneste uge": der må
   kun komme én uge. Slet den med Slet → Bekræft.
8. Går noget galt, så send et skærmbillede. `git revert -m 1 e5089f7` ruller 456 tilbage; en revert af de tre
   commits hver for sig giver konflikt i `package.json`. 397-455 ligger stadig ude efter en sådan revert.

**Til Vaidya, efter pushet:**
- N2: hent ugerne side for side, eller skriv i appen, at Max rows skal være mindst 1000.
- K1: fejr og skriv `personal_records` bagefter for ugens sæt, når indekset er bygget.
- N1: "henter …" i stedet for "Intet aktivt program".

Ingen af dem blokerer pushet.

**Til Marc om repoet (fra 446 og 456, stadig åbent):** `CLAUDE.local.md` er committet og ligger i det offentlige
repo.

**For Hara** (Coaching-planeten, delmål "Appen mærkbart bedre"): en uafhængig gennemgang bekræfter, at det, der gjorde
pushet til "nej" i 446, er rettet. Kælderen giver ikke stille forkerte data hos coachen, og rekorderne lyver ikke ved
lang historik. Med Marcs push i morgen når det atleterne.

## Ærlige grænser

- **Hvem jeg er:** ordren er til Bhishak. `CLAUDE.local.md` i denne mappe siger "Du er Vaidya". Marc bad mig udføre
  ordren, og mappen er Bhishaks hjem, så jeg har udført den som Bhishak.
  - Jeg har ikke skrevet 456's kode i denne session. Jeg kender den kun fra diffen og Vaidyas rapport.
  - Er uafhængigheden vigtig nok til, at en anden instans bør gentage blok 2, så afgør Marc/Dhruva det.
- **Headless, ikke en rigtig telefon:**
  - Alt er Chromium mod e2e-mocken, ikke Safari/iOS og ikke prod.
  - En hjemmeskærms-PWA på iPhone opdaterer sin service worker anderledes end Chromium. Punkt 2 på Marcs egen telefon
    er derfor den rigtige prøve.
  - Mocken håndhæver ikke prod's skema, RLS eller unikke indeks.
- **Serveren i kældertesten** sender `no-cache`; GitHub Pages sender `max-age=600`. `no-cache` er det strengeste, og
  det holdt.
- **Prod's "Max rows" er ikke læst.** N2 er målt med mockens loft.
- **Kørsler, der ikke gik første gang:**
  - Første tidsmåling stoppede uden fejltekst efter første tunge åbning (exit 1, `koersel-maalinger.txt`); anden
    kørsel var hel (`koersel-tid.txt`).
  - Ekstra-scriptet fik én gang "port 8997 i brug" (en anden proces på maskinen); det lykkedes ved næste forsøg.
  - Loft 100 med 130 uger gav timeout og førte til N2. Loft 100-kørslen bruger derfor 90 uger.
- **Revert-tjekket** er kun `git apply --check` af den omvendte ændring. Der er ikke kørt nogen git-handling på andre
  grene.
- **Arbejdsmiljøet:**
  - Arbejdstræet havde ingen `node_modules`. Jeg lagde en junction til `entropi-app/node_modules`: samme lockfile som
    main bortset fra linjeskift, og gitignored. Den er fjernet igen.
  - Prod-bygget og 412f2c1-bygget ligger i `%TEMP%\kritik-464-byg`, ikke i repoet. For at pakke dem ud brugte jeg
    Windows' `tar`.
