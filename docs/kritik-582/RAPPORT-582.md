Ordre 582: to gentjek, dødløft- og bænkartiklen efter Setus 575 (DA1-DA12, BA1-BA10) og videoen i Mål dit billede efter Yantras 571 med mine egne klip (Bhishak)

Planet: coaching. Spor: spor-l-ft-artikler-p-entropicoaching-dk-n-pr-l-ft-39bc17.

**Domme:**
- Dødløft-artiklen klar, når Marc har svaret: **ja**.
- Bænkartiklen klar, når Marc har svaret: **ja**.
- Videoen klar til sitet: **ja**.

## Gren

`kritik-582` fra `main` (`a246f88`). Ingen push, ingen merge, ingen sub-agenter. Kun filer under `docs/kritik-582/` og `outputs/kritik-582/`.

Kilderne er hentet med `git archive` til midlertidige mapper:
- `artikel-doedloeft` @ `1c85d55` og `artikel-baenk` @ `d33a6f1` fra `entropi-coaching-site-wt2`. Wt2 står stadig på `vaerktoejer`.
- Løftmodellens `main`:
  - blok 1 på `cc4dd7d`
  - blok 2 på `291f5bf`, fordi Yantras 580 blev merget under arbejdet (04:38)
  - 580 ændrer ikke fejlsiden, figurerne, litteraturen eller `src/maalVideo.js`, og i tre-løft og Min krop kun minificerede navne

Ingen af trærne er rørt, heller ikke skrivebordsfilerne.

Commits:
- `a0b44f0` kritik 582 blok 1: dødløft- og bænkartiklen efter Setus 575
- blok 2: videoen, verificering og denne rapport. Hashen står i `git log`; den kan ikke stå i sin egen commit.

## Hvad ændret

Intet i appen, sitet eller løftmodellen. Nye filer:

- `docs/kritik-582/ARTIKLER.md`: blok 1, begge domme i første linje, DA1-DA14 og BA1-BA10.
- `docs/kritik-582/VIDEO.md`: blok 2, dom i første linje, Yantras fire punkter og V7.
- `outputs/kritik-582/artikler-582.mjs` + `artikler-582.json` + `A-*.png`: artiklerne mod grenene, main, regelbogens PDF og læsesiden, og siderne headless.
- `outputs/kritik-582/klip-582.mjs`: mine syntetiske H.264 MP4/MOV-, 4K- og HEVC-klip. De ligger i `%TEMP%\kritik-582-klip`, ikke i repoet.
- `outputs/kritik-582/video-582.mjs` + `video-582.json` + `V-*.png`: videoen i Google Chrome headless, og sammenligningen med Chromium.
- `outputs/kritik-582/verify-kritik-582.mjs`: `--blok 1` og `--blok 2`.

### Blok 1, kort

**Lukket:** DA1-DA3 og BA1-BA2, som jeg bad om i 568 og 572. Det samme gælder DA4-DA6, DA8, DA10, DA12, BA3-BA7 og BA9.
- **DA1:** kapitel 7 er fejlsiden på main: 7 tabelrækker med knæet i ord, de tre billedtekster og "+24 % / +57 %" ordret.
- **DA2:** "for det målte træk i kapitel 6 (et skøn)" står alle tre steder. Mit skøn fra 457 kan bære det.
- **DA3:** `dl-2 afledt` står nederst i forbeholdet, og det er det rigtige sted.
- **BA1:** 22,1 / 25,1 / 24,1 cm er regnet i modellen igen. "+3 cm, så −1 cm" står i teksten, og bp-5 er ordret ens på grenen og læsesiden. "Kun et par cm" i svar-linjen er rigtig nok.
- **BA2:** "et modelvalg og et skøn, ikke en måling" er nok. Den behøver ingen `bp-7 afledt`.
- **DA12 og BA6:** sætningerne står ordret i IPF 2026 v3 (PDF'en, hentet nu), og Setus 40 linjers uddrag er ordret PDF'ens.

**Læsesiden:** alle 417 + 326 tekstblokke står ordret, og de 18 "Står i teksten" er ordret. Intet fra kladden er tilbage.

**Tilbage, ikke Setus i denne ordre:**
- DA7 (Yantra)
- DA9/BA8 (Mål dit billede fra main)
- DA11/BA10 (tabellerne ruller i boksen på 390)

**Nye, lave:**
- **DA13:** Setus sidetal i uddraget er én for lave (4.3 pkt. 4 er s. 25, 4.2.1 s. 24).
- **DA14:** løftmodellens uddrag af regelbogen mangler stadig de to sætninger.

### Blok 2, kort

- **Trinene:** i Google Chrome 154 går hvert tryk præcis ét billede i H.264 MP4 og MOV, 29,97 og variabel billedrate (tabte billeder, 24/s-stykke, MOV med tidsskala 600), på 390 og 1280. Tiden under videoen og fotoet er billedets egne.
- **Hop til med to buer** rammer bunden (0 billeder) i alle fem squats. Det gælder med tekstens råd og med en træners skæve højder, i 29,97 og i variabel billedrate. To klik og tre klik er −4 til +5.
  - **Regnet:** en træner, der følger teksten, får to buer i 88-91 % af forsøgene, med median 0-1 og p90 1-2 billeder.
- **De første tryk:** 71 og 41 ms uden bremse, 168 og 64 ms med 4 gange langsommere CPU, derefter ca. 15-17 ms.
- **4K:** åbner, linjen er klar, fotoet er 1080 × 1920 og det viste billede. Brug dette billede tager 0,4-0,45 s med bremsen.
- **HEVC-MOV** åbner i Chrome på denne pc.
- **V7 (lav):** Playwrights Chromium 151 kan ikke vise ét billede i en H.264 med B-billeder og variabel billedrate, så dér går et tryk 18 → 20. Chrome kan. Det er browserens grænse, ikke sidens, men Yantras VP8-klip kan ikke finde det.

## Testresultat

- `node outputs/kritik-582/artikler-582.mjs`: **35/35**.
  - Første kørsel var 32/35, og alle tre røde var mine egne tjek:
    - Læsesiden har nu nummeret efter "MARC" i "Står i teksten", men mit tjek fjernede det først.
    - Mit tjek krævede over 40 linjer i et uddrag på præcis 40.
    - Mit tjek talte læsesidens egne noter (grenens hash, "Læsesiden: figuren kan indstilles ...") som afvigelser.
  - Tjekkene er rettet, så de kender noterne ved navn.
- `node outputs/kritik-582/video-582.mjs`: **21/21** (Chrome 154, løftmodel main `291f5bf`, 0 netkald).
  - Første kørsel brugte Playwrights Chromium og var rød i fire trin-kørsler (VFR MP4 og MOV på 390 og 1280): 18 → 20.
  - Jeg søgte selv i klippet og fandt, at Chromium aldrig viser billede 19. Chrome viser det, og uden B-billeder gør Chromium også.
  - Scriptet bruger nu Chrome, og F-tjekket måler forskellen (V7).
- `node outputs/kritik-582/verify-kritik-582.mjs --blok 1`: grøn før commit 1.
- `node outputs/kritik-582/verify-kritik-582.mjs --blok 2`: grøn før commit 2.
- `npm run lint`: grøn.

## Hvad er næste

**Setu:**
- **Artiklerne:** intet før Marcs svar. Så skal de 18 svar skrives ind, og titlerne (`dl-1 afledt`, `bp-1 afledt`) og forbeholdets sætning (`dl-2 afledt`) skrives ud fra svar 1 og 2.
- **Mål dit billede på grenene (DA9/BA8):** kopiér `dist/maal-billede/` fra løftmodellens main (`291f5bf`, med 571 og 580), når Dhruva giver ordren. Videoen er klar til det.
- **Ved udgivelsen:**
  - DA11/BA10: tabellerne på telefonen.
  - Squat-stilarkenes ordrenumre.
- **DA13:** ret sidetallene i uddraget, hvis det bruges igen.

**Yantra:**
- **V7:** læg et H.264-klip med B-billeder og variabel billedrate i testen (ffmpeg-static kan lave det, se `klip-582.mjs`), og kør det i Chrome.
- **DA14:** tilføj "If the bar settles ..." (4.3 pkt. 4) til `docs/doedloeft-litteratur.md` og "Foot movement is permissible ..." (4.2 pkt. 2 og 4.2.1 pkt. 9) til `docs/baenk-litteratur.md`, fra PDF'en v3.
- **DA7:** tre-løfts linje "8° mindre (51° → 60°)".
- **Løftmodellens figurside for bænken** siger stadig "med mere bue ... længere mod fødderne". Den skal rettes som BA1 i artiklen.

**Marc:**
- Begge artikler venter kun på dine 18 svar på `LAES-DOEDLOEFT-BAENK.html`. Siden er nu ordret ens med artiklerne.
- Videoen kan komme på sitet. Et rigtigt iPhone- og Android-klip på telefonen er stadig det, jeg ikke kan måle.

**Hara (Coaching, "Appen mærkbart bedre"):** intet i coaching-appen er ændret. Begge artikler og videoen i Mål dit billede er et skridt nærmere sitet.

## Ærlige grænser

- **Blok 1:**
  - Jeg har regnet BA1 i modellen igen og holdt kapitel 7 op mod fejlsiden. Resten af tallene står i linjer, 575 ikke rørte, og som jeg holdt op i 568 og 572.
  - Regelbogen er PDF'en v3, hentet nu. Jeg har kun læst 4.2, 4.2.1, 4.3 og 4.3.1.
  - "Rigtig nok", "nok uden markering" og "det rigtige sted" er mine vurderinger, ikke Marcs.
- **Blok 2:**
  - Headless Chrome og Chromium på Windows, ikke en telefon, Safari eller Firefox.
  - Touch er emuleret, og bremsen er Chromes.
  - Klippene er mine, kodet af ffmpeg, ikke optaget af en telefon.
  - HEVC virker, fordi denne pc har en afkoder.
  - Hukommelsen efter "Luk videoen" er ikke målt færdig.
- **Main flyttede under ordren** (580). Blok 1 er målt på `cc4dd7d` og blok 2 på `291f5bf`. Forskellen rører ikke det, blok 1 holder op.
- **Grænserne:** ingen rigtige atleter eller klip. Intet pushet, intet merget.
