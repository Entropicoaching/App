Ordre 392

# Rapport: den levende Mølle (390) og den smukke skak (391) set som en elev på telefonen, før Marc bruger dem (Bhishak)

Har arbejdet betydning for Hara: **nej, ikke for Coaching-planeten** (appen er ikke rørt). Det hører til School-planeten, sporet med matematik-minispillet. Dommene er:

- Møllen er klar til klassen.
- Skakkens bræt er på lichess-niveau, men telefonens forside er ikke.

Med listen under "Hvad er næste" kan Ganita og Chaturanga lukke de vigtigste fund i én omgang hver.

## Gren

Gren `kritik-392` fra `main` (`1cc7c07`) i `entropi-app-wt2`. Ingen merges og ingen push.

- Commit 1 `8d97043`: blok 1. `scripts/kritik-392.mjs` (Møllen-delen), `docs/kritik-392/KRITIK-moellen-390.md` og `moelle-*.png`.
- Commit 2 `72fc5c0`: blok 2. Skak-delen af scriptet (med måling af tap-highlight og værktøjslinjen), `docs/kritik-392/KRITIK-skak-391.md` og `skak-*.png`.
- Commit 3: blok 3. `verify:kritik-392` i `package.json`, den fulde verificering og denne rapport. Hashen står i afleveringen.

Kilder, kun læst via `git archive`:

- matematik `main` `53f01a6` (merge af `moellen-lever`, ORDRE 390)
- skak `main` `afbd125` (merge af `smuk-skak`, ORDRE 391)

Intet er rettet eller committet i de to repoer.

## Hvad ændret

- **`scripts/kritik-392.mjs`** (ny, bygget over skabelonen `kritik-379.mjs`). Den trækker begge `main` ud til en midlertidig mappe og kører dem headless i en flygtig profil. Resultaterne skrives kun i `outputs/kritik-392/`.
  - `--kun moellen` spiller Møllens forløb 1-4 på 390x844 med touch, med ét bevidst forkert svar pr. forløb.
    - Den måler dop, kortet "Byen vågner" (om det ses uden at rulle), indbyggertal, prikker, ring og lyd. Lyden tælles ved at spionere på Web Audio-oscillatorerne.
    - Den tæller alle uendelige animationer og deres periode. Animationer der ændrer opacity, markeres som mulige blink.
    - Til sidst kører en klikkerprøve (30 tryk), en gættemaskine (16 opgaver) og trin 8 med og uden `prefers-reduced-motion`.
  - `--kun skak` kører på 390 (touch) og 1280 (mus).
    - Eleven løser to gåder (hint-knappen, eller selv ved mat i 1) og tegner en pil, der måles mod feltets midte.
    - Den skifter mellem fire temaer og fem brikkesæt og måler koordinatkontrast og kontrast mellem sort brik og mørkt felt.
    - Eleven spiller fem træk mod en makker, med et billede midt i et glid og målinger af sidste træk, skak og lyd, og tager første træk i Lær skak.
  - Uden argument kører begge dele.
- **`docs/kritik-392/KRITIK-moellen-390.md`:** fundene M1-M5, det der virker, og dommen.
- **`docs/kritik-392/KRITIK-skak-391.md`:** fundene S1-S6, det der virker, en ærlig sammenligning med lichess, og dommen.
- **`package.json`:** `verify:kritik-392`.

Fundene kort:

- **Møllen, klar til klassen: ja.**
  - Det faglige er uændret: et hint ved hvert forkert svar, og mestringen kræver stadig 3 af 3 rigtige i første forsøg.
  - Lyden er slået fra fra start (0 toner på hele turen).
  - Tallet vokser ikke af at klikke (30 tryk: 50 → 50) eller af at gætte (16 opgaver: trin 0).
  - Kortet "Byen vågner" står inde i skærmen efter hvert mestret forløb.
  - Svagheden (M1): det der vågner, ses mest på kortet. Det er småt og ligger over opgaven, ca. 700 px oppe, mens eleven regner.
  - Vil Marc sige, at det er levende? Ja om kortet ved trin 8 og hjulet, der går i gang. Mindre om det, eleven ser, mens der regnes.
- **Skakken, kan konkurrere med lichess på udseende: delvist.**
  - Glid (0,18 s), sidste træk, skak-glød, Staunton-brikker (95-96 % af feltet), ingen ramme og tegnepil på feltets midte (0 px) virker på begge bredder.
  - På telefonen åbner forsiden med en 96 px høj tegneværktøjslinje over brættet (S1).
  - Chromes blågrå tap-boks ligger over brikkerne ved hvert tryk (S2).
  - Koordinaterne er blevet svage: 2,06-2,84:1 (S3).

## Testresultat

- `npm run verify:kritik-392` blev kørt tre gange på den endelige kode. To kørsler bestod: "OK", 0 konsolfejl i Møllen, i skak 390 og i skak 1280, og 2/2 gåder løst i begge bredder. Den første kørsel stoppede med en Playwright-timeout i skak-delen. Gåderne er tilfældige, og et tryk kan ramme en overgang, så fejlen kom fra scriptet og ikke fra appen.
- `npm run lint`: grønt (0 fejl, 0 advarsler).
- Tal fra den sidste kørsel (`outputs/kritik-392/maalinger.json`):
  - Møllen:
    - Indbyggere 12 → 19 → 27 → 38 → 50.
    - Top af "Byen vågner" efter Videre: 463, 466, 490 og 613 px af 844.
    - scrollY ved svar: 683-710 px.
    - Dop: 7 melkorn, 1 flyver, nik. Alle melkorn er væk efter 1 s.
    - Uendelige animationer: 21 ved start, 39 ved trin 4, 55 ved trin 8, 0 med reduceret bevægelse.
    - Hurtigste gentagelse: 1,0 s (`vand-dryp`) og 1,2 s (`liv-sproejt`, nyt i 390).
  - Skak:
    - Tap-highlight på telefon: `rgba(51,181,229,0.4)`.
    - Værktøjslinjen: top 163 og højde 96 på 390. Brættet starter ved 267 px i Gåder og ved 205 px i Lær skak.
    - Koordinatkontrast: Træ 2,29, Grøn 2,84, Blå 2,06, Nat 2,17. Sort brik mod mørkt felt: 6,67, 6,27, 7,89 og 4,13.
    - Lyd: 0 toner på fem træk med standardvalget, 1 tone med lyden slået til.
    - Ingen synlige knapper under 44 px.

## Hvad er næste

**Til Ganita (matematik), i prioriteret rækkefølge:**

1. M1: vis det der vågner, dér hvor eleven er. Et lille billede af det nye (vognen, bageriet, broen) i kortet "Byen vågner". Eller lad Møllen-scenen øverst i opgavekortet vise det genopbyggede for hvert trin, ikke kun hjulet ved trin 1.
2. M3: vis "+10" eller en lille erfaringsbar ved selve svaret, så noget vokser synligt ved hvert rigtigt svar og ikke kun ved hver fjerde opgave.
3. M2: sæt det nye vandsprøjt ned fra 1,2 s til ca. 2-3 s, og ret MOELLEN-LEVER.md, så den hurtigste bevægelse står korrekt.
4. M4 og M5 (valgfrit): spred trin 5-8 lidt ud over kortets tomme venstre halvdel, og lad melkornene ikke lande over "Ny opgave".

**Til Chaturanga (skak), i prioriteret rækkefølge:**

1. S2: én linje CSS, `-webkit-tap-highlight-color: transparent` på brættet. Det er billigst og ses ved hvert eneste tryk på telefon.
2. S1: på smal skærm skal tegneværktøjet foldes bag én lille "Tegn"-knap, og sætningen "Vil du tegne?" skal gøres stille eller fjernes. Så ligner Gåder-forsiden Spil og Lær skak, som allerede er rolige.
3. S3: koordinater med kontrast på mindst 3:1, i det mindste i Lær skak, hvor begyndere skal finde felterne ud fra dem.
4. S4 til S6: tekst eller lysere felter på Nat, ingen bekræftelse af "Start forfra" på et tomt parti, og samme notation (dansk) i træklisten som i Lær skak.

**Hvad Marc skal prøve først:**

1. Skak: åbn skak.html på sin egen telefon, tryk på et par brikker, og se efter den blågrå boks (S2) og tegneværktøjet over brættet (S1). Gå så til Spil og mærk forskellen. Det er dér skakken allerede er lichess-agtig.
2. Møllen: spil forløb 1 på telefonen. Efter det tredje rigtige svar i træk, tryk "Se det på kortet", og se om det at hjulet går i gang føles som et fremskridt. Klassen kan få det i morgen. Sig til eleverne: "tryk på Se det på kortet".

## Ærlige grænser

- Alt er set headless som stillbilleder og målt i DOM'en. Hjulet, vognen og glidet er ikke set bevæge sig på en rigtig skole-pc eller telefon, og lyden er ikke hørt: kun oscillatorer blev talt.
- Tap-boksen (S2) er Chromium's standardfarve i mobil-emulering. Sådan opfører Android Chrome sig også. iOS Safari tegner sin egen, svagere boks, og den er ikke set.
- Gåderne er tilfældige og blev løst med hint-knappen eller mat i 1, ikke af en elev der tænker selv. Scriptet gætter hvis tur det er ud fra brættets retning. I den sidste kørsel blev det bevidst forkerte træk afvist på begge bredder med "Ikke den vej. Tag trækket tilbage og prøv igen." (Bf7 på 390, g5 på 1280). I en tidligere kørsel var gættet forkert, og trækket blev ikke lavet. Det er ikke et fund mod appen.
- Kun Lær skak-niveauet "Jeg spiller allerede" (trin 24 af 32, e2-e4) blev prøvet, ikke begynderforløbet.
- Møllen blev kun spillet til trin 4. Trin 5-8 er set som tilstande sat direkte i den lokale lagring og ikke spillet igennem.
- Træet er ikke helt rent. Filerne under `outputs/kritik-374/`, `outputs/kritik-379/`, `outputs/kritik-skole*/` var ændrede eller usporede, før grenen blev lavet, og de er ikke mine. De er ikke rørt og ikke committet. Alt fra denne ordre er committet.
