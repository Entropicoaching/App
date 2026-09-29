Klar til klassen: ja, nu også på en lav telefon (360 x 560), med tre rester Chaturanga retter næste gang: (1) Spil, farve, niveau og skakurets valg (5+0) ligger stadig 1127 til 1217 px under brættet (skærm: Spil mod computeren og Spil mod en makker; fil: `src/skak.template.html`, `#segment-spiller-farve`, `#segment-niveau`, `#segment-skakur`, samt mobil-CSS i `src/styles.css`); (2) Gåder på 360 x 560 har et lille bræt (264 px, 33 px pr. felt), og rækken "Vis et hint / Tag trækket tilbage" slutter præcis ved skærmkanten (bund 560 af 560), fordi hovedet før brættet fylder 246 px (skærm: Gåder efter et forkert træk; fil: `src/skak.template.html` `#gaade-strimmel`, `#gaade-tur-tekst`, `src/styles.css`); (3) Lær skak er kun bevist til trin 2, og på 1280 x 800 ender brættet 12 px under kanten efter trin 1 (98 % synligt) (skærm: Lær skak, trin 1 efter e4 på 1280; fil: `src/laerskak.js` og `src/styles.css`, `#laer-trin-oeverst`).

Ordre 704, Bhishak, 29. sep. 2026. Skakken på `main` @ `b519a17` (693 og 695 er med; 701 er ikke merget og har ingen rapport, så den er ikke vurderet). Set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus).

## Gren

`kritik-704`, lavet med `git checkout -b kritik-704 main` i `entropi-app-kritik`. Kun filer under `docs/kritik-704/` og `outputs/kritik-704/`. Skakken er hentet med `git archive main` til en midlertidig mappe og er ikke rørt. Ingen push, ingen merges, ingen sub-agenter.

- commit 1: `outputs/kritik-704/skak-704.mjs` og `ekstra-704.mjs` med `.json` og skærmbilleder.
- commit 2: denne rapport. Hashen står i `git log`.

## Hvad ændret

Kun mine egne scripts og dokumenter. Ingen skak, ingen app.

**Kan en 11-årig komme i gang uden hjælp, og ser eleven altid brættet og det, der skal trykkes på? Ja.**
- **Første skærm** er Gåder med brættet 100 % synligt på alle tre størrelser (360 x 560: top 246, bund 510).
- **Spil mod computeren:** to store knapper (44 px). Brættet er 100 % synligt (161 til 505). Lige under brættet står en række med Fortryd, Hint og Giv op (44 px, 511 til 555 af 560). Et tryk på e2 og e4 flytter, computeren svarer (e5). Giv op spørger "Giv op? Modstanderen vinder partiet." med "Ja, giv op" (44 px) på skærmen, og bagefter står "Gennemse partiet" og "Nyt parti" lige under brættet (496 til 540), sammen med nøjagtighed pr. side. Ingen skjult knap.
- **Makker med ur (5+0):** uret under brættet (511 til 555) viser 5:00, og efter 3 s 4:57 og 5:00, så det tikker for den rigtige side. Forklaringen "Uret starter, når hvid har trukket..." findes, men står under brættet (se nr. 3 nedenfor). På 1280 står det store ur i sidepanelet på skærmen (495 til 753).
- **Gåde:** et forkert træk giver "Ikke den vej. Tag trækket tilbage og prøv igen." og en række lige under brættet med "Vis et hint" og "Tag trækket tilbage" (44 px, 516 til 560 på 360 x 560). Et tryk på hint og tilbage virker.
- **Lær skak:** "Jeg er ny" giver trin 1 med en grøn ring, "Klik e4", og efter tryk "Rigtigt! Det er e4..." med "Videre" (44 px) før brættet, på skærmen. Trin 2 "Kongen" har hele brættet på skærmen på 360 x 560 (kortet er kompakt, brættet 100 %) og kongen i ringen er hel.

**Hvad er stadig besværligt eller rodet på lav telefon?**
1. **Spil, valgene.** Farve ligger 1127 px, niveau 1217 px og skakurets valg 1187 px nede (360 x 560); på 390 x 844 er det 1201, 1291 og 1261. Startkortet siger, at de står under brættet, så eleven ved det, men skal rulle over en meter. Fortryd, Hint og Giv op er flyttet op, men ikke valgene.
2. **Gåder, lille bræt og en række der rammer skærmkanten.** Hovedet (fejltekst på to linjer, niveaukort hvor "Hvid trækker" brydes til to linjer) fylder 246 px, så brættet er 264 px bredt, og rækken under brættet slutter præcis ved 560. Det virker, men der er ingen luft, og på en rigtig telefon med adresselinje kan den sidste pixel forsvinde.
3. **Uret forklares under folden.** Linjen om at "den der har trukket, trykker på sit eget felt" står ved uret under brættet (1306 px), ikke ved det lille ur.
4. **1280 (mus):** på Gåder ligger "Vis et hint" 1270 px nede (musen ruller, men det er langt); efter trin 1 i Lær skak ender brættet 12 px under kanten (98 %); tema- og niveauknapper er 40 px høje (fint til mus).

**Er mine tre fund fra 692 lukket?**
- **Nr. 1, Gåder, Tag trækket tilbage og hint 1465 px nede: lukket.** Nu lige under brættet på 360 x 560 (516 til 560).
- **Nr. 2, Lær skak trin 2, 34 % af brættet under kanten: lukket for trin 2.** Brættet er 100 % synligt, kongen er hel. Trin 3 og frem er ikke set (se grænser).
- **Nr. 3, Spil, farve, niveau, hint, giv op, skakur 500 til 800 px nede: delvis.** Hint, Fortryd og Giv op er lukket (lige under brættet). Farve, niveau og skakurets valg ligger stadig 1100 til 1300 px nede.
- **693:** Gennemse partiet og Nyt parti står lige under brættet efter et parti (set efter Giv op på 360 x 560, 496 til 540, 44 px). Lukket.

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-704/skak-704.mjs` | Fire forløb (computer, makker med 5+0, gåde, Lær skak "Jeg er ny") på 360 x 560, 390 x 844 og 1280 x 800. 0 net, 0 JS-fejl. `skak-704.json` og `S704-*.png` |
| `node outputs/kritik-704/ekstra-704.mjs` | Giv op med bekræftelse og slutrækken (693) på 360 x 560. Trin 2 i Lær skak kunne jeg ikke få løst med min stjerne-rute. 0 net, 0 JS-fejl. `ekstra-704.json` og `S704-360x560-14-*` |
| `npm run lint` | ikke kørt; ingen appkode er rørt |

## Hvad er næste

**Chaturanga (skak), i denne rækkefølge:**
1. **Spil:** få farve, niveau og skakurets valg tættere på brættet på en telefon: en lille "Indstillinger"-række (fold ud) lige under Fortryd/Hint/Giv op, eller før partiet starter. Og flyt linjen om uret op til det lille ur.
2. **Gåder:** gør hovedet kortere på 360 x 560 (fejltekst på én linje, "Hvid trækker" uden linjebrud), så brættet kan være større, og lad rækken under brættet have luft mod skærmkanten.
3. **Lær skak:** tjek de længste trin (kort + bræt), og sænk kortet lidt på 1280 x 800, så brættet er 100 % synligt efter trin 1.

**Marc:** klassen kan bruge skakken nu, også på en lav telefon, uden lærerens hjælp til at finde Tag trækket tilbage, Hint og Giv op. Læreren skal stadig vide, at farve og niveau i Spil står langt nede under brættet.

**Til Hara:** School-planeten, spor "Skakbrættet, frit bræt og opgaver til undervisningen".
- Skakken er klar til klassen: ja. Chaturangas 693 og 695 har lukket mine fund om Gåder og Lær skak på lav telefon, og Fortryd, Hint, Giv op, Gennemse og Nyt parti står nu lige under brættet.
- Tilbage er to småting på lav telefon: valgene i Spil står langt nede, og Gåder har et lille bræt.

## Ærlige grænser

- **Ingen rigtig 11-årig, klasse eller telefon har set noget.** Alt er målt i headless Chromium på Windows, touch er emuleret. "Kan komme i gang uden hjælp" er mit skøn ud fra skærmbillederne og målene.
- **701 er ikke vurderet:** den er ikke merget på `main` og har ingen rapport.
- **Gåde på 390 x 844 og 1280:** den tilfældige gåde var ikke i banken på disse to kørsler, så "forkert træk og tilbage" er kun set på 360 x 560.
- **Lær skak:** kun trin 1 og 2 er set. Mit forsøg på at løse trin 2 i det ekstra script gav ikke "Videre"; ruten var forkert, ikke nødvendigvis appen. De 30 andre trin er ikke gennemgået.
- **Ingen partier spillet til ende** udover Giv op; computerens svar er kun set to træk ind.
- **Ikke rørt:** skakken, motoren, ratingen, Marcs klasses time og alle andre træer. Ingen elevdata, ingen rigtige navne, intet net (0 netkald).
