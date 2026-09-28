Ordre 568: to kritikker, dødløft-artiklen klar til Marcs svar (Setu 561) og skakken efter Chaturangas 556 (K13-K17) (Bhishak)

Planet: coaching. Spor: spor-l-ft-artikler-p-entropicoaching-dk-n-pr-l-ft-39bc17.

**Domme:**
- Dødløft-artiklen klar, når Marc har svaret: **nej**. Den bliver ja, når DA1-DA3 er rettet. Det er en lille ordre til Setu, og intet af det kræver Marc.
- Skakken stadig klar til eleverne: **ja**.

## Gren

`kritik-568` fra `main` (`9119a2e`). Ingen push, ingen merge, ingen sub-agenter. Kun filer under `docs/kritik-568/` og `outputs/kritik-568/`.

Kilderne er hentet med `git archive` til midlertidige mapper:
- `artikel-doedloeft` @ `1793972` fra `entropi-coaching-site-wt2`
- løftmodellens `main` @ `ede9fd0`
- skak `main` @ `04e25e7`

Ingen af trærne er rørt, heller ikke skrivebordsfilerne.

Setu arbejder på `artikel-baenk` i wt2, mens jeg målte. Jeg har ikke skiftet gren dér, og tjekket ser kun, at `artikel-doedloeft` står på `1793972`.

- `b6e48be` kritik 568 blok 1: dødløft-artiklen
- blok 2: skakken, verificering og denne rapport. Hashen står i `git log`; den kan ikke stå i sin egen commit.

## Hvad ændret

Intet i appen, sitet, skak eller løftmodellen. Nye filer:

- `docs/kritik-568/DOEDLOEFT.md`: blok 1, dom i første linje, fund DA1-DA12.
- `docs/kritik-568/SKAK.md`: blok 2, dom i første linje, K13-K17 og #13, fund K24-K26.
- `outputs/kritik-568/doedloeft-568.mjs` + `doedloeft-568.json` + `D-*.png`: tal, figurer og [MARC] mod main og læsesiden, og siden headless.
- `outputs/kritik-568/skak-568.mjs` + `skak-568.json` + `skak-568.log` + `S-*.png`: eleven headless.
- `outputs/kritik-568/verify-kritik-568.mjs`: `--blok 1` og `--blok 2`.

### Blok 1, kort

**Det, der holder:**
- **Tallene:** 21 tal-sætninger står i artiklen og i løftmodellens main.
- **Kapitel 4** er tre-løft på main: 67,8/61,5, 59,6/51,4 og vejen 6,0 cm kortere, 91,0/99,9.
- **Figurerne:** de 17 er dist med kun navn, title/desc og lockoutmomentet skiftet.
- **Kilderne:** Escamilla er brugt, som kilden siger, og IPF-reglerne som i løftmodellens uddrag.
- **[MARC]:** de 12 steder står rigtigt og ordret som på læsesiden.
- **Siden på 390 og 1280:** 0 tankestreger, 0 synlige [MARC], 0 JS-fejl, 0 404, kun skrifttypen blokeret. Læsetiden (2346 ord, 18 min.) passer.

**Det, der skal rettes (DA1-DA3, middel):**
- **DA1:** kapitel 7's tabeller og billedtekst er fejlsiden fra før løftmodellens 493, med knæet i procent og "en løfter flytter ofte også kroppen".
- **DA2:** "10-15 % for høje for et rigtigt løft" er mit skøn for det målte træk, ikke for alle løft. Artiklens egen kilde har en mere vandret ryg end modellen.
- **DA3:** forbeholdets sidste sætning svarer på dl-2, før Marc har svaret.

**Lave fund (DA4-DA12):**
- DA4: titlen forudsætter dl-1 a/b.
- DA5: "en løfter læner sig en smule tilbage" står som fakta over dl-10.
- DA6: "3-4 cm" mod main's 4,2.
- DA7: tre-løfts linje "8° (51° → 60°)".
- DA8: interne navne i kildekodens kommentarer.
- DA9: Mål dit billede på grenen er ikke main.
- DA10: læsesiden viser kladden fra før 561.
- DA11: tabellerne ruller sidelæns på telefonen.
- DA12: "stangen sætter sig" står ikke i løftmodellens uddrag af IPF.

### Blok 2, kort

**K13-K17 er lukket:**
- **K13:** hele brættet og statuslinjen står på skærmen 100 ms efter hvert tryk. Det gælder kendt parti, "Næste kendte parti", "Øv gafler", "Øv" i Mit bibliotek og "Gentag nu", på 360, 390, 1280 og 360 x 640.
- **K14:** O-O-O# giver "Lasker spillede Kd2#, men O-O-O# er også mat", også med hint.
- **K15 og K16** holder på brættet.
- **K17:** 67-78 % lichess-gåder over de seks temaer, modstanderens træk markeret i hver, og dagens gåde fra lichess på lige dage.

**#13:** "Med brikkerne" rammer 10 af 10 felter med touch. Klasseøvelsen tæller, viser projektoren og holder storm og koordinater adskilt.

**Nye fund:**
- **K26 (middel):** i "Find feltet" står feltets navn og uret over skærmen efter Start (35 px på 360).
- **K24 og K25 (lav):** "mindst halvdelen" er et gennemsnit, og en ny elev får lichess-gåder op til 1048 mod rapportens "højst ca. 100 over".

## Testresultat

- `node outputs/kritik-568/doedloeft-568.mjs`: **29 af 29** (artikel-doedloeft `1793972`, løftmodel main `ede9fd0`), 390 med touch og 1280 med mus, uden net.
- `node outputs/kritik-568/skak-568.mjs`: **58 af 58** (skak main `04e25e7`), 360 og 390 med touch, 1280 med mus og 360 x 640, uden net. 0 netkald og 0 JS-fejl.
  - Første kørsel af scriptet: 50/51. Det røde var mit eget tjek, "mindst 10 af 20 i hvert tema": én ny elev fik 9 af 20 i gaffel.
  - Jeg har gjort tjekket til gennemsnittet over seks temaer og lagt enkelttallene under fund (K24).
  - Markeringen af modstanderens træk målte jeg først med en forkert klasse. Den er rettet til `sidst-fra`/`sidst-til`.
- `node outputs/kritik-568/verify-kritik-568.mjs --blok 1`: grøn før commit 1. Første kørsel var rød, fordi mit tjek krævede, at wt2 stod på `artikel-doedloeft`. Setu arbejder dér på `artikel-baenk`, så tjekket ser nu kun, at `artikel-doedloeft` er uflyttet.
- `node outputs/kritik-568/verify-kritik-568.mjs --blok 2`: grøn før commit 2.
- `npm run lint`: grøn.

## Hvad er næste

**Setu (dødløft-artiklen, lille ordre, kan gå samtidig med Marcs svar):**
- **DA1:** tag kapitel 7 fra `dist/loeft-fejl/index.html` på main. Knæet skal stå i ord, "modellen kan ikke sige hvor", og sætningen om bagud (+24 % / +57 %) skal med.
- **DA2:** skriv "for det målte træk i kapitel 6 (et skøn)" de tre steder, og "end det målte træk i kapitel 6" i kapitel 1.
- **DA3:** markér forbeholdets sidste bisætning som en del af dl-2 (afledt).
- **Samme omgang:**
  - DA4: titlen som `dl-1 afledt`.
  - DA5: gør lockout-sætningen betinget.
  - DA6: "ca. 4 cm".
  - DA12: slå "stangen sætter sig" op i regelbogen eller tag den ud.
  - DA8: fjern interne navne i kommentarerne ved udgivelsen.
  - DA11: færre kolonner på telefonen.
- **Før Marc læser:** byg læsesidens artikel-del fra `artikel-doedloeft` (DA10).
- **Senere, en egen ordre:** Mål dit billede fra main (DA9).

**Chaturanga (skak):**
- **K26:** rul feltets navn, uret og brættet på skærmen, når der trykkes Start i "Find feltet", med samme `rulMaal` som K13. Det gælder også "Med brikkerne" og klasseøvelsen.
- **K25:** brug de 250 også i valget blandt lichess-gåderne, eller ret "højst ca. 100 over". Punkt #18 (lette lichess-gåder) løser resten.
- **K24:** skriv "i gennemsnit 7 af 10".
- Derefter listen: #17 fremgang over tid og #18.

**Yantra (lille):** tre-løfts linje under figuren skal regne forskellen af de viste tal (DA7).

**Marc:**
- Svar på dødløft 1-10, når du vil. Artiklen er rigtig i det andet, så snart Setu har taget DA1-DA3.
- Skakken kan bruges i timen. "Find feltet" som klasseøvelse virker, men bed eleverne rulle op, så de ser feltets navn, indtil K26 er rettet.

**Hara (Coaching, "Appen mærkbart bedre"):** intet i coaching-appen er ændret. Dødløft-artiklen er et skridt nærmere udgivelse på sitet, og de tre rettelser er små og kræver ikke Marc.

## Ærlige grænser

- **Blok 1:**
  - Tallene er holdt op maskinelt i 21 sætninger og kapitel 4. Resten har jeg læst mod dist.
  - Kilderne er tjekket mod løftmodellens uddrag, ikke mod PDF'erne, fordi jeg var uden net. DA12 kan være et hul i uddraget.
  - "10-15 %" og 0,71 er mine skøn fra 457.
  - "Holdning i Marcs navn" er min læsning.
- **Blok 2:**
  - Eleven er et script. Touch er emuleret, og ingen rigtig telefon eller projektor er brugt.
  - K17 er 20 tryk pr. tema uden at løse gåderne, og enkelttallene svinger fra kørsel til kørsel.
  - I Mit bibliotek er "Øv" målt på en række-knap, ikke på "Dit svageste tema".
  - Aldrene og Steinitz' mat er efter min hukommelse.
- **Grænserne:** ingen rigtige atleter eller elever. Intet pushet, intet merget.
