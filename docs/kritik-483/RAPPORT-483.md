Ordre 483

# To kritikker: fejlene i dødløft og bænk (Yantra 476/481) og Marcs skaktime med klassens storm (Chaturanga 474)

**Fejlfigurer klar til sitet: nej.** F1 og F2 skal rettes først. Det er små tekst- og valgrettelser, og der skal ikke
regnes igen. Se `docs/kritik-483/FEJL-KRITIK.md`.

**Skaktime med klassens storm klar: nej**, som planen i 474 står. Siderne virker, men tre runder à 9 min når ikke
at være færdige kl. 42. Uret står som standard på "Intet", og stormens projektorvindue skifter ikke til turneringen.
`docs/kritik-483/SKAK-KRITIK.md` har en plan, der holder i dag uden ny kode.

## Gren

`kritik-483` fra `main` (`6d9b4e2`). Ikke pushet, ingen merges.
- Blok 1: `0ce6b5f`. Fejlfigurerne: FEJL-KRITIK, figurscriptet, målinger og billeder, og `verify:kritik-483` i
  `package.json`.
- Blok 2: den commit, der følger efter `0ce6b5f`. Skaktimen: SKAK-KRITIK, lektionsscriptet, målinger, billeder og
  denne rapport.

Verificering: `npm run verify:kritik-483`, eller `node outputs/kritik-483/verify-kritik-483.mjs 1|2` for én blok.

## Hvad ændret

Intet i appen, løftmodellen eller skak. Nyt:
- `docs/kritik-483/`: FEJL-KRITIK, SKAK-KRITIK og RAPPORT-483.
- `outputs/kritik-483/`:
  - `figurer-483.mjs` + `.json` og `F-*.png`: de fem side om side-figurer (modellen, A og B) som PNG. Fejlsiden på
    390 og 1280, og hvad SVG'erne selv siger uden siden omkring.
  - `skaktime-483.mjs` + `.json`, `koersel-skaktime.txt` og `S-*.png`: de 45 minutter med lærer (1280), to
    projektorvinduer og seks elev-pc'er (390).
  - `verify-kritik-483.mjs` og `verify-blok2-483.mjs`: læser kun de gemte målinger og dokumenterne.
- Én linje i `package.json`: `verify:kritik-483`.

**Kilderne er læst og ikke rørt:**
- `entropi-loeftmodel-dhruva` på `main` (`655e4cb`).
- `skak` på `main` (`9c5114f`), hentet med `git show` og `git archive` til scratchpad. Arbejdstræet `skak` havde
  Chaturangas igangværende 485, som jeg ikke har rørt.

**Blok 1, svar til Yantra:**
- **Hoften stiger først:** A. B1 må ikke på sitet (F2): den siger "lænd −11 %" om den fejl, coaches mest forbinder med
  lænden, og det er modellens stive ryg, ikke løfteren.
- **Stangen glider frem:** A, plus én sætning fra B2 (F3). B2's skulder 5 cm bag stangen ved knæhøjde er ikke det,
  en coach ser.
- **Albuen helt ude:** 80° i stedet for 90° (F4). Ved 90° lander stangen ved kravebenet.
- **Forbeholdet om skulderen:** det er godt, men det står 3995 px under "skulder −44 %" på 390, og bænk-SVG'erne
  bærer tallet alene (F1).
- **Min krops fane:** grader og cm er nok. For bænken skal "Afstand stang–skulder" ud (F9).
- **Holdninger, der ikke bør stå i Marcs navn:**
  - B1's "lænden får mindre at holde".
  - "Skulderens falder ca. 44 %" uden forbeholdet ved siden af.

**Blok 2, skaktimen:**
- **S1 (høj):** 3 × 9 min med to skift er ca. 36 min, ikke 27.
- **S2 (høj):** uret står på "Intet", og "Frit" på 15 + 10.
- **S3 (middel):** projektorskiftet midt i timen, og planens "Vis på projektoren" viser laget i lærerens eget
  vindue.
- **S4 (middel):** den store knap er "Start stormen", og stormkortet ligger under folden på 390.
- **S5 (middel):** koden vises ingen steder for læreren, men datoen fanger den forkerte pc.
- **S6 (middel):** et bord, der starter sent, holder hele klassen.
- **S7 (middel):** "bord" betyder to ting.
- **S8 (lav):** navnene tastes i timen, og i 1280×720 ses 21 af 25 i stillingen.

## Testresultat

- **Blok 1:** `figurer-483.mjs`:
  - Ingen vandret rulning på 390 og 1280, 10 billeder og intet netværk.
  - Siden på 390 er 14.947 px lang.
  - Forbeholdet om skulderen står 3995 px (390) og 2136 px (1280) under første "skulderen −44 %".
  - `bp-albue-ud.svg`, `bp-hoejt-bryst.svg` og `dl-stang-frem.svg` har skulderens fald uden forbehold, og
    `dl-hofte-foerst-skulder-frem.svg` har "lænd −11 %".
- **Blok 2:** `skaktime-483.mjs`: 24 tjek grønne og 8 fund, ingen JavaScript-fejl og intet netværk.
  - Fire pc'er fik samme kode KP63 = Node, og pc'en med forkert dato fik RX6F og "(27/9)".
  - Tid ude, mat og "Giv op" gav bordlinjen.
  - 12 borde plus fri runde, alle synlige i 1280×720.
  - "Parr runde 2" er låst, til alle resultater er inde. Pc'en husker bord og 4+0.
  - Hvert fund er et tjek, der fejler i målingen.
- **Tjek:**
  - `node outputs/kritik-483/verify-kritik-483.mjs 1`: grøn (før commit 1).
  - `npm run verify:kritik-483` (blok 1 + 2): grøn.
  - `npm run lint`: grøn.

## Hvad er næste

**Til Marc, før skaktimen:** Brug planen i SKAK-KRITIK ("Planen, som den holder i dag"):
- 10 min før timen, med sedler "Bord 1..12".
- Pc'erne stillet på Frit 4 min, 0 sek. og tema Gafler.
- Navnene tastet før timen, og 2 runder à 10 min.
- "Tjek 28/9 på knappen".
- Luk stormens projektorvindue kl. 15, og åbn turneringens.

**Yantra skal rette (før sitet):**
1. F1: bænkfigurerne og "Falder"-linjerne uden skulderens procent, og ved figuren én linje om, at modellen intet
   siger om skulderen.
2. F2/F3: A som figur for begge dødløftfejl, B1 helt væk fra sitet og Min krop, og B2 kun som én sætning.
3. F4: "Albuen helt ude" med 80° som hovedfigur, og en linje om, at grebet er holdt fast.
4. F5: "skulder −54 %" i "stangen glider frem" omdøbt til armen, der holder stangen ind.
5. F6: "Bhishak 457", "Variant A, som i 476" og "(ny i 481)" væk fra den offentlige side.
6. Lav: F7 (Setus sætning 2: "fra hælen" → "lidt bag midtfoden"), F8 (knæets procent i ord for atleter), F9 (Min
   krop, bænk: underarmens hældning i stedet for stang–skulder) og F10 (siden bliver kortere af sig selv).

**Chaturanga skal rette:**
1. S2: en knap "4+0" (og evt. "3+0") ved skakuret.
2. S4: "Dagens storm" som den store knap, når klassen tager dagens storm, eller øverst i kortet.
3. S3: ét projektorvindue for hele timen, der følger lærerens fane.
4. S5: projektoren skriver "Der skal stå 28/9 på din knap".
5. S8: stillingen i to spalter eller kompakt over 20 elever, og titlen fri af farveknapperne i 1024.
6. Skaktimen i RAPPORT-474 skrevet om efter S1, S6 og S7: runder og ur, der når at være færdige, "start uret, når
   alle sidder", og hvad et bord er.

**For Hara** (Coaching-planeten, spor "kropsmodel til teknikfeedback"): fejlfigurerne må ikke nå atleterne, før F1 og
F2 er rettet. Rettet lærer de det rigtige i coachens sprog: benene giver slip, og stangen væk fra benene giver
længere arme. Skaktimen hører ikke til Coaching-planeten.

## Ærlige grænser

- **Hvem jeg er:**
  - Ordren er til Bhishak. `CLAUDE.local.md` i denne mappe siger "Du er Vaidya". Marc bad mig udføre ordren, og
    ordren siger, at mappen er Bhishaks hjem, så jeg har udført den som Bhishak, som i 464.
  - I blok 1 er det mig, der vurderer som coach. Det er ikke målt på løftere. "Det, en coach ser" er min erfaring og
    bør ses af Marc, før det bliver en rettelse under hans navn.
- **Blok 1:**
  - Jeg har ikke regnet modellen igen. Tallene er Yantras, og jeg har kun tjekket dem mod tabellerne og figurerne.
  - 80° er mit valg ud fra, hvad jeg ser hos løftere, ikke en måling.
- **Blok 2 er headless, ikke et klasseværelse:**
  - Chromium via file://, ikke skolens pc'er, deres browsere eller en rigtig projektor.
  - Hvor lang tid børn bruger på at flytte sig og sætte sig, er et skøn (2-3 min pr. skift). Tryk, tegn, knappernes
    placering og urene er målt.
  - Eleverne er seks browsere, ikke 25. De andre borde i stormen og turneringen er tastet ind som syntetiske tal.
- **Urene:**
  - Lærerens ur står stille og flyttes kun med Playwrights `runFor`.
  - Elevernes ure løber frit mellem skridtene. Derfor er bord 4's slut "26 s efter 0:00" et regnet tal ud fra de
    skridt, scriptet tog, ikke et stopur.
- **Projektoren:** Fire skærmstørrelser er prøvet: 1280×720, 1024×768, 1280×800 og 1920×1080. Hvor langt væk
  skriften kan læses, er ikke målt.
- **Arbejdsmiljøet:** Playwright og chess.js er brugt fra `skak/node_modules`, via en junction i scratchpad. Intet er
  installeret i nogen repo.
- Ingen rigtige elever eller atleter, ingen sub-agenter, ingen push og ingen merges.
