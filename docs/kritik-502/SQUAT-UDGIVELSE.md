klar til udgivelse: nej (fund U1-U16; U1-U4 stopper, alle fire er små rettelser)

# Squat-artiklen med Min krop, set som fremmed læser og som Marcs korrekturlæser

Bhishak, ordre 502, blok 1. Grenen er `udgivelse-squat-min-krop` på `2087136` i `entropi-coaching-site-wt2`.
Den er hentet med `git archive` til en midlertidig mappe, og intet træ er rørt. Siderne er serveret på
127.0.0.1 og kørt headless i Chromium på 390 px (touch, mobil) og 1280 px. Alt uden for huset er blokeret og
talt. Målt: `artikel-squat.html`, `assets/min-krop/index.html`, `kort.html`, `mit-kort.html` og `artikler.html`.

Scripts: `outputs/kritik-502/side-502.mjs` (hele siden) og `detalje-502.mjs` (nærbilleder).
Data: `squat.json` og `squat-detaljer.json`. Billeder: `squat-*-390/1280-top.png` og `squat-d1..d4-*.png`.

## Det, der holder

- **Teknik:** 0 JS-fejl, 0 konsolfejl, 0 manglende filer og 0 billeder, der ikke loader, på alle fem sider
  i begge bredder. Der er ingen vandret rulning (scrollWidth = clientWidth). Artiklen er 50.979 px høj på 390
  og 39.401 px på 1280. De to indlejrede værktøjer i kapitel 4 er 350 px brede på 390.
- **Netkald:** Min krop laver 0 kald ud af huset. Artiklen henter kun sitets skrifter fra Google Fonts, som
  resten af sitet gør.
- **Links:** alle interne links peger på filer, der findes på grenen. Min krops links i iframen åbner i en
  ny fane (`target="_blank"`), så læseren ikke fanges inde i rammen.
- **Tankestreger:** 0 i artiklens synlige tekst. Min krops tabel har 8 en-dash i "stang–hofte" og lignende.
  Det er forbindelsesstreger og ikke tankestreger, og de kan kun rettes i løftmodellen (Setu 500).
- **Atletnavne:** 0 i den synlige tekst på alle fem sider. Tjekket mod fornavnene i appens `.gitignore`, som
  ikke er skrevet ud her.
- **noindex:** artiklen er uden noindex, står i `sitemap.xml` og er på `artikler.html`, og det er rigtigt.
  `assets/min-krop/` er udelukket i `robots.txt` uden meta-noindex, som Setu valgte i 500.
- **Ingen call to action i artiklen:** der er ingen "Ansøg om coaching" og ingen bjælke. Slutningen er
  forfatterkortet og "Flere artikler". Den eneste opfordring er linket i U2.
- **Forbehold nederst:** afsnittet "Forbehold" står før referencerne.
- **Private filer:** grenen tilføjer 0 filer i `outputs/`, `scripts/` og `docs/` og ingen CLAUDE-filer. Se
  U11 for det, der allerede ligger på main.
- **Holdningerne er Marcs:** indledningen om idealisering, lowbar-tendensen og goblet squat kommer fra
  Marcs egen commit `39289bd` ("Marcs vinkel fra SVAR-squat.md"). De er ikke skrevet for ham.
- **Delingsbilledet** er 1200x630, som `og:image:width/height` siger.

## Fund

| # | Vægt | Hvor | Fund | Hvem |
|---|------|------|------|------|
| U1 | stopper | kap. 4, linjen under tre-løft-figuren | Der står **"[MARC]"** synligt foran linket "Skriv dine egne mål ind". Den ligger uden for `<span class="marc">`, så `skjul-marc` skjuler den ikke. Den er kommet ind med Setus 477 (`ed5fdb9`). Se `squat-d1-390.png`. | Setu sletter "[MARC] " |
| U2 | stopper | samme linje | Sætningen "Skriv dine egne mål ind og se dine tre løft ..." er Yantras ord og en opfordring i bydeform. Det er tæt på reglen om ingen call to action, og [MARC] markerede, at Marc skulle tage stilling. Et forslag i hans tone: "Med dine egne mål viser [Min krop](...) de tre løft ved siden af gennemsnittet for samme højde." | Marc vælger, Setu skriver |
| U3 | stopper, fagligt | kap. 3, indledningen og tabellen "Bund" | Teksten siger: "Sædemuskel, baglår og adduktor har et krav i modellen halvvejs nede og ved sticking point, **men ikke i bunden**." Tabellen skriver "uden for modellens område, **intet krav**" om de tre i bunden. En coach læser, at hoftestrækkerne ikke arbejder i bunden, men det er der, hoftemomentet er størst (435 Nm i kapitel 7's tabel). Afsnittet "Bund" længere nede siger det rigtigt: hoften er bøjet 143° og er over modellens grænse på 120°, så de tre er ikke regnet. Indledningen og tabellen skal sige det samme, fx "ikke regnet i bunden, hvor hoften er bøjet mere, end modellen kan regne på", og i tabellen "ikke regnet (uden for modellens område)". Tabellens tekst står i `artikel-squat.html` og i `assets/squat-anatomi.js`. | Setu, efter Yantras ord |
| U4 | stopper | kildekoden | Fire [MARC: ...]-spørgsmål står stadig i HTML'en i `<span class="marc">` og er skjult med CSS: opstillingen, nedturen, "kun knæene" og "hoften tilbage". Enhver, der ser kilden, kan læse Marcs interne spørgsmål til sig selv. Det samme gælder læsetilstande og værktøjer, der ignorerer CSS. CSS-kommentaren siger det selv: "spørgsmål til Marc, der skal besvares før udgivelse". På udgivelsesgrenen skal de fire spans ud. De kan blive på kladden. | Setu |
| U5 | Marc | kap. 6, figurens forklaring og tabellen | Artiklen er skrevet i første person ("min egen praksis", "jeg ser"). I kapitel 6 står der i tredje person: "Blå: **Marcs** målte skelet fra videoen" og "**Marcs** eget klip, 270 kg". Samme sted står hans egne mål, "183 cm, 120 kg". Teksterne kommer fra Yantras bundt `assets/maalt-over-model.js`, som også har reserveteksten "SYNTETISK, indtil Marcs video kommer". Marc bestemmer, om det skal være "mit", og om kropsvægten skal stå offentligt. | Marc, derefter Yantra |
| U6 | Marc | kap. 6, første linje | "Squat-udgaven kommer, når der er film; her er dødløftet som eksempel på metoden." Det er et løfte og en meta-kommentar, og kapitlet er et dødløft i en squat-artikel. Der er to veje: kapitlet ud af denne udgivelse, til squat-filmen findes, eller første linje omskrevet uden løftet, fx "Metoden vises her på et dødløft." | Marc |
| U7 | bør | `<title>` og description | Titlen er 88 tegn og beskrivelsen 209. Søgeresultater viser ca. 60 og ca. 155, og de andre artikler ligger på 59-84 og 120-143. Forslag: "Squattens biomekanik: fra opstilling til lockout \| Entropi Coaching" (67) og en beskrivelse på ca. 150 tegn. | Setu, Marc godkender |
| U8 | bør | JSON-LD og sitemap | `datePublished`, `dateModified` og sitemaps `lastmod` står fast på 2026-09-27. Hvis artiklen udgives en anden dag, skal datoen være udgivelsesdagen. | Setu ved merge |
| U9 | bør | navigationen | "< Artikler" øverst i artiklen går til `viden.html#artikler`. Den sektion har ikke squat-kortet, som kun ligger på `artikler.html`. En læser, der går tilbage, finder ikke artiklen igen. Løsningen er et kort på `viden.html` eller at lade linket pege på `artikler.html`. | Setu |
| U10 | Marc | kildekoden, ikke synligt | HTML- og CSS-kommentarer har ordrenumre og agentnavne, fx "Ordre 297", "Yantras indlejring" og "Drishtis indlejring" (30+ steder). JS-bundterne (`min-krop.js`, `tre-loeft.js`) har "Marcs mål", hans højde, "Ordre 195" og "ORDRE-Yantra.md" (kendt fra 473 og 496). Intet af det er synligt, men alt kan læses i kilden. HTML og CSS kan Setu rense. Bundterne kræver Yantras byggetrin fra 496. | Marc afgør, Setu og Yantra |
| U11 | Marc, ikke grenen | main og live | Grenen tilføjer ingenting her, men main har allerede `outputs/` (7 interne rapporter og memoer, 8 skærmbilleder) og `scripts/` (2 filer). De serveres live i dag: `entropicoaching.dk/outputs/RAPPORT-174.md`, `/outputs/FORSLAG-TIL-MARC.md` og `/scripts/maal.mjs` gav HTTP 200. Memoet til Marc nævner et billednavn med en atlets fornavn. Det billede står allerede offentligt på resultatsiden, men memoet er internt. Filerne bør fjernes fra main i en særskilt commit. | Marc siger ja, Setu fjerner |
| U12 | lille, fagligt | kap. 1-5, kap. 7 og Min krop | Der er tre forskellige referencekroppe med hver sine tal for "samme" bund. Kapitel 1-5 har stangen 20,5/21,4 cm fra hofte/knæ. Kapitel 7's to første fejl har 21,7/23,0 cm og knæ 497 Nm mod 345 Nm senere. Min krops "gennemsnit" (178 cm) har 21,3/22,2 cm. Kapitel 7 siger "anden referencekrop", men ikke hvilken. En læser, der sammenligner med Min krop, ser andre tal for gennemsnittet. En sætning om hver krops højde og vægt vil løse det. | Yantra giver tallene, Setu skriver |
| U13 | Marc, stil | hele teksten | Der står forbehold inde i teksten, ikke kun nederst: "ikke et litteraturtal" 7 gange, "ikke en måling" 3 gange, "ikke målte atleter" 2 gange, "en antagelse", "ikke et litteraturfund" og "ikke en opgjort andel". De gør teksten præcis, men tung. Marcs regel siger forbehold nederst. Marc bestemmer, hvor mange der skal blive. | Marc |
| U14 | lille | citaterne | "(Larsen m.fl., 2021; van den Tillaar m.fl., 2020)" i kapitel 5 kan ikke skelnes, fordi der er to Larsen m.fl. 2021 i listen. Brug 2021a/2021b. Otte referencer om momentarme (Krevolin, Tsaopoulos, Németh, Dostal, McGill ×2, Bogduk, Tveit, Rugg) citeres ingen steder i teksten. De hører til modellen og kan stå under en overskrift som "Modellens kilder". | Setu |
| U15 | lille | kap. 1, sticking point | Hovedteksten siger "Hos 25 løftere ved en konkurrence var den lodrette stanghastighed 0,09 m/s". I folden er de 25 konkurrenceløftere Hales 2009 (lår og torso), og hastigheden er 0,11 m/s hos 25 fritidstrænede (Larsen 2021). Jeg kan ikke finde 0,09 m/s i folden. Kilden skal tjekkes, eller tallet skal tilskrives rigtigt. Samme kapitel bruger ordet "opslaget" ("som resten af opslaget bruger"), som er arbejdssprog. | Yantra tjekker tallet, Setu retter |
| U16 | lille | kap. 3's tabel på 390 | Tabellen står med 10,6 px skrift på 390 (`squat-detaljer.json`). Den kan læses, men er lille. | Setu, hvis Marc vil |

**Indledningen** ("På nettet og på Instagram bliver én bestemt squat-teknik ofte gjort til den rigtige.")
er ikke dramatisk i Marcs forstand. Den er rolig, det er hans egen vinkel, og der er intet udråb og ingen
anekdote. Jeg tæller den ikke som fund.

## Hvad der skal til for et ja

U1, U3 og U4 er tre små tekstrettelser, som Setu kan lave på én commit. U2 kræver, at Marc vælger én
sætning. Når de fire er lukket, er artiklen efter min vurdering klar til udgivelse. U5, U6, U10, U11 og U13
er Marcs valg og stopper ikke, men de bør være truffet, før artiklen går live. U7-U9 og U12-U16 kan følge med
i samme commit eller komme bagefter.
