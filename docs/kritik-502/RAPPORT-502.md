Ordre 502

# Klar til udgivelse? Squat-artiklen med Min krop og værktøjssiden

Bhishak, 27. sep 2026. Til Dhruva via Marc. Planet coaching, spor "Løft-artikler på entropicoaching.dk".

**Domme:**
- Squat-artiklen (`udgivelse-squat-min-krop` `2087136`): **klar til udgivelse: nej**. Se
  `docs/kritik-502/SQUAT-UDGIVELSE.md`, fund U1-U16. Fire ting stopper, og alle er små. Det største er, at der
  står "[MARC]" synligt i kapitel 4.
- Værktøjssiden (`vaerktoejer` `7fe59e1`): **vaerktoejssiden klar: nej**. Se `docs/kritik-502/VAERKTOEJER.md`,
  fund V1-V10. To [MARC]-felter står synligt, og De tre løft viser "Marcs mål" og et internt filnavn.

Begge sider er teknisk sunde. Der er 0 JS-fejl, 0 vandret rulning på 390 og 1280 px, 0 tankestreger, 0
atletnavne, og alle interne links findes. Det, der mangler, er tekst, og det er næsten kun ting, Marc skal
tage stilling til.

**Til Hara:** coaching-planetens spor for løft-artiklerne. Squat-artiklen er én commit fra klar. Setu skal
rette U1, U3 og U4, og Marc skal vælge én sætning (U2).

## Gren

- Gren `kritik-502` fra `main` (`b4b011b`) i `entropi-app-kritik`. Ikke pushet, intet merget.
- `b17aace` blok 1: squat-artiklen, SQUAT-UDGIVELSE med dom, målinger og billeder.
- Blok 2: værktøjssiden, VAERKTOEJER med dom og denne rapport. Commit-hashen står i afleveringen.
- Filer kun under `docs/kritik-502/` og `outputs/kritik-502/`. Sitets grene er kun læst med `git show`,
  `git ls-tree` og `git archive` til en midlertidig mappe, der er slettet igen. Intet træ i
  `entropi-coaching-site-wt2` er rørt, og worktreen står stadig på `loeft-instagram`.

Én verificeringskommando pr. blok: `node outputs/kritik-502/verify-kritik-502.mjs 1` og `... 2`.

## Hvad ændret

Intet på sitet, i appen eller i løftmodellen. Jeg har tilføjet:
- `outputs/kritik-502/side-502.mjs`: henter en gren med `git archive` og serverer den på 127.0.0.1. Den
  kører hver side headless på 390 (touch) og 1280 px og blokerer og tæller alt uden for huset. Den måler
  meta, links og om de findes på grenen, fejl, rulning, [MARC]-felter, tankestreger, atletnavne og private
  filer.
- `outputs/kritik-502/detalje-502.mjs`: nærbilleder og skriftstørrelse de steder, fundene handler om.
- `outputs/kritik-502/verify-kritik-502.mjs`: tjekker målingerne mod dokumenterne. Den tjekker også, at
  sitets grene ikke er flyttet siden målingen, at jeg ikke har skrevet atletnavne, og at `npm run lint` er
  grøn.
- Målinger (`squat.json`, `squat-indlejret.json`, `vaerktoejer.json`, `*-detaljer.json`), sidernes synlige
  tekst og skærmbilleder.
- `docs/kritik-502/SQUAT-UDGIVELSE.md`, `VAERKTOEJER.md` og denne rapport.

Forsiden (`index.html`) blev målt én gang som kontrol og derefter taget ud. Dens synlige tekst har
atletnavne fra resultaterne, og de må ikke ligge i appens offentlige repo.

## Testresultat

- `node outputs/kritik-502/verify-kritik-502.mjs 1`: GROEN.
- `node outputs/kritik-502/verify-kritik-502.mjs 2`: GROEN (blok 1 + 2 og lint).
- **Squat-grenen**, fem sider × to bredder:
  - 0 konsolfejl, 0 JS-fejl, 0 manglende filer og 0 brudte billeder. Rulningen er 0.
  - Artiklen er 50.979 px høj på 390. Min krop laver 0 kald ud af huset.
  - Titlen er 88 tegn og beskrivelsen 209 (U7).
  - Der er én synlig "[MARC]" (U1) og fire skjulte i kilden (U4).
- **Værktøjsgrenen**, fem sider × to bredder:
  - 0 fejl, 0 rulning og 0 kald ud af huset. Siden er noindex og står ikke i sitemap eller menu.
  - Der er to synlige [MARC]-felter (V1). De tre løft har "Marcs mål" og `kroppe/marc.json` i den synlige
    tekst (V2).
  - Den indlejrede tre-løft i artiklen har ikke Marcs navn.
- **Live-sitet:** tre GET-kald viste, at `/outputs/RAPPORT-174.md`, `/outputs/FORSLAG-TIL-MARC.md` og
  `/scripts/maal.mjs` svarer med 200 i dag (U11). Det var mine eneste kald ud af huset.

## Hvad er næste

**Setu retter** (én commit pr. gren, ingen stopper noget andet):
- `udgivelse-squat-min-krop`:
  - **U1:** slet "[MARC] " i kapitel 4.
  - **U3:** kapitel 3's indledning og tabellen skal sige "ikke regnet i bunden", ikke "intet krav". Det
    gælder både `artikel-squat.html` og `assets/squat-anatomi.js`.
  - **U4:** de fire skjulte `<span class="marc">` skal ud af udgivelsesgrenen.
  - Når Marc har valgt: U2's sætning og U6's første linje.
  - Samme commit: U7 (titel på 67 tegn, beskrivelse på ca. 150), U8 (datoen på udgivelsesdagen), U9
    ("< Artikler" til `artikler.html` eller et kort på `viden.html`), U14 (2021a/b og "Modellens kilder") og
    U16.
- `vaerktoejer`: V1 efter Marcs svar, V4 og V5, og V3's linje om den skjulte skulder, fod eller knæ, når
  Yantra har valgt grebet.
- Efter Marcs ja: fjern `outputs/` og `scripts/` fra main i en særskilt commit (U11).

**Yantra retter** (løftmodellen, Setu kopierer bagefter):
- **V2:** De tre løft skal starte på "Gennemsnitlig løfter". "Marcs mål" skal ud eller omdøbes, og linjen
  om `kroppe/marc.json` og "ikke målt endnu" skal ud.
- **U5:** "Marcs målte skelet" og "Marcs eget klip" i `maalt-over-model.js` skal skrives i første person
  eller uden navn.
- **U12/V10:** én sætning om de to referencekroppe, med højde og vægt.
- **U15:** kilden til 0,09 m/s.
- **V7:** et link tilbage til værktøjerne.
- **U10:** byggetrinnet, der fjerner noter og ordrenumre fra bundterne (fra 496).

**Kun Marc kan afgøre:**
- **U2:** linkets sætning til Min krop. Den er nu en opfordring i Yantras ord.
- **U5:** "Marcs" eller "mit" i kapitel 6, og om 183 cm og 120 kg skal stå offentligt.
- **U6:** skal dødløftkapitlet med i squat-artiklen, og skal løftet "Squat-udgaven kommer" ud?
- **U10:** skal ordrenumre og agentnavne ud af kildekoden?
- **U11:** må `outputs/` og `scripts/` fjernes fra main?
- **U13:** hvor mange forbehold må stå inde i teksten, og hvor mange skal ned i "Forbehold"?
- **V1:** svar på de to [MARC]-spørgsmål i filmeguiden, eller slet dem.
- **V6:** skal filmeguiden vente på Mål dit billede, eller skal den være en guide til at filme til coachen i
  dag?
- **V8:** én sti til Min krop, før begge grene merges.
- **V9:** sidens overskrift.

Rækkefølgen, jeg foreslår: Marc svarer på U2 og U6, Setu retter squat-grenen, jeg gentjekker, og Marc
udgiver. Værktøjssiden kan merges bagefter som den er (noindex, ude af menuen), men bør ikke linkes, før V1
og V2 er lukket.

## Ærlige grænser

- **Kun headless Chromium på Windows**, med en lokal server. Ikke Safari, ikke en rigtig telefon og ikke
  GitHub Pages. Google Fonts var blokeret, så skærmbillederne viser reserveskrifterne.
- **Fagligt** har jeg læst artiklens synlige tekst og foldernes kilder. Modellens tal er ikke regnet efter,
  og referencerne er ikke slået op, så U15 er en uoverensstemmelse mellem hovedtekst og fold, ikke en
  bekræftet fejl. Bibliografien er kun tjekket på det, jeg selv kender.
- **Filmeguiden er vurderet geometrisk** ud fra skivens 22,5 cm radius og fasernes stillinger, ikke med
  rigtige videoer. At et punkt er skjult i alle fire faser, gælder kun, når kameraet står nøjagtigt fra
  siden. Et par graders drejning kan åbne for punktet og koster lidt vinkelfejl. Den afvejning er Yantras.
- **Navnetjekket** dækker de tre fornavne i appens `.gitignore`. Jeg har læst artiklen og værktøjssiden
  igennem, og der står ingen atletnavne.
- **Iframes:** teksten inde i artiklens to rammer kunne ikke læses fra artiklen (tidsgrænse). Den er i stedet
  målt på rammernes egne sider (`kort.html` og den indlejrede tre-løft).
- Ingen push, ingen deploy, ingen merges og ingen sub-agenter. Ingen atletdata ud over Marcs egne mål, som
  allerede står på grenene.
