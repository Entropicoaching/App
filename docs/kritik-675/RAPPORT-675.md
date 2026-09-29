Figurerne ligner rigtige loeft: nej. Marcs tre punkter rettet: ja (squattens albue under skulderen, doedloeftets knae inden for/uden for armene, baenkens torso uden baand og med synlig bue ved lockout), men baenkens bue ses stadig ikke ved brystet, og squat og sumo ser endnu ikke naturlige ud for en coach.

Ordre 675: figurerne efter Yantras 672 set med en coachs oejne. Bhishak, 29. sep. 2026.

**De tre vigtigste ting Yantra retter naeste gang:**
1. **Baenken ved brystet (Marcs punkt 2, den stilling Marc ser mest).** Ved lockout ses buen nu tydeligt: skulderblade og balde paa baenken, laenden loeftet imellem (`F675-stor-08`). Ved brystet er 672 og 665 ens paa 390 (`F675-390-par3`): overarmen ligger langs baenken, underarmen og albuen staar foran laenden, og torsoen ser ud som en flad, liggende masse. En coach vil se buen i netop den stilling. Forslag: tegn armen gennemsigtig eller bag torsoen ved brystet, eller laeg luften under laenden lysere/stoerre, saa den ses paa 390. Maerkaterne (N3) sidder stadig paa og under baenken.
2. **Squattens arm, hals og low bar-skinneben.** Deltoid-skiven er vaek (669 punkt 2, lukket), og hovedet kigger nu neutralt ned i low bar. Men overarmen ligger stadig naesten vandret hen over hele overryggen med albuen langt bag ryggens linje, og halsen er en lang graa kasse, saa hovedet sidder et godt stykke foran brystet (skildpadde). Knaeet staar langt foran taaspidsen og skinnebenet haelder ca. 40 grader i low bar (Yantra: 40, high bar 43). Yantra forklarer, at det foelger af torsoens 49 grader med kilde; en erfaren coach vil stadig se low bar og high bar som naesten samme squat. Det kraever en beslutning (kilde eller Marc), ikke kun tegning.
3. **Sumo forfra og forfra-figurerne i det hele taget.** Sumo fra siden er renere uden skyggefiguren (669 punkt 3, delvist lukket), men balden stikker stadig langt bagud med hoften kun lidt over knaeet. Forfra er laarene naesten vandrette med hoften i knaehoejde (shiko, ikke sumoloeft), og begge forfra-figurer er stadig pinde og blokke, ikke den anatomiske stil Marc valgte efter 646.

## Gren

`kritik-675`, lavet med `git checkout -b kritik-675 main` i `entropi-app-kritik`.

- `1e6145b` kritik 675 blok 1 commit 1: skaermbilleder og maaling af LAES-MODELLER-3.html
- commit 2: denne rapport. Hashen staar i `git log`.

Filer kun under `docs/kritik-675/` og `outputs/kritik-675/`. Ingen push, ingen merges, ingen sub-agenter, ingen atletdata, kun Yantras syntetiske figurer.

Laest: Yantras `docs/RAPPORT-dag-104.md` fra `entropi-loeftmodel-dhruva` main @ `0517905` (merge af 672) med `git archive`; loeftmodellens trae ikke roert. `C:\Users\Entropi\Desktop\LAES-MODELLER-3.html` (665 og 672 side om side) er kun aabnet. Jeg vurderer 672 (lige numre i billederne).

## Hvad ændret

Intet i loeftmodellen, sitet eller appen. Kun en kritik.

**Maaling** (`outputs/kritik-675/figurer-675.mjs`, headless Google Chrome, file://, net blokeret): paa 390 (touch) og 1280 (mus) tegnes 16 af 16 figurer (8 par), 0 px sidelaens, 0 JS-fejl, 0 netkald. Skaermbilleder: `F675-{390,1280}-par1..8.png`, `F675-side-{390,1280}.png`, `F675-stor-01..16.png` (lige numre er 672).

**Marcs tre punkter:**

- **Squat, "albuerne ... i hovedhoejde": rettet** (siden 665, holdt i 672). Albuen er under skulderhoejde og bag ryggen i low bar og high bar (`F675-stor-02`, `-04`). Tilbage: armen ligger vandret over ryggen (punkt 2 oeverst).
- **Baenk, "torsoen maerkelig, arch unaturligt": rettet ved lockout, ikke ved brystet.** Ved lockout er buen en tydelig, naturlig bue fra skulderblade til balde, og brystet er toppunktet. Skulderleddet er ikke laengere et ekstra hoved. Ved brystet ses ingen forskel fra 665 paa 390.
- **Doedloeft, knae og arme: rettet.** Forfra: konventionel knae inden for armene, sumo uden for (`F675-stor-12`, `-16`). Fra siden er armen lodret fra skulderen til stangen, lys og adskilt fra skinnebenet.

**653, 662 og 669, hvad staar tilbage:**

- 669 punkt 1 (baenkens bue og skulderskiven): skiven lukket, buen lukket ved lockout, ikke ved brystet.
- 669 punkt 2 (squat): hovedet lukket (neutralt/ned i low bar, mere frem i high bar), deltoid-skjoldet lukket, haanden lidt bedre (naeven ses ved stangens ende paa 1280, ikke paa 390), armen ikke lukket, low bar-skinnebenet ikke lukket (Yantras kildebegraensning).
- 669 punkt 3 (sumo): skyggefiguren lukket, balden kun lidt mindre, hoften forfra ikke lukket (Yantras graense, kraever kilde og ny ordre).
- 653 D5 sumo forfra: ikke lukket. N3 baenkens maerkater: ikke lukket. N4 forfra-figurer som blokke: ikke lukket.

**Hvad ellers ser unaturligt ud:**

- Hals: i squat en lang, kantet kasse; hovedet sidder langt frem. I doedloeft ser nakke og hoved rigtige ud.
- Haender: forfra runde prikker; fra siden i doedloeft daekket af skivens nav.
- Foedder: samme lange sko overalt; forfra i sumo peger de rigtigt ud (40 grader).
- Ryggen: neutral i doedloeft og squat, fint. Konventionel fra siden er det bedste billede: ligner en rigtig opstilling.
- Baldens runde klump i squat er stadig det, oejet fanger foerst i low bar.

## Testresultat

- `node outputs/kritik-675/figurer-675.mjs`: exit 0, 16/16 figurer paa 390 og 1280, 0 sidelaens, 0 fejl, 0 net (`maaling-675.json`).
- `node outputs/kritik-675/verify-675.mjs`: groen (begge domme i foerste linje, fem afsnit, 16 par-billeder og 16 store figurer, maalingen 0/0/0 og 16 figurer).
- `npm run lint`: groen.

## Hvad er næste

Yantra retter de tre ting oeverst: baenkens bue synlig ved brystet (og N3), squattens arm og hals, sumo forfra og forfra-figurerne i anatomisk stil. Low bar-skinnebenet og sumoens hoftehoejde kraever en kilde eller Marcs beslutning, ikke kun tegning. 672 er et klart skridt frem fra 665 (skulderskiven vaek, squattens hoved, sumo uden skyggefigur, buen ved lockout). Setu boer vente med sitet til Marc svarer "modeller ok".

Marcs svar kunne vaere: `modeller ret: baenkens bue ses ikke ved brystet, squat-armen og halsen, sumo forfra`.

Hara: planeten coaching, spor kropsmodel-til-teknikfeedback-i-de-tre-loeft. Marcs tre punkter er rettet; doedloeftet fra siden og baenkens lockout er naer "rigtigt". Squat, baenk ved brystet og sumo forfra ligner endnu ikke rigtige loeft for en coach. Ikke klar som teknikfeedback til en atlet.

## Ærlige grænser

Jeg har kun set de 16 figurer paa LAES-MODELLER-3 (bunden i squat, baenk ved bryst og lockout, doedloeftets opstilling fra siden og forfra), ikke andre faser eller sitets `dist/`. Vinkler er Yantras tal eller laest paa billedet, ikke maalt i modellen. "Ligner et rigtigt loeft" er min coach-vurdering af tegningen; Marcs oejne er dommeren. Om low bar-skinnebenet er forkert, afhaenger af kilden for torsoens vinkel, som jeg ikke har tjekket. Arbejdet tog under 30 minutter.
