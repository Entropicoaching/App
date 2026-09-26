Ordre 427

Questbogen efter 417 og 420: er den levende for en 10-årig nu, og føles hvilen som straf? (Bhishak)

## Gren

`kritik-427` fra entropi-app `main` @ a5b3058 (kritik-421 merget). Ingen push, ingen merge.

- blok 1: verify:kritik-427, elev/questene/browser-427, sim-427 og STATUS-427 (commit `e60ffeb`)
- blok 2: Anes kæde med to fejl, KRITIK-questbog-2 og denne rapport (seneste commit på grenen)

Matematik `main` @ 28ba81d (417 og 420 merget) er kun læst via `git archive` til en kopi i scratch med en junction til matematiks `node_modules`. Intet i matematik er rettet.

Ordren gik til Bhishak. Sessionens lokale instruktion hedder Vaidya, men Marc bad mig udføre `ORDRE-Bhishak.md`, og hjemmet `entropi-app-kritik` passer. Jeg har arbejdet som Bhishak og kun i `kritik-427`.

## Hvad ændret

Kun filer under `docs/kritik-427/` og `outputs/kritik-427/`, plus én linje i `package.json` (`verify:kritik-427`, ved siden af de andre verify-scripts; ordren bad om npm-navnet).

- **`verify:kritik-427`** (afløser for `verify:kritik-416` som bevis på main). Den tager blok som argument: `-- 1` eller `-- 2`. Den tjekker, at Q1-Q5 **ikke** kan genskabes:
  - Q1: alle 14 quests har 100 % opgaver om grunden. De fire 0 %-quests er tjekket med 416's uændrede ordliste.
  - Q2: gætteren får 0 belønninger på 150 opgaver.
  - Q3: klaret-feltet siger "Hjælp Ane".
  - Q4: alle ting er mindst 30 px.
  - Q5: der er intet trin-brud.
  - Den tjekker også, at Q6-Q9 har status i `STATUS-427.md`, at 60/80 %-modellen hænger sammen (første quest bliver hvil i 1 - p³ af tilfældene), og i blok 2 Anes kæde og dokumenterne.
  - Modprøve i scratch: 416's fejl lagt tilbage i kopier af målingerne (Æbleboden til gætteren, bedet på 0 %, et trin-brud, ingen "Hjælp Ane") giver ROED med 5 fejl.
- **`elev-427`, `questene-427`, `browser-427`:** mine 416-scripts, kopieret, så 416's bevis står urørt.
  - `elev-427` gemmer også den nye linje under klaret-feltet.
  - `questene-427` har fem ekstra ord i ordlisten (kringle, ællinger, alterlys, markedets boder). Hver skabelon, der ikke passede, er læst. De passede alle.
- **`sim-427.mjs`:** 60 %-, 80 %-, 90 %-eleven og gætteren, 4000 elever hver, 150 opgaver. Den bruger spillets egne regelfunktioner. I blok 2 kom et alternativ til: "2 af 3" for quests med 3 opgaver, kun i modellen.
- **`ane-427.mjs`:** blok 2. Anes kæde fra ny figur til Bagerhuen, med fejl 1 i Møllens forløb 1 og fejl 2 i "Mel til bageren". Hver tekst, hun møder, er gemt med min dom.
- **`docs/kritik-427/STATUS-427.md`:** Q1-Q9 med bevis og modellens tabel.
- **`docs/kritik-427/KRITIK-questbog-2.md`:** dommen, fund N1-N5 øverst og teksterne.

Status (Q1-Q9):

- **Lukket:** Q1, Q2, Q3, Q4, Q5, Q6 og Q8. Q6 er kun set i koden.
- **Delvist:** Q7. "Hvad nu?" efter huen peger på Karen, som hun ikke kan se.
- **Åben:** Q9.

**Dom: levende for en 10-årig: nej, fordi** 10 af 14 quests kræver 3 af 3, så én fejl giver hvil. En 60 %-elev møder hvilen cirka 10 gange på 150 opgaver og får 3 belønninger. En 80 %-elev møder den 8 gange, og halvdelen af 80 %-eleverne får hvil allerede på den allerførste quest. Hvile-teksten ("Tak, fordi du prøvede ... Mestr et forløb mere") nævner hverken hvilket forløb eller hvor. Resten er levende nu.

## Testresultat

- `npm run verify:kritik-427 -- 1`: **grøn** (blok 1).
- `npm run verify:kritik-427 -- 2`: **grøn** (blok 1 + 2).
- `npm run verify:kritik-416`: stadig grøn. Den læser 416's gemte målinger, som er urørt; den siger intet om main nu.
- `npm run lint`: **grøn**, kørt med en midlertidig junction til `entropi-app/node_modules`, som er fjernet igen. Lint dækker kun `*.{js,jsx}`, så mine `.mjs` er ikke med.
- Browser-kørslerne (headless Chromium, 390 x 844, touch):
  - `elev-427`: 30 billeder, 3 quests, 10:54 elevtid.
  - `browser-427`: gætteren og en landsby med alle belønninger.
  - `ane-427`: 16 billeder, 2 fejl, 1 hvil, huen nået, 10:10 elevtid.
  - 0 sidefejl i alle tre.

## Hvad er næste

Svaret er nej. De få fund til Ganita (detaljer i `KRITIK-questbog-2.md`):

1. **N1:** en quest med 3 opgaver skal kræve 2 af 3 i første forsøg, ikke 3 af 3. I min model giver det 60 %-eleven 5,3 belønninger og 3,1 hvil i stedet for 2,8 og 9,9. Prisen: gætteren går fra 0,13 til 0,87 belønninger.
2. **N2:** hvile-teksten skal sige hvilket forløb og hvor ("Klar "Del ligeligt" hos Mølleren lige her under") og ikke begynde med "Tak, fordi du prøvede". Det samme gælder låsen i questbogen.
3. **N3:** hintet til 2/2 i Møllens forløb 1 giver to modstridende grunde. Vis kun den første.
4. **N4:** "Hvad nu?" efter *Brød til alle* skal pege på en person, eleven kan se.

Q9 (stien under stedknapperne) er lille og kan vente. Rør ikke niveauet her; det er 426.

For Hara: arbejdet hører til School-planeten (matematikspillet), ikke Coaching-appen. Det rører ikke delmålet "Appen mærkbart bedre".

## Ærlige grænser

- **Modellen er min.** Eleven er en terning med samme p i alle opgaver, og det er mit valg, at hun tager "!" først og ellers det første åbne sted. 420's model gav 60 %-eleven 4 belønninger; min giver 2,8, fordi min elev bliver ved Møllen. Retningen er den samme i begge: hvilen er hyppig. Alternativet "2 af 3" er kun regnet i modellen og ikke prøvet i spillet.
- **Om hvilen *føles* som straf, kan kun et barn vise.** Min dom bygger på teksten og på, hvor ofte den kommer, ikke på en elev.
- **Anes kæde er én kørsel med fast salt og to fejl, som jeg har placeret.** Andre fejl-pladser giver andre tekster. Fejl 2 i "Mel til bageren" giver altid hvil, fordi questen har 3 opgaver.
- Q6 (figuren går ad stien) er kun set i koden, ikke målt i browseren.
- Gætteren når niveau 11 på 150 opgaver. Det er niveauet, som Ganita laver om i 426, og det er ikke vurderet her.
- Ordlisten i `questene-427` er blevet bredere. De fire quests, som 416 fandt på 0 %, er 100 % også med den gamle liste, så Q1's lukning hviler ikke på de nye ord.
- Kun headless Chromium på 390 px. Ingen skole-pc og ingen rigtig telefon.
- Ingen elevdata. "Ravn" og "Model" er fantasinavne; intet sendes nogen steder.
