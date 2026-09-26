Ordre 416

# Rapport 416: questbogen i matematikspillet set af en 10-årig

**Levende for en 10-årig: nej, fordi** personens grund og opgaverne bagefter
ikke hænger sammen i 9 af 14 quests (4 aldrig), og fordi den korteste vej til
to belønninger er at trykke på knapper uden at regne. Rammen virker: det
første "!" kommer efter 3 opgaver (ca. 2 minutter), et tryk på det slår bogen
op det rigtige sted, grunden står i skærmen to gange, takkekortet er et godt
"dop", og alt står der efter genindlæsning. Fundene står i
`docs/kritik-416/KRITIK-questbog.md` (Q1-Q9).

Har arbejdet betydning for Hara (planet school, sporet "matematik-minispil,
træn kompetencerne som gåder"): **ja.** Det giver Ganita en kort liste, der
gør questbogen til det, Marc bad om (lås op ved at klare noget, med et lille
dop), og ikke til en knap-trykker: grund og opgaver skal hænge sammen, og gæt
må ikke give belønning.

## Gren

`kritik-416` fra appens `main` @ `da89c90`, worktree `entropi-app-kritik`.
Filer kun under `docs/kritik-416/` og `outputs/kritik-416/` + én linje i
`package.json` (`verify:kritik-416`, som 399/403/409).

- `f7f04d2` blok 1: eleven (ny figur, 390 px, første "!", tre quests, genindlæsning)
- `b29081e` blok 2: questene (tekst mod grund, kæder, belønninger, gætte-elev)
- blok 3 (KRITIK, verify, denne rapport): commit efter `b29081e` på `kritik-416`

## Hvad ændret

Intet i matematik. Matematik `main` @ `89abfd2` (413 merget) er kun læst via
`git archive` til en kopi i scratchpad (med en junction til matematiks
`node_modules`); `spil.html` er den committede (samme commit som `src/`).

- **Blok 1** (`docs/kritik-416/ELEVEN.md`, `outputs/kritik-416/elev-416.mjs`,
  `elev-416.json`, 30 skærmbilleder `E-*.png`): en ny figur spiller uden at få
  noget at vide: Møllens forløb 1-3, "!" hver gang, Mel til bageren, Brød til
  alle, Ænderne i åen, genindlæsning. Eleven svarer rigtigt via et facit-orakel
  (spillets egne generatorer i node, saltet låst i testbrowseren).
- **Blok 2** (`docs/kritik-416/QUESTENE.md`, `questene-416.mjs`,
  `questene-416.json`, `browser-416.mjs`, `browser-416.json`, `Q-*.png`): alle
  14 quests over 300 salte (skabeloner, tekst mod grund), svarmuligheder og
  forsøg, trin ved åbning, belønningernes størrelse på 390 px med alle 14
  klaret, og en gætte-elev på 150 opgaver.
- **Blok 3** (`docs/kritik-416/KRITIK-questbog.md`,
  `outputs/kritik-416/verify-kritik-416.mjs`, `package.json`, denne rapport).

## Testresultat

- `npm run verify:kritik-416`: **grøn** (Q2 regnet efter uden spillet; Q1, Q3,
  Q4, Q5, Q9 og blok 1-tallene genskabt fra de gemte målinger; KRITIK og
  rapport tjekket). Kører uden matematik-mappen og uden netværk.
- `npm run lint`: **grøn** (kørt med en midlertidig junction til
  `entropi-app/node_modules`, fjernet igen; worktree'en har ingen egen).
- Kørslerne: 0 sidefejl i blok 1 og blok 2.

## Hvad er næste

**Til Ganita (ordre i punktform, i matematik på egen gren, ingen push):**
- Q1: giv generatorerne en `kulisse`/`emne`-parameter (som `KIRKE_KULISSE` i
  måletrappen) og lad hver quest vælge sin: brøktrappens trin 1 med melsække
  og brød (Ane), omkreds/areal med blomsterbedet (Graveren), omregn med
  klokkereb og snore (Klokkeren), pris/kasse med sko (Søren), enhed med stien
  (Hans). Test: for hver quest og 300 salte handler mindst 3 af 4 opgaver om
  grunden (ordlisten i `outputs/kritik-416/questene-416.mjs` kan genbruges).
- Q2: +10 kun ved rigtigt i første forsøg (+5 i andet, 0 i tredje), og
  Æblerne/Kassen kræver Landsbygadens forløb med 3 af 4 rigtige i første
  forsøg. Test: en gætter, der prøver knapperne oppefra, får ingen belønning på
  150 opgaver.
- Q3: når et forløb åbner en quest, én linje i klaret-feltet ("Ane,
  bagerkonen, står med et ! ved møllen") og knappen "Hjælp Ane".
- Q4: belønningerne på kortet 1,5-2 gange større med et lille mærke for "din";
  huen daler ned på takkekortets figur; alle titler i "Det du har fået".
- Q5: "Et nyt bed" kræver Grusgravens forløb 4, eller bruger `maal1`/`maal2`.
- Q6: figuren går ad stien, når "Stien over bakken" er klaret.
- Q7: takkekortet siger, hvad der skal til, når intet nyt åbnede (`mangler()`).
- Q8: vis kun låste quests hos folk, eleven kan se; skriv låsen som personens
  replik.
- Kør `node outputs/kritik-416/elev-416.mjs <matematik>` og
  `browser-416.mjs`/`questene-416.mjs` (fra entropi-app) igen efter
  rettelsen; `verify:kritik-416` bliver rød, når Q1-Q5 er rettet, og skal så
  opdateres.

**For Marc:** spillet kan godt bruges nu; sig til eleverne, at "!" på kortet
er folk, der har brug for hjælp. Sporvognens to quests er dem, der føles
rigtigst.

## Ærlige grænser

- **Eleven er min model, ikke et barn.** Hun kan regne, trykker på den største
  nye knap, og trykker kun på "!" inden for skærmen. Tiderne er elevtid efter
  en model (20 s pr. opgave, 2,5 ord/s), ikke målt på en 10-årig. Om 24 px "!"
  vinder over "Byen vågner", ved jeg ikke.
- **Saltet er låst i testbrowseren** (Date.now og Math.random fastsat i en
  init-script), så oraklet kunne kende facit. Det ændrer kun hvilke tal, der
  trækkes. Gætte-eleven kører med frit salt (7-10 af 38 rigtige i første forsøg
  i to kørsler; resultatet var det samme).
- **Ordlisten i blok 2 er grov.** Dommene i tabellen er mine, efter at have læst
  skabelonerne; tallene er ordlistens (fx tæller "bager" med i Mel til bageren,
  selv om grunden er mel).
- Gætte-eleven stopper, når Landsbygaden er færdig (hun går ikke tilbage til
  Møllen); 38 opgaver, ikke 150.
- Kun headless Chromium på 390 px. Ingen skole-pc, ingen rigtig telefon.
- Et uheld undervejs: en midlertidig liste over skabelonerne blev skrevet til
  Skrivebordet (`ignored-skab.txt`) i stedet for scratchpad. Den blev slettet
  med det samme og indeholdt kun genererede opgavetekster, ingen data.
- CLAUDE.local.md i denne worktree siger "Du er Vaidya"; ordren er til
  Bhishak, og Marc bad mig udføre den. Jeg har arbejdet som Bhishak efter
  ordrens grænser.
- Ingen elevdata. Figurens navn "Ravn" er et fantasinavn.
