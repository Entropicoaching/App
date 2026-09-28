Ordre 576: to kritikker, værktøjssiden med fejlgenkendelse og video (Setu 570) og de to Instagram-karruseller (Setu 573) (Bhishak)

Planet: coaching. Spor: spor-l-ft-artikler-p-entropicoaching-dk-n-pr-l-ft-39bc17.

**Domme:**
- vaerktoejssiden klar til Marcs deploy: **nej**. Den bliver ja, når W0-W3 er rettet, og det kan Setu gøre alene.
- karrusellerne klar til Marc: **nej**. De bliver ja, når K1-K3 er rettet: K1 og K3 af Setu i setu-573, K2 via W1-W3 på værktøjssiden.

## Gren

`kritik-576` fra `main` (`7608b41`). Ingen push, ingen merge og ingen sub-agenter. Kun filer under `docs/kritik-576/` og `outputs/kritik-576/`.

**Hvad jeg har læst, og hvordan:**
- Grenen `vaerktoejer` (`ba44cb1`) i `entropi-coaching-site-wt2` og løftmodellen (`entropi-loeftmodel-dhruva`, `37c9a27` og main `cc4dd7d`) er hentet med `git archive` til midlertidige mapper. Ingen gren er skiftet.
- `setu-573\` og `FILM-KLIP.html` er kun læst.

**Commits:**
- `7ac4114` kritik 576 blok 1: værktøjssiden
- blok 2: karrusellerne, verificering og denne rapport. Hashen står i `git log`, for den kan ikke stå i sin egen commit.

## Hvad ændret

Intet i appen, på sitet eller i setu-573. Nye filer:

- `docs/kritik-576/VAERKTOEJER.md`: blok 1, dom i første linje, fund W0-W6.
- `docs/kritik-576/KARRUSELLER.md`: blok 2, dom i første linje, fund K1-K6.
- `outputs/kritik-576/vaerktoejer-576.mjs` + `vaerktoejer-576.json` + `V-*.png`: blok 1 headless. Videoen bruger mine syntetiske klip fra 564 (`klip-564.mjs`, i `%TEMP%`, intet klip i repoet).
- `outputs/kritik-576/karruseller-576.mjs` + `karruseller-576.json` + `K*-390-*.png`: blok 2, slides i telefonstørrelse og værktøjet med Setus krop.
- `outputs/kritik-576/verify-kritik-576.mjs`: `--blok 1` og `--blok 2`.

**Blok 1, kort:**
- **Hvad holder:** værktøjerne holder 558 og 564:
  - kopien er blob for blob `37c9a27`-dist (47 filer),
  - 0 JS-fejl og 0 fejl 404 på 11 sider og 45 links på 360, 390 og 1280,
  - "Ligner"/"Ligner ikke" rigtig i 14 tilfælde på 3 bredder,
  - seks punkter trykket med fingeren,
  - V2 og V4 lukket, og "Brug dette billede" er det viste billede,
  - stadig noindex, og ingen side linker til den.
- **W0:** Yantras 571 blev merget på main kl. 03:52 under kritikken, så `maal-billede/index.html` og `.js` er nye.
- **W1-W3 (middel):** filmeguiden på værktøjssiden er ældre end værktøjet. Den siger bænk på siden, "et par meter", skiven som målestok og "tag et skærmbillede".
- **W4-W6 (lav):** "Ligner"-linjer på 148-195 ord, stavefejlen "fejlfigurenerne" og to modsatte råd om skulderpunktet på bænken.

**Blok 2, kort:**
- **Marcs regler holder i begge:** 0 tankestreger, 0 navne, 0 opfordringer, 0 meta, forbeholdene sidst og en neutral henvisning.
- **Læsbar:** slidetekst ca. 17-20 px og etiketter ca. 10,8 px på en 390 px telefon, kontrast mindst 6,7.
- **Sand:** 15 af 15 påstande står i vejledningen eller FILM-KLIP.
- **K1 (middel):** "artiklerne om de tre løft ligger på entropicoaching.dk" er ikke sandt.
- **K2 (middel):** karrusel 2 peger på en side, der siger det modsatte (W1-W3).
- **K3 (middel):** slide 3 viser Min krops tabel som værktøjets, med en skinneben-række, værktøjet ikke har, og "det er lårene, ikke teknikken", som værktøjet ikke kan sige.
- **K4-K6 (lav).**

## Testresultat

- `node outputs/kritik-576/vaerktoejer-576.mjs`: 27/27 grønne.
- `node outputs/kritik-576/karruseller-576.mjs`: 17/17 grønne.
- `node outputs/kritik-576/verify-kritik-576.mjs --blok 1`: grøn (før commit 1).
- `node outputs/kritik-576/verify-kritik-576.mjs --blok 2`: grøn. Den tjekker også, at de 36 filer i setu-573 har samme sha256 som ved målingen, og at `vaerktoejer` stadig er `ba44cb1`.
- `npm run lint`: grøn (inde i verify).

Fund markeret "(fund)" i scripts er tjek, der bekræfter fundet. De er grønne, når fundet er der.

## Hvad er næste

- **Setu, værktøjssiden (vaerktoejer):**
  1. W0: kopierer `dist/maal-billede/` fra dhruva main (`cc4dd7d` eller nyere).
  2. W1-W3: filmeguiden følger vejledningen. Bænken filmes på højkant, 3-4 m (dødløft mindst 3 m), kroppens længder er målestokken og skiven en kontrol, og videoen kan åbnes direkte i Mål dit billede. Kortet siger "et billede eller en video".
- **Setu, karrusellerne (setu-573):**
  1. K3: slide 3 med værktøjets egen tabel og en tekst, der siger, hvad sliden viser.
  2. K1: billedtekst 1 uden "artiklerne om de tre løft", til de er ude.
  3. K4 og K5, hvis det er let. Derefter `node lav.mjs 1` igen.
- **Yantra, hvis Marc vil:** W5 (`fejlfigur` + `en`/`erne`), W6 (skulderpunktet på bænken: kliklisten og linjen skal sige det samme) og W4 (en længdegrænse for "Ligner"-linjen).
- **Bhishak:** prøver 571-udgaven af Mål dit billede på sitet, når Setu har kopieret den, og ser slide 3 og billedtekst 1 igen.
- **Marc:** deployer først, når W0-W3 er rettet. Karrusellerne bruges først, når værktøjssiden er ude.
- **Hara:** på Coaching-planeten er værktøjssiden og karrusellerne et skridt mod "løft-artikler på entropicoaching.dk". Den er tæt på, men ikke klar. Det, der mangler, er Setus tekst og ikke modellen.

## Ærlige grænser

- **Ingen rigtig telefon:** alt er headless Chromium på Windows med mobilemulering. Et rigtigt iPhone-klip i Safari og Instagram på en rigtig telefon er ikke prøvet.
- **Den nye main:** Yantras 571-udgave af Mål dit billede (main `cc4dd7d`) er ikke prøvet. Den kom under kritikken, og ordren gjaldt Setus kopi.
- **"Ligner" er ikke målt på rigtige løft:** tilfældene er modellens egne tegnede stillinger. Falsk alarm med skrå kameraer og klikfejl er ikke målt igen. Kilden er uændret siden 558 ud over 565's tekst.
- **Karrusellernes sandhed** er holdt op mod vejledningen og FILM-KLIP og ikke målt selv, ud over slide 3 og 4, som er holdt op mod værktøjet og modellen.
- **Ingen atletdata** er brugt eller skrevet. Kroppene er syntetiske (`kroppe.json`, KROPPE fra løftmodellen).
