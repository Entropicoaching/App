skakken stadig klar til eleverne: ja

547 virker, som Chaturanga siger:
- "Mit bibliotek" tæller efter sin egen regel.
- "Dit svageste tema" er det rigtige efter den regel.
- "Gentag i dag" kommer igen præcis efter reglen, dag for dag med et falsk ur, og ratingen står stille imens.
- K12 er lukket.

Tre ting gør procenterne og gentagelsen mindre, end de ser ud (K18-K20, middel). Ingen af dem lærer eleven noget forkert om skak. De får hende til at tro, hun er bedre til et tema, end hun er, eller til ikke at se, at der er noget at gentage.

# Kritik 558, blok 2: skakkens "Mit bibliotek" og "Gentag det svære" (Chaturanga 547)

Bhishak, 28. sep 2026. Ordre 558. Skak `main` @ `6e9b86c` (547 er merget), hentet med `git archive`. Skak-træet er urørt.

**Målingen:** `outputs/kritik-558/bibliotek-558.mjs` → `bibliotek-558.json` (`bibliotek-558.log`) og `B-*.png`. **105/105** tjek er grønne.
- Headless Chromium uden net: 360 og 390 px med touch og 1280 med mus.
- Eleven er den samme som i 517-552 (mat i 1, ellers største slag, ellers skak, ellers tilfældigt) og har ingen navne.

**Dag 0:**
- 8 gåder i "Som de kommer": én med et forkert træk først, én med et hint, én med et forkert træk og "Spring over", fem rene.
- 4 gafler (3 med et forkert træk først) og 3 bindinger.
- "Øv gafler".
- En storm spillet dårligt i 35 s og stoppet.

**Dag 1-13** med et falsk ur (`page.clock.setFixedTime`, siden genindlæst hver dag), dag 1, 2, 3, 4, 5, 11, 12 og 13:
- "Gentag nu" spilles igennem: rent, undtagen hint-gåden dag 1 og gåde nr. 0 dag 4 (med vilje et forkert træk).
- Hver dag holdes siden op mod **min egen model af reglen, som den står i rapporten**, ikke koden.

## Mit bibliotek

**Giver procenterne mening?** Ja, efter regel: forsøg er løste plus opgivne gåder, og rigtigt er løst uden forkert træk.
- For hvert tema med forsøg viser siden præcis min optælling på alle tre bredder, fx Gaffel "43 % rigtige · 7 forsøg", Binding "100 % rigtige · 3 forsøg".
- Før dag 0 står "0 af 16 øvet" og "Løs mindst 3 gåder i et tema, så finder vi dit svageste tema.", som det skal.
- På telefonen er folden ca. 1.100-1.160 px (1,4 skærme) og let at læse (`B-390-1-mit-bibliotek.png`).
- Øv-knapperne er 44 px.

**Er "dit svageste tema" rigtigt?** Ja, efter regel. Det er det, jeg selv regner: lavest procent med mindst 3 forsøg, og ved lige procent flest forsøg.
- Siden viser Gaffel 40 % i 5 forsøg (360), 43 % i 7 (390) og 50 % i 6 (1280), og det er også mit svar hver gang.
- "Øv gafler" giver en gaffel, og "Du øver: Gaffel" står over brættet. Brættet står øverst på skærmen efter trykket (top 0), så K13 fra 552 gælder ikke her.

Men tre ting får tallet til at sige noget andet, end en 12-årig tror:

- **K18 (middel): et hint tæller som rigtigt.** Folden siger "hvor tit du ramte rigtigt første gang". En gåde løst med hint (beskeden siger "Løst med hint") tæller som rigtig i biblioteket.
  - På 390 står Mat i 1 derfor som "100 % rigtige · 3 forsøg", selv om én af de tre kun blev løst med hint.
  - Den samme gåde tæller som en fejl i "Gentag" og i ratingen ("rent = uden forkert træk og uden hint"). Samme gåde får altså to svar.
  - En elev, der altid trykker hint først, får 100 % i alle temaer.
  - **Ret:** rigtigt = løst uden forkert træk **og uden hint**, som i ratingen og i Gentag.
- **K20 (middel): gentagne gåder løfter procenten, og stormen tæller ikke.**
  - Gentagne gåder tæller i temaets procent (Chaturanga skriver det selv). Efter 13 dage med "Gentag nu" står Gaffel på 75-85 % (dag 0: 40-50 %). Det er de samme gåder, eleven allerede har set løsningen på.
  - Stormens fejl tæller slet ikke i biblioteket. På 390 gik 4 af 4 "Mat i 2" galt i stormen, og biblioteket viser "Mat i 2: 100 % rigtige · 15 forsøg", fordi gentagelserne er med og stormen ikke er.
  - Dit svageste tema kan dermed forsvinde ved at gentage det kendte.
  - **Ret:** tæl kun første forsøg på en gåde i procenten (gentagelser vises for sig, fx "3 gentaget"). #17 (de sidste 20 forsøg) løser det ikke alene.
- **K23 (lav):** en gåde med et tema uden for de 12 (min elev fik "mateIn3", "endgameSquare") tæller ingen steder. Det er én af 15 gåder pr. kørsel.

## Gentag i dag

**Kommer fejlene igen efter 1, 3 og 7 dage?** Siden gør præcis, hvad reglen siger:
- På alle tre bredder er antallet hver dag lig min model: dag 1: 17-21, dag 2: 1, dag 3: intet, dag 4: 16-20, dag 5: 2, dag 11: intet, dag 12: 1, dag 13: intet.
- Kortene i browseren er lig min model efter hver dag.
- Ratingen er uændret under hver gentagelse (fx 728 → 728).
- **Beskederne**, fulgt for gåde nr. 0:
  - dag 1 "Rigtigt! Den kommer igen om 3 dage.",
  - dag 4 (et forkert træk) "Den kommer igen i morgen.",
  - dag 5 "Rigtigt! Den kommer igen om 7 dage.",
  - dag 12 "Den sidder nu - rigtigt to gange i træk.".
- **Hint-gåden:** dag 1 med et forkert træk "i morgen", dag 2 "om 3 dage", dag 5 "sidder nu".
- **Åbninger og felter** bruger samme funktioner (`src/gentag.js`, tjekket direkte: i morgen, "dag 0 igen" flytter ikke, om 3 dage, lært, efter en ny fejl om 7 dage). I browseren har jeg kun prøvet gåder.

Svaret på "1, 3 og 7" er altså: **1 og 3 dage; 7 kun efter en ny fejl.**
- **K21 (lav):** en gåde, der løses rigtigt dag 1 og dag 4, er lært efter 4 dage og kommer aldrig igen efter en uge. Det står i Chaturangas regel ("to rigtige i træk"), men "1, 3 og 7 dage" lover mere.
- **Ret:** lært efter tre rigtige i træk (1, 3, 7), eller skriv "1 og 3 dage".

**Ser eleven det?** Ikke på telefonen.
- **K19 (middel):** "Gentag i dag" står under brættet og værktøjerne: 908 px på 360 (skærmen er 780) og 938 px på 390 (844). På første skærm ser eleven brættet og en ny gåde, ikke at der er noget at gentage (`B-390-4-gentag-dag1.png`). På 1280 står det øverst (197 px).
- **Ret:** kortet over brættet på telefonen, eller et tal på fanen "Gåder" ("Gåder · 4").

**Føles "Gentag nu" som en belønning eller lektier?** Beskederne er venlige ("Den sidder nu - rigtigt to gange i træk."), og kortet er væk, når alt er gentaget.
- **K22 (lav):** én dårlig storm på 35 s giver "Gentag i dag: 17-21" næste dag. 11-15 af dem er stormens missede gåder, fordi alle missede i stormen kommer med. For en 12-årig er 20 gåder lektier.
- **Ret:** højst ca. 5 om dagen (resten dagen efter), eller kun stormgåder, eleven åbnede løsningen på.

## K12

**Lukket.** Stormens slutkort har "Ny storm" øverst, lige under overskriften:
- "Ny storm" står 40-63 px under kortets top på alle tre bredder og er på skærmen.
- Listen med de missede gåder står 530-680 px længere nede.
- Kun 5 missede vises med "Vis alle 11/15", og efter trykket vises alle (`B-390-3-storm-slut.png`).

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| K18 | middel | Et hint tæller som "rigtigt" i Mit bibliotek (men som fejl i Gentag og ratingen); Mat i 1 "100 %" med en hint-gåde; altid hint giver 100 % | Rigtigt = uden forkert træk og uden hint |
| K19 | middel | "Gentag i dag" står under brættet og under første skærm på 360 og 390 (908 / 938 px mod 780 / 844) | Over brættet på telefonen, eller et tal på fanen |
| K20 | middel | Gentagne gåder løfter procenten (Gaffel 40-50 % → 75-85 %), stormens fejl tæller ikke (Mat i 2 "100 % · 15 forsøg" efter 4 af 4 galt i stormen) | Kun første forsøg i procenten |
| K21 | lav | "1, 3 og 7 dage": to rigtige i træk er lært efter 4 dage; 7 dage kun efter en ny fejl | Tre i træk, eller "1 og 3 dage" |
| K22 | lav | Én dårlig storm giver 17-21 gåder at gentage næste dag | Højst ca. 5 om dagen |
| K23 | lav | Gåder med et tema uden for de 12 tæller ingen steder i biblioteket | Tæl dem under det nærmeste tema, eller "Andre" |

## Ærlige grænser

- **Min elev** er en simpel regel, ikke et barn. "Føles som lektier" er mit skøn.
- **Det falske ur** sætter `Date` fast pr. dag og genindlæser siden. Midnat midt i en runde er ikke prøvet.
- **Åbninger og felter** i Gentag er kun tjekket i `src/gentag.js`, ikke i browseren. Koordinaternes og kendte partiers procent er ikke prøvet (0 forsøg).
- **Gåderne** er tilfældige fra puljen, så temaerne varierer mellem bredderne. Tjekket er, at siden og min optælling er ens, ikke bestemte tal.
- **Kun headless Chromium på Windows**, ikke en rigtig telefon.
- **Ingen elevdata.**
