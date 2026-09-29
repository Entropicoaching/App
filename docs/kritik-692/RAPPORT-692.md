Klar til klassen: ja, men kun med lærerens hjælp på en lav telefon (360 x 560). De tre vigtigste ting Chaturanga retter næste gang: (1) Gåder, "Tag trækket tilbage" og "Hint" ligger 1465 px under brættet (skærm: Gåder efter et forkert træk; fil: `src/skak.template.html` linje 387 `#knap-gaade-fortryd` og `src/styles.css`); (2) Lær skak, fra trin 2 er 34 % af brættet under kanten på 360 x 560, og kongen i ringen er skåret (skærm: Lær skak, trin 2; fil: `src/laerskak.js` og `src/styles.css`, kortet `#laer-trin-oeverst`); (3) Spil, farve, niveau, "Vis et hint", "Giv op" og skakurets valg ligger 500 til 800 px under brættet (skærm: Spil mod computeren og Spil mod en makker; fil: `src/skak.template.html`, `#segment-spiller-farve`, `#segment-niveau`, `#knap-spil-hint`, `#knap-spil-giv-op`, `#segment-skakur`).

Ordre 692, Bhishak, 29. sep. 2026. Skakken på `main` @ `70c9435` (678 og 682 er med), set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus).

## Gren

`kritik-692`, lavet med `git checkout -b kritik-692 main` i `entropi-app-kritik`. Kun filer under `docs/kritik-692/` og `outputs/kritik-692/`. Skakken er hentet med `git archive` til en midlertidig mappe og er ikke rørt. Ingen push, ingen merges, ingen sub-agenter.

- commit 1: `outputs/kritik-692/skak-692.mjs` og `luk-664.mjs`, med `.json` og skærmbilleder.
- commit 2: denne rapport. Hashen står i `git log`.

## Hvad ændret

Kun mine egne scripts og dokumenter. Ingen skak, ingen app.

**Kan en 11-årig komme i gang uden hjælp? Ja, på 390 og 1280. På 360 x 560 næsten.**
- **Første skærm er Gåder, ikke Spil.** Eleven får en gåde og "Vi finder dit niveau: 0 af 10". Det er roligt og forståeligt. På 360 x 560 er brættet 97 % synligt (nederste række og bogstaverne er skåret).
- **Spil:** to store knapper (44 px), "Mod computeren" og "Mod en makker". Et tryk på e2 viser felterne, et tryk på e4 flytter, og computeren svarer. Brættet er 100 % synligt på 360 x 560 (top 161, bund 505) og 390 x 844 hele vejen. Det virker uden hjælp.
- **Makker med ur (5+0):** det lille ur under brættet fra 682 virker. To felter, 44 px, på skærmen (bund 555 af 560), og efter e4 e5 og 3 s viser det 4:57 og 5:00, så det tikker for den rigtige side. På 1280 er der ikke noget lille ur, og sidepanelet med det store ur står ved siden af brættet.
- **Gåde:** et forkert træk giver "Ikke den vej. Tag trækket tilbage og prøv igen." Det er en klar sætning. Et rigtigt træk giver "Din tur igen."
- **Lær skak:** "Jeg er ny" giver trin 1, "Brættet", med en grøn ring på e4 og "Klik e4". Efter tryk står "Rigtigt! Det er e4: linje e, række 4." og "Videre ›" (44 px) står på skærmen (top 214 på 360 x 560).

**Hvad er stadig besværligt eller rodet på lav telefon (360 x 560)?**
1. **Gåder, fortryd og hint.** Efter et forkert træk står teksten "Tag trækket tilbage" øverst, men knappen ligger 2025 px nede (brættet ender ved 590, skærmen ved 560). Eleven kan ikke se, hvad hun skal trykke på. "Vis et hint" ligger samme sted. På 390 er det 2043, på 1280 er det 1270 (på 1280 ligger den også under folden, men der kan man rulle med musen).
2. **Lær skak, trin 2 og frem.** Kortet med teksten er 4 linjer plus "Stjerner: 0 af 4 · Træk: 0 (færrest mulige: 4)" på to linjer, så brættet begynder ved 333 px. Brættets synlige del er 66 %, og kongen i ringen står i kanten og er skåret. Stjernerne over kongen ses, men kongen skal rulles frem. Trin 1 er 91 % synligt, og på 390 er alt 100 %.
3. **Spil, valgene under brættet.** Farve (1076 px), niveau (1167 px), "Vis et hint" (1275 px), "Start forfra" og "Giv op" (1327 px). Skakurets valg (1137 px) ligger efter "Klassens turnering". Startkortet siger "Niveau og farve står under brættet", så eleven ved det, men skal rulle 500 til 800 px. Det er det, 682 skrev, at den kun havde målt.
4. **Uret i makker-parti forklares under folden.** De to felter med 5:00 står under brættet uden en linje. "Uret starter, når hvid har trukket. Den der har trukket, trykker på sit eget felt." står 1255 px nede.
5. **Små:** "Til undervisning" skifter til "Undervisning", når man har været i en fane (samme knap, kortere tekst). Ingen vandret rulning, ingen knap under 44 px på telefon på nogen første skærm. På 1280 er 40 px høje knapper (temaer, niveau, skakur, farve) under 44, men det er en mus.

**Er mine åbne skak-fund fra 664 lukket?** Ja, næsten. Målt på `main` med samme syntetiske lager som 664:
- **S17 lukket.** Startkortet med Gafler valgt viser "Gafler, bedst: i dag 4 · uge 4 · rekord 4." på én linje, og "Din rekord på denne enhed" står ikke.
- **S15 lukket.** Søjlerne har nu overskriften "Dine sidste stormer".
- **S16 delvis.** "Dagens storm (28/9)" har stadig datoen i knappen. Den er kort og forståelig, så jeg regner den for lav.
- **S18 lukket.** Kun "Gafler" står på siden (ingen "Gaffel").
- **S19 lukket.** Brættet i Spil på 360 x 740 ender ved 665, 75 px over kanten (før 24 px under).
- **S20 lukket.** Fanerne har 0 px mellemrum, så et tryk mellem rækkerne rammer en fane (`fane-spil`, `fane-gaader`, `fane-opstil`).

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-692/skak-692.mjs` | Fire forløb (computer, makker med 5+0, gåde med forkert og rigtigt træk og tilbage, Lær skak "Jeg er ny" trin 1 og 2) på 360 x 560, 390 x 844 og 1280 x 800. 0 net, 0 JS-fejl. `skak-692.json` og 51 billeder `S692-*.png` |
| `node outputs/kritik-692/luk-664.mjs` | S15 til S20 på 360 x 740, 390 x 844 og 1280 x 800. 0 net, 0 JS-fejl. `luk-664.json` og 6 billeder `L692-*.png` |
| `npm run lint` | grøn (eslint, ingen fund) |

Ingen `verify:*` er kørt, fordi ingen appkode er rørt. Første kørsel af gåde-forløbet ramte et forkert træk, hvor "Tag trækket tilbage" ikke kunne findes uden rulning; scriptet ruller nu til knappen, som en elev skulle.

## Hvad er næste

**Chaturanga (skak), i denne rækkefølge:**
1. **Gåder:** sæt "Tag trækket tilbage" og "Vis et hint" i en række lige under brættet på en telefon (`#knap-gaade-fortryd`, `#knap-gaade-hint`). Eller lad et forkert træk gå tilbage af sig selv efter et sekund. Det er det ene, der får en elev til at stå fast uden hjælp.
2. **Lær skak:** gør kortet kortere på en lav telefon, så brættet begynder højere og hele brættet står på skærmen: én linje "Stjerner 0 af 4", og teksten skåret til to linjer. Eller ryd brættet frem ved hvert nyt trin.
3. **Spil:** en lille række lige under brættet med "Vis et hint" og "Giv op" (mod computeren), og farve og niveau tættere på (fra 682's liste, nr. 2). Skakurets valg (5+0) hører hjemme i samme række, når "Mod en makker" er valgt, og linjen "Den der har trukket, trykker på sit eget felt" skal stå ved det lille ur.

**Marc:** klassen kan bruge skakken nu på computer (1280) og på en høj telefon (390 x 844). På en lav telefon skal læreren vide, at "Tag trækket tilbage" og "Vis et hint" i Gåder ligger langt nede, og at farve og niveau i Spil står under brættet.

**Til Hara:** School-planeten, spor "Skakbrættet, frit bræt og opgaver til undervisningen".
- Skakken er klar til klassen: ja. Chaturangas 678 og 682 virker: hovedet er lavere, og det lille ur under brættet tikker rigtigt.
- Alle mine 664-fund er lukket eller lave.
- Tre rettelser står tilbage på 360 x 560, og de er alle "det man skal trykke på ligger under brættet".

## Ærlige grænser

- **Ingen rigtig 11-årig, klasse eller telefon har set noget.** Alt er målt i headless Chromium på Windows, touch er emuleret. "Kan komme i gang uden hjælp" er mit skøn ud fra skærmbillederne og målene.
- **Én gåde pr. skærm.** Gåden er tilfældig ved hver kørsel (hvid eller sort, forskellig stilling). Målene for knappernes højde er stabile, men et enkelt billede kan vise sort nedefra.
- **Lær skak:** kun trin 1 og 2 er set. De øvrige 30 trin er ikke gennemgået, så 66 % synligt bræt i trin 2 gælder ikke nødvendigvis dem alle. Trin 3 og frem er ikke målt, fordi hvert trin kræver sin egen løsning.
- **Ingen partier spillet til ende.** Computerens svar, uret og gåden er kun set få træk ind. Slutkort, gennemsyn og "Giv op" er ikke spillet her.
- **Lageret i 664-tjekket er syntetisk.** Ingen elevdata, ingen rigtige navne, intet net (0 netkald).
- **Ikke rørt:** skakken, motoren, ratingen, Marcs klasses time og alle andre træer.
