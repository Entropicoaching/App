Ordre 461

En hel skaktime som elev og som lærer: computeren (436), efter-partiet (448) og klassens turnering (454), prøvet på skak `main` `1791bc0`. Intet i skak er rettet. (Bhishak)

## Gren

`kritik-461` fra main `403f3ee` i `entropi-app-kritik`. Der er intet merget og intet pushet.
- `3617ab1`: blok 1, eleven. Computeren på niveau 1-3, vendepunkterne regnet igen i dybde 6, makkerpartiet og det, eleven ser, når Spil åbnes.
- Blok 2 (skaktimen, KRITIK-skaktime og denne rapport) er grenens sidste commit.

## Hvad ændret

Intet i skak. Skak-mappen er kun læst: hvert script pakker `main` ud med `git archive` i en midlertidig mappe og låner skaks `node_modules` med en junction. Nyt i dette repo:
- `docs/kritik-461/ELEV-461.md` (blok 1): fund E1-E10, vindertabellen, computerens menneskelighed og tabellen med de 21 vendepunkter.
- `docs/kritik-461/KRITIK-skaktime.md` (blok 2): fund T1-T8 øverst, dommen, hvad der holdt, og Marcs time mandag.
- `docs/kritik-461/RAPPORT-461.md`: denne rapport.
- `outputs/kritik-461/`:
  - `skak-kopi-461.mjs`: kopien af skak-main.
  - `elev-profiler-461.mjs`: de simulerede elever ny, øvet og tilfældig.
  - `elev-node-461.mjs` + `.json`: 270 partier i Node.
  - `elev-browser-461.mjs` + `.json`: 8 partier i browseren, 2 makkerpartier og Træn-knappen.
  - `vendepunkter-dyb-461.mjs` + `.json`: dybde-6-tjekket.
  - `spil-start-461.mjs` + `.json`: hvad Spil viser, og tilbage fra biblioteket.
  - `skaktime-461.mjs` + `.json`: timen, uheldene og 300 turneringer.
  - `verify-kritik-461.mjs`.
  - Skærmbilleder: `b1-*.png` og `b2-*.png`.
- `package.json`: scriptet `verify:kritik-461`, som ordren kræver (samme greb som 441-457).

## Testresultat

- **Blok 1**, `node outputs/kritik-461/verify-kritik-461.mjs 1`: grøn. Kørsler bag tallene:
  - `elev-node-461.mjs 30` (270 partier, 307 s).
  - `elev-browser-461.mjs`: alle 12 tjek grønne, 638 s. Appens vendepunkter er de samme som `vendepunkter.js` i Node i 8 af 8 partier.
  - `vendepunkter-dyb-461.mjs`: 21 vendepunkter, alle i fuld dybde, 27 s.
  - `spil-start-461.mjs`.
- **Blok 2**, `npm run verify:kritik-461`: grøn. `skaktime-461.mjs` havde alle tjek grønne i sidste kørsel. I første kørsel var ét tjek rødt: vinderens ♛ er CSS (`::after`) og kommer ikke med i `innerText`. Det var mit tjek, der var forkert, ikke appen. Nu tælles `tr.proj-vinder`.
- **Tallene:**
  - En helt ny elev vinder 3 af 30 mod niveau 1, 1 af 30 mod 2 og 0 af 30 mod 3. En øvet elev vinder 16, 9 og 3 af 30.
  - Vendepunkterne: 21 af 21 er rigtige i dybde 6, og det bedre træk er godt i 21 af 21. Min kompetenceregel er enig med appen i 18 af 21, og med øjnene er knappen rigtig i 16 af 21.
  - Skaktimen med 11 elever: 0 omkampe i timen og i 300 turneringer. Projektoren ruller aldrig på 1920 × 1080 med almindelige navne, og navnene er væk alle steder efter Slet.
- `npm run lint`: grøn. Træet har ingen `node_modules`, så lint kørte gennem en midlertidig junction til hovedcheckoutens `node_modules`, og junctionen blev fjernet igen. Mine scripts er `.mjs` og ligger uden for lintens `*.js`/`*.jsx`, som i 441-457.

## Hvad er næste

**Dom:** klar til en skaktime: nej, fordi eleverne starter i en gådestilling (T1). Lærerens turnering holdt hele vejen. Rettes T1, eller står "Spil → Mod en makker → Start forfra → Ja" på tavlen, kan timen holdes.

Til Chaturanga, i den rækkefølge jeg ville tage dem:
1. **T1 = E1 (blokerer):** Spil skal starte i startstillingen, når eleven kommer fra Gåder, Lær skak eller biblioteket, og ikke overtage den fremmede stilling. **E2** har samme årsag: tilbage fra "Træn ..." skal partiet stå, som eleven forlod det.
2. **E5:** når det bedre træk selv vinder mindst en let officer (i dag gxh3 og Lxh3, som tager en fri dronning), skal vendepunktet sige "Her kunne du have taget dronningen" og pege på Slå den ubeskyttede, ikke på tabet.
3. **E4:** lad resultatboksen bruge vendepunkternes kompetencer i stedet for sin egen tælling på 2 halvtræk, så eleven får ét råd. Giver eleven op, mens eleven er langt foran, skal boksen sige det og ikke "Red din brik".
4. **E3:** hjælp en ny elev med at afslutte. Er eleven +9 foran i mange træk, kan appen vise "Du er langt foran. Skub kongen ud til kanten" med knapper til Dronningemat og Tårnmat i biblioteket.
5. **E6:** danske bogstaver (S, L, T, D) i vendepunkt-teksten, som i træklisten.
6. **T2:** advar ved to ens navne. **T3:** 3 runder som standard for en lektion (eller vis "ca. N min").
7. Pynt:
   - **E7:** slå to vendepunkter med samme bedre træk i træk sammen.
   - **E8:** brik og lektie i nr. 3, 4 og 14, og forvandling som egen art (nr. 15-16).
   - **E9:** den røde pil under den grønne, og korte kongepile.
   - **E10:** frem-og-tilbage-træk og tidlige tårntræk på niveau 1-2.
   - **T4:** Buchholz-kolonnen med lange navne.
   - **T5:** stillingen før første resultat.
   - **T6:** en linje om Buchholz på projektoren.
   - **T7:** "Sidder over" skal kunne slås fra.
   - **T8:** BUCHHOLZ-overskriften.

Til Marc: se "Marcs time mandag" i KRITIK-skaktime. Med tavle-sætningen og 3 runder kan timen holdes allerede nu. Det, der ikke er klar, er computerdelen for helt nye elever (E3-E5). Den kan vente til efter timen.

Arbejdet hører under school-planeten (sporet skakbrættet, frit bræt og opgaver til undervisningen), ikke Hara.

## Ærlige grænser

- **Eleverne er simulerede.** "Ny" og "øvet" er mine regler (sandsynligheder for at slå, redde, give skak og se mat i ét). De er ikke målt mod rigtige børn. Tallene siger, hvordan niveauerne opfører sig mod en elev, der spiller sådan, og især E3 (kan ikke sætte mat) kan være værre eller bedre i virkeligheden. Den nye elev er muligvis svagere til mat end et barn, der lige har set Dronningemat.
- **Scriptet gav op efter 60 elevtræk** i 6 af 8 browserpartier. Appen regnede dem derfor som tabt, også når eleven lå langt foran. Vendepunkterne er de samme uanset hvordan partiet sluttede, men "7 af 7 tabte partier gav Red din brik" gælder altså også for opgivne partier.
- **"Dybere søgning"** er appens egen motor i dybde 6 mod 4 (plus eksakte scorer for det spillede og det bedre træk), ikke Stockfish. Den ser to halvtræk længere og retter ikke motorens egen vurdering. Min kompetenceregel er min, og dommen "rigtig lektie" er min vurdering af, hvad en lærer ville vise.
- **20 vendepunkter er få.** 21 fra 8 partier siger noget om mønstrene (E5, E7, E8), ikke om hyppigheden i en hel klasse.
- **Projektoren** er målt i Playwrights Chromium på 1920 × 1080, ikke på en rigtig projektor eller i den ældre Edge på en skole-pc. "Læsbar fra bagerste række" er et skøn ud fra 25-41 px.
- **T3's minuttal** er 454's eget skøn (10-12 min pr. runde), ikke målt i en klasse. T7 er læst i koden (`turneringprojektor.js`), ikke fotograferet.
- **Rollen:** denne arbejdsmappe har en lokal instruks, der kalder agenten Vaidya. Marc bad direkte om at udføre ORDRE-Bhishak, og ordren peger på netop denne mappe som Bhishaks hjem. Derfor er ordren udført som Bhishak.
- Skak er kun læst (`git archive` af `main` `1791bc0`, junction til `node_modules`). Skak-mappens checkout står på en anden gren (`ur-og-storm`) med ucommittede ændringer fra kl. 04:58-05:04, som en anden arbejder laver. De er ikke mine og indgår ikke i målingerne, som alle er lavet mod `main`. Kun headless Chromium, musen er ikke rørt. Ingen elevdata (kun kaldenavne som "Løven" og "Elev"), ingen sub-agenter, ingen push og ingen merges.
