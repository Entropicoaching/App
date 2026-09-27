fejlgenkendelsen klar til sitet: nej

Yantras 541 har lukket det, jeg sagde nej til i 536. L1 er væk: modellens egen bane over gulvet giver højst 1,3 % "hoften stiger først" fra ti kamerapladser, mod 13-45 % før. L2 er væk: der står altid en linje, og den siger hvorfor. L4 og L5 er også lukket. Men to nye ting kan stadig lære en atlet noget forkert, og begge rettes med tekst:
- **L6 (middel):** linjen "Ligner ingen af modellens fejlfigurer over målefejlen." læses som "løftet er uden fejl". Den står under modellens egen fejlfigur i 28 % af billederne af "kun knæene" ved sticking point, og i 99 % i sko med hæl, når feltet er udfyldt, som siden beder om.
- **L9 (middel):** feltet "Sko med hæle" hviler på et modelvalg, der ikke er målt. Holder løfteren i sko torsoen i stedet for ankelbøjningen, giver feltet på 2 cm "Ligner: hoften skudt for langt tilbage" i 53 % af billederne af modellens egen, rigtige bund (3 cm: 93 %).

Når linjen er skrevet om (L6), og feltets tekst siger, at hælens virkning er et valg (L9), er mit svar ja.

# Kritik 548, blok 1: fejlgenkendelsen efter Yantras 537 og 541

Bhishak, 27. sep 2026. Ordre 548 fra Dhruva via Marc. Planet coaching, spor kropsmodel-til-teknikfeedback.

**Grundlag:** `entropi-loeftmodel-dhruva` main @ `ca860bf` (537 og 541 er merget), hentet med `git archive`. Jeg har læst `docs/RAPPORT-dag-76.md` og `-77.md`, `src/maalBilledeFejl.js`, `src/kameraVinkel.js`, `src/fejlgenkendelseMaaling.js` og `dist/maal-billede/`. Intet træ er rørt.

**Målingerne:**
- `outputs/kritik-548/fejl-548.mjs` → `fejl-548.json` (`fejl-548.log`): mit 536-script med samme pinhole, dybder og klikfejl. Nyt: to pladser til (20° skråt og 10° til den anden side), svaret på hvad linjen siger, sko med hæl, tæer ud på to måder, sidens skøn af kameraets vinkel og modelvalget i sko omvendt. 60 billeder pr. stilling, krop og kamera, fem kroppe.
- `outputs/kritik-548/side-548.mjs` → `side-548.json` og `S-*.png`: siden headless uden net på 360 og 390 med touch og 1280 med mus. **16/16** tjek grønne. Tjekkene er skrevet, så de beskriver det, siden gør, også fundene.
- **Kun syntetiske figurer** (tegnede, mærket SYNTETISK) og Marcs eget gulvbillede fra 462.

## L1-L5 fra 536

| Fund | Nu | Målt |
|---|---|---|
| L1 | **lukket** | Modellens bane 0-20 cm over gulvet, ti pladser: "hoften stiger først" højst 1,3 % (typiske klik 4,7 %). Uden det fjerne nav: aldrig tjekket. Siden ved 16,5 cm: "Billedet kan ikke tjekkes for fejl: stangen står for højt til, at billedet er fra gulvet." (`S-390-l1-for-hoejt.png`) |
| L2 | **lukket** | Knæene 30° ud: "Billedet kan ikke tjekkes for fejl: hoften står for højt til, at billedet er fra bunden (tæerne ud kan også give det)." (`S-390-l2-linje.png`). Men se L6 |
| L3 | **delvis** | Feltet "Sko med hæle" virker: high bar med 2 cm hæl og feltet på 2 giver 0 % "kun knæene" (feltet på 0: 50 % i bunden). Sætningen siger stadig "og dér letter hælen i modellen" (10 af 76 sætninger, `S-390-l3-hael-0.png`) |
| L4 | **lukket** | Uden Min krop: "med gennemsnittet for din højde" (25 sætninger), med Min krop "med samme krop" (25) |
| L5 | **lukket** | Grænsen og vejledningen nævner telefonen i hånden |

Yantras tal holder med mit kamera: falsk alarm er højst 3,4 % for alle syv regler og alle ti pladser (telefonen i hånden, "kun knæene" ved sticking point), ellers højst 2 %. Ved 20° skråt stopper alle regler, fordi navene står over 30 cm fra hinanden, og det er rigtigt.

## L6: "Ligner ingen" læses som "uden fejl" (middel)

Ordren spørger, om linjen kan læses som "løftet er uden fejl". Ja. Den er sand ord for ord, men den siger "ingen af modellens fejlfigurer", og coachen læser "ingen fejl". Her er, hvor ofte **modellens egen fejlfigur** får netop den linje (omhyggelige / typiske klik):

| Regel | Vinkelret | Telefonen i hånden | 10° skråt | 10° til den anden side |
|---|---|---|---|---|
| Kun knæene, sticking point | **28 / 35 %** | 15 / 22 % | 28 / 35 % | **42 / 48 %** |
| Hoften tilbage, bunden | 3 / 9 % | **19 / 18 %** | 2 / 9 % | 3 / 7 % |
| Stangen glider frem | 4 / 16 % | 3 / 15 % | **30 / 40 %** | 0 / 4 % |
| Bænk, stangen for højt / albuen | 20 / 18 % | 20 / 22 % | 15 / 13 % | 20 / 18 % |
| Kun knæene, bunden; hoften tilbage, sticking point; hoften stiger først | højst 5 % | | | |

Og tre steder, hvor linjen står næsten altid, selv om figuren har fejlen:
- **Sko med hæl, feltet udfyldt:** "kun knæene" får "Ligner ingen" i 92 % ved 1 cm og 99-100 % ved 2-3 cm, både i bunden og ved sticking point (`S-390-l6-ligner-ingen.png`: fejlfiguren i 2 cm hæl, feltet på 2). Yantra ved det (dag 76), og teksten under feltet siger det. Men linjen nederst siger noget andet.
- **Tæerne 30° ud:** "kun knæene" ved sticking point får "Ligner ingen" i 84-87 % (begge mine modeller). Hintet om tæerne står kun på "kan ikke tjekkes".
- **"Ingen af modellens fejlfigurer"** er mere, end siden tjekker: én eller to regler pr. fase (squattens bund: "kun knæene" og "hoften tilbage"; dødløftet ved gulvet kun "hoften stiger først"), mens modellen har flere fejlbilleder.

**Ret (tekst):** navngiv det, der er tjekket, og sig hvad det ikke udelukker, fx *"Ligner ikke 'kun knæene' eller 'hoften skudt for langt tilbage' over målefejlen. Det udelukker ikke fejlen: 'kun knæene' ved sticking point overses i ca. hvert tredje billede."* I sko med hæl skal "kun knæene" stå som ikke tjekket ("kan næsten ikke ses i sko med hæl"), ikke som "ligner ikke".

## L9: feltet "Sko med hæle" hviler på et umålt valg (middel)

Yantras spørgsmål 2: bruger løftere i sko samme ankelbøjning (modellen), eller holder de torsoen og lader skinnebenet stå? Jeg har målt det omvendte: billedet er modellens egen bund med fladt fodtøj (torsoen holdt), feltet siger hælen.

| Feltet | "Ligner: hoften skudt for langt tilbage", bunden | sticking point |
|---|---|---|
| 1 cm | 3,8 % | 0 % |
| 2 cm | **53 %** | 1,4 % |
| 3 cm | **93 %** | 13 % |

- Uden klikfejl siger siden det ved 2 cm (`S-390-l9-hofte-tilbage.png`): *"Torsoen hælder ca. 9° mere frem og skinnebenet står ca. 6° mere lodret end i modellens bund …; sådan står modellens figur, når hoften skydes for langt tilbage."*
- Det er en **falsk anklage** om en rigtig bund, og siden beder selv coachen om at udfylde feltet. Sandheden ligger nok imellem, og halvvejs (ca. 1 cm fejl) giver under 4 %. Men ingen af os har målt det.
- **Ret (tekst, før sitet):** feltets tekst og grænsen siger, at "samme ankelbøjning" er et valg, og at "hoften tilbage" i sko skal læses med forsigtighed. Bedst: ét rigtigt klip i vægtløftersko.

## Sko med hæl (537)

- Med samme hæl i billedet og feltet er falsk alarm som fladt: højst 1,1 % (omhyggelig), 4,7 % med telefonen i hånden. Yantras tal holder.
- **Feltet på 0 med 2 cm hæl:** mit kamera giver 30 % falsk "kun knæene" i bunden (typiske klik 29 %, telefonen i hånden 78 %), 21 % ved sticking point. Yantra måler 19,5 % fladt, og teksten siger "ca. hvert femte billede". Mit tal er højere, fordi perspektivet lægger lidt til (L8, lav).
- Hælen flytter modellens bund +3,0° skinneben og −4,3° torso pr. cm (178 cm), som Yantra siger.

## Tæerne ud (Yantras spørgsmål 1)

To modeller, knæene op til 40° ud, kameraet vinkelret:
- **T1 (min 536):** knæet drejet ud om linjen hofte-ankel, foden står. Skinnebenet ser ca. 3° **mere fremad** ud ved 20-30°, ikke mere lodret, og knæet er 6° mere åbent.
- **T2:** hele benet drejet om en lodret akse gennem hoften. Skinnebenet 1° mere lodret ved 30° og 3,5° ved 40°, knæet 5° mere åbent.
- **Begge:** ingen falsk "hoften tilbage" (0 %) og højst 1,7 % falsk "kun knæene". Torsoen flytter sig ikke i mine modeller, fordi hofte og skulder står, hvor de står. Jeg kan derfor hverken bekræfte eller afvise Yantras "torsoen mere oprejst". Svaret på hans spørgsmål er: ingen falsk "hoften tilbage", og retningen for skinnebenet afhænger af, hvordan knæet går ud.
- Prisen er L6: bundens vagt stopper modellens egen bund i 86 % (T1) eller 37 % (T2) ved 30°. Siden siger det nu ærligt.

## Det skrå kamera og hintet (Yantras spørgsmål 3 og 4)

- **Skønnet:** den rigtige vinkel 5, 7, 10, 15 og 20° giver 4,4 / 6,2 / 8,9 / 13,6 / 18,6° på 3 m (4 m næsten det samme). Det er ca. 10 % for lidt, fordi mine nav står 70 cm ude og siden regner med 80. Med få skiver står navet ca. 68-72 cm ude, med mange 78-82. 80 passer til tunge løft.
- **L7 (lav): et kamera, der står forskudt uden at dreje, giver hintet.** 50 cm ved siden af på 3 m: "Filmet mere end 5° skråt (ca. 8°: de to nav står 23 cm fra hinanden)" (`S-390-l7-forskudt-hint.png`). Vinklerne flytter sig under 1°. Ved 1 m forskudt står navene 46 cm fra hinanden, og siden stopper alle regler ("kameraet står skråt"). Kameraet er ikke skråt: navene skilles af dybden alene.
- **Hintets tekst** siger "flytter modellens egne vinkler sig mere end 4°". Med mine markører drejer 10° vinklerne under 1° (skinneben +0,5°, torso −0,1°, knæ +0,9°). Yantras 4° ved 4° skråt kommer mest fra hans lige-fra-siden-perspektiv: hans `kameraForskydning` giver torsoen −1,6 til −2,7° allerede ved 0°, fordi hans hofte er leddets midte 0,05·H ude (ca. 9 cm) og skulderen 0,115·H (ca. 20 cm). Et klik lander på huden på den nære side, hvor hoften og skulderen står næsten lige dybt (mine −18 og −20 cm), og så er perspektivet 0,1°.
- **Svar på spørgsmål 4:** siden skal ikke rette for perspektivet lige fra siden. Og hintets "mere end 4°" bør være "flere grader" eller målt med markører på huden.

## Marcs klip

- Gulvbilledet med Yantras og mine klik: "Billedet kan ikke tjekkes for fejl: stangens højde ved gulvet kræver det fjerne nav."
- Med 514's fjerne nav: "stangen står for højt til, at billedet er fra gulvet." Det passer med min læsning i 536 (taget lidt efter, at stangen slap).
- Knæbilledet: "kræver det fjerne nav". Prisen for L1 er, at Marcs eget klip ikke tjekkes. Det er ærligt, og vejledningen siger, at navet ofte er skjult ved gulvet. Det betyder, at "hoften stiger først" sjældent tjekkes i praksis.

## Sætningerne

- 76 sætninger (fem kroppe, syv regler, med og uden Min krop), højst 39 ord.
- Ingen nævner muskel, styrke, skade, fare, "forkert", "bør", "du", "korrekt" eller "fejlfri".
- De kan sendes, undtagen L3's "dér letter hælen".

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| L6 | middel | "Ligner ingen af modellens fejlfigurer over målefejlen." står under modellens egen fejlfigur: "kun knæene" ved sticking point 28-48 %, i sko med hæl og feltet udfyldt 92-100 %, tæerne 30° ud 84-87 %; linjen siger "ingen", men kun 1-2 regler er tjekket | Navngiv reglerne og sig, hvad linjen ikke udelukker; "kun knæene" i sko med hæl som ikke tjekket |
| L9 | middel | Feltet "Sko med hæle" regner med samme ankelbøjning (umålt). Holder løfteren torsoen, giver feltet på 2 cm falsk "hoften skudt for langt tilbage" i 53 % (3 cm: 93 %) | Feltets tekst og grænsen siger, at det er et valg; ét rigtigt klip i vægtløftersko |
| L3 | lav (før middel) | Feltet klarer high bar og hæl, men sætningen siger stadig "og dér letter hælen i modellen" | Flyt det til grænsen |
| L7 | lav | Et kamera forskudt 50 cm uden at dreje giver hintet "ca. 8° skråt", og 1 m stopper alle regler, selv om vinklerne flytter sig under 1°; hintets "mere end 4°" kommer af hoftens dybde i Yantras model | "de to nav står N cm fra hinanden: kameraet står skråt eller ikke ud for stangen"; "flere grader" i stedet for "mere end 4°" |
| L8 | lav | Feltet på 0 med 2 cm hæl: 30 % falsk "kun knæene" med mit kamera, teksten siger "ca. hvert femte" | "hvert tredje til femte" |

## Ærlige grænser

- **Kun syntetiske figurer og Marcs ene gulvbillede.** Intet rigtigt løft med en kendt fejl og intet i vægtløftersko.
- **Mine modeller, ikke målinger:**
  - pinhole uden linseforvrængning,
  - dybderne (markører på huden),
  - klikfejlen fra 511,
  - dødløftets bane som lineær overgang,
  - tæerne ud på to enkle måder uden ny balance,
  - L9's "torsoen holdt" som det modsatte yderpunkt af Yantras valg.
- L9 og L6 i sko er to sider af samme umålte valg. Sandheden ligger formentlig imellem.
- **Kun headless Chromium på Windows**, ikke en rigtig telefon.
- **Ingen atletdata** ud over Marcs eget klip, og skærmbillederne er tegnede figurer.
