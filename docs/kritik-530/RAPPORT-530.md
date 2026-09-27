Ordre 530: to gentjek. Mål dit billede og før/efter efter Yantras 522 (begge ja til sitet) og skakken efter Chaturangas 523 (anbefales: ja) (Bhishak)

Fra Dhruva via Marc. Blok 1 hører til planet coaching, sporet kropsmodel-til-teknikfeedback-i-de-tre-loeft. Blok 2 hører til school.

**Identitet:** repoets CLAUDE.local.md kalder mig Vaidya. Ordren siger Bhishak, og dette træ er Bhishaks hjem, som i 409-525. Jeg har arbejdet som Bhishak, kun under `docs/kritik-530/` og `outputs/kritik-530/`.

## Gren

`kritik-530` fra `main` (`804a771`) i `entropi-app-kritik`. Intet er pushet, intet er merget, og ingen sub-agenter er brugt.

- **Blok 1** (`75a3d83`): Mål dit billede og før/efter, `docs/kritik-530/MAAL-BILLEDE-4.md`.
- **Blok 2**: skakken, `docs/kritik-530/SKAK-3.md` og denne rapport. Hashen står i `git log`, og commit-beskeden starter med "kritik 530 blok 2".

**Kun læst, intet rørt:**
- `entropi-loeftmodel-dhruva` main @ `c9950e0` (522 merget). Hentet med `git archive` til en midlertidig mappe.
- `skak` main @ `e460aa7` (523 merget). `skak.html` er åbnet som file://.

## Hvad ændret

Kun kritik. Ingen kode i appen, løftmodellen eller skakken er ændret.

**Blok 1, Mål dit billede og før/efter** ("Mål dit billede klar til sitet: ja" og "foer og efter klar til sitet: ja"):
- **B13 er lukket.** Med Min krop (183 cm/120 kg) og 270 kg er siden 360, 375 og 390 px i alle seks faser. Det holder også med "Stang −10,7 cm" og i før/efter med "Stang −8,5 cm", så E6 er også lukket. På 360 og 375 brydes tallinjen efter "Knæ". På 390 er der 17 px luft (517: 3 px). B12's mærke holder.
- **E7 er lukket.** Afkrydsningen "Et af de fjerne nav er skønnet" er 44 px høj, og et tryk på teksten sætter krydset. Stangens grænse går fra 3,0 til 6,0 cm, og noten siger "Klik kun et nav, du kan se".
  - **Min Monte Carlo:** et skønnet nav gav 41 % falske forskelle (stangen 33 %). Med krydset er det 16 % (stangen 1 %).
  - **Yantras spørgsmål (er faktoren 2 for streng?):** nej. Med én runde ville 1,5 være nok. Men klikker coachen samme sted på kanten tre gange, er stangen med i 21 % af parrene med 1,5 og i 9 % med 2, som et skarpt nav.
  - **Prisen:** en stang flyttet 3 cm bliver kun fundet i 13-19 % af parrene med et skønnet nav. Det er ærligt, og reglen "klik kun et nav, du kan se" er svaret.
- **E8 er lukket.** "5 rækker … hvert sjette" og "8 rækker … hvert fjerde" passer med mine 16 % og 23 %.
- **E3-resten er lukket.** Uden navet er de to forkerte kamerapladser (30 cm højere: −5,8 cm; 60 cm lavt: +7,4 cm) nu "kun et hint, ikke en dom". Med navet er alle fire ok. Et billede 12 cm fra sticking point får stadig en dom.
- **Nyt: E9 (lav).** Med krydset siger sætningen stadig "Stangen samme sted (inden for målefejlen)", selv om grænsen er 6 cm. Det stopper ikke sitet.

**Blok 2, skakken** ("skakken klar til at Marc anbefaler den til eleverne: ja"):
- **Lukket:**
  - **K1:** "Hvem vil du spille mod?" står over brættet og kan ses uden at rulle på 360 og 390. Valget huskes efter en genindlæsning.
  - **K2:** "Indlæs parti" spørger, og Annuller lader partiet være.
  - **K3:** remis og "*" analyseres. En tekst uden træk siger "Fandt ingen træk i teksten."
  - **K5:** "Spyd" overalt.
- **Delvis:** K6. Bordfeltet står kun i "Mod en makker".
- **Åbne, fordi de ikke blev lavet i 523:** K4, K7, K8, K9 og K10. Chaturanga kunne ikke læse min 517-rapport.
- **Koordinattræningen virker på en telefon:**
  - Feltets navn, uret og hele brættet står på én skærm (457-487 px).
  - Felterne er 38-42 px.
  - En runde på 30 s giver 25-27 felter fra begge sider.
  - Fra sort står h1 øverst til venstre.
  - Rekorden huskes, og partiet er urørt.
- **Nyt: K11 (lav).** En stoppet storm tæller ikke som rekord. Kortet siger så "Ingen rekord endnu … sæt den første!" efter 15 løste gåder.

## Testresultat

- `node outputs/kritik-530/maal-side-530.mjs`: **19/19** grønne (dhruva `c9950e0`).
- `node outputs/kritik-530/foer-efter-530.mjs`: Monte Carlo med 2000 par pr. linje uden ændring og 1000 med ændring. Min regning af rækkerne med faktor 1 og 2 giver de samme rækker som 522's kode i 100 % af parrene.
- `node outputs/kritik-530/skak-530.mjs`: **19/19** grønne (skak `e460aa7`). Første kørsel gav 17/19. Begge fejl var mine egne tjek:
  - K3 ventede en anden ordlyd.
  - K6 ledte efter en tekst, der kun står i "Mod en makker".
  
  Tjekkene er rettet efter det, siden faktisk gør. Adfærden var den samme.
- `node outputs/kritik-530/verify-kritik-530.mjs --blok 1`: grøn (commit 1).
- `node outputs/kritik-530/verify-kritik-530.mjs --blok 2`: grøn. Den tjekker:
  - dokumenterne og de gemte målinger
  - at grenen kun rører `docs/kritik-530` og `outputs/kritik-530`
  - at der ikke er nogen upstream
  - at commit-beskederne er ASCII
  - at dhruva og skak er urørte
  - `npm run lint`
- `npm run lint`: grøn.

## Hvad er næste

**Setu** (værktøjssiden):
- Kopiér `dist/maal-billede/` (index.html og maal-billede.js) fra `entropi-loeftmodel-dhruva` main `c9950e0` til sitet. Både Mål dit billede og før/efter har mit ja.
- Brug noindex, indtil Marc siger til, som ved de andre værktøjer.

**Vaidya** (appen):
- Appens kopi i `public/maal-billede/` er stadig 510 (A1 i kritik 521). Den skal erstattes med `dist/maal-billede/` fra `c9950e0`, så appen får det fjerne nav, tærskel pr. række, krydset (E7), noten (E8) og hintet (E3).
- Kør mit B13-tilfælde (Min krop, 360 px) i appens egen visning.
- Det har betydning for Hara (Coaching-planeten, delmålet "Appen mærkbart bedre"). Før/efter i appen er den version, jeg har sagt ja til, først når kopien er skiftet.

**Chaturanga** (skak). Punkterne står her, fordi 517-rapporten ikke kunne læses i 523:
1. **K4:** vis navnene fra PGN (White/Black) i stedet for "Hvid/Sort" i analysetabellen, når de findes.
2. **K7:** på en telefon skal stormens startkort (eller en knap "Storm") stå før dagens gåde og niveau-testen, eller øverst i Gåder.
3. **K8:** én sætning i forklaringen: "Tallet kan ikke sammenlignes med lichess, og efter et afgjort parti stiger det."
4. **K9:** på stormens slutkort skal man kunne trykke på hver gåde, der gik galt, og se løsningen.
5. **K10:** koordinater på "Lær af dine fejl"-brættet som på hovedbrættet.
6. **K11:** ved en stoppet storm: "En stoppet storm tæller ikke som rekord."
7. **K6 (valgfrit):** skjul "Bord nr." hjemme, og vis det kun, når klassens time eller turnering er i brug.

**Yantra:** E9. Med krydset skal sætningen sige "Stangen: ingen forskel over 6 cm (det fjerne nav er skønnet)", eller stangen skal udelades af sætningen.

**Marc:** klik kun det fjerne nav, hvis du kan se det. Har du skønnet det, så sæt krydset, og send ikke "Stangen samme sted" fra et sådant par, før E9 er rettet.

**Hara:**
- Blok 1 har betydning for Coaching-planeten (sporet kropsmodel-til-teknikfeedback). Mål dit billede og før/efter er klar til sitet, og appen får dem, når Vaidya har skiftet kopien.
- Blok 2 hører til school.

## Ærlige grænser

- **Kun headless Chromium på Windows.** Ingen rigtig iPhone eller Android. Touch er Playwrights. Tallinjens brud og koordinatbrættets størrelse afhænger af skrifttype og skærm.
- **Mål dit billede:**
  - Klikfejlen er antaget, ikke målt. Navets 2,5 cm er Yantras skøn på ét billede, og "samme sted på kanten" er min model.
  - Efter-billederne og squatten er tegnede figurer. Kun Marcs før-billede er et foto, og skærmbillederne af det er kun udsnit af tallinjen.
  - E9's "krydset huskes" er kun prøvet ved faseskift.
  - B10 venter stadig på Marcs squatklip.
- **Skakken:**
  - Eleven er et script. 8 af 10 rigtige med 0,9 s mellem trykkene er mit gæt på en elev på 12.
  - Stormen er stoppet efter 25 s.
  - Forhåndstræk, lyd, briksæt, biblioteket, klassens time og lærersiden er ikke prøvet igen.
- **Ingen rigtige elever eller atleter.** Kun Marcs eget klip fra 462 og syntetiske data.
