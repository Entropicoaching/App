fejlfigurer klar til sitet: nej (F1 og F2 skal rettes først; begge er små rettelser, og ingen af dem kræver ny regning)

# Fejlene i dødløft og bænk, set med en coachs øjne (Yantra 476 og 481)

Grundlag: `entropi-loeftmodel-dhruva` på `main` (`655e4cb`, 476, 481 og 484 merget). Jeg har læst `docs/RAPPORT-dag-63.md`,
`RAPPORT-dag-64.md`, siden `dist/loeft-fejl/index.html` og alle ni SVG'er, `outputs/481/varianter.md` og rækkerne
i `src/minKropFejl.js`. Figurerne står som PNG i `outputs/kritik-483/F-*.png` (modellen, A og B i én række).
Målingerne står i `outputs/kritik-483/figurer-483.json` og er lavet med `figurer-483.mjs`: headless, file:// og intet
netværk. 481 er færdig og merget, så jeg vælger mellem varianterne.

## Svar på Yantras spørgsmål

**1. Hoften stiger først: A.** B må ikke på sitet (F2).

Det, en coach ser, ligner mest B: skinnebenet rejser sig, brystet falder, skuldrene glider frem over stangen, og
ryggen ligger vandret. Men B's tal siger det modsatte af det, vi lærer atleter. Lænden får 11 % mindre (19 % ved
10 cm), og det, der vokser, er skulderen (+150 %). Årsagen er modellens: ryggen er stiv og stangen låst. Med den
torsolængde flytter skulderen, der glider frem, hoften nærmere stangens lodlinje, så lænden aflastes.

Hos en rigtig løfter er prisen for "hoften først" netop, at ryggen runder under last, og at benene holder op med at
hjælpe. Rundingen findes ikke i modellen. At benene holder op med at hjælpe, viser A som "knæ skifter fortegn", og
det er den rigtige lære.

A er det ærlige billede af det, modellen kan: benene giver slip, hoften og lænden får lidt mere (+12 % / +13 %).
B kan blive i modellens egne dokumenter som et eksempel på, hvor den stive ryg slår igennem. På sitet og i Min krop
skal den ikke stå, hverken som figur eller som sætning.

**2. Stangen glider frem: A**, plus én sætning fra B, ikke B's figur (F3).

A's lære er rigtig og er den, coachen bruger: stangen væk fra benene giver længere arm til hofte og lænd, og
tyngdepunktet går frem mod forfoden. B viser skulderen 5,1 cm *bag* stangen ved knæhøjde med armen skrå frem. Det
ser en coach næsten aldrig midt i et træk, der glider frem; dér trækkes skuldrene frem, ikke tilbage. En atlet kan
læse B som "læn dig tilbage, så er balancen fin".

Retningen i B støtter til gengæld læren, så én sætning kan tages med: "Flytter løfteren sig bagud for balancen,
får hoften og lænden endnu mere at holde i modellen (halvvejs: +24 % / +57 %)." Min krops `FEJL` skal altså ikke
skiftes; den bruger allerede A.

**3. Albuen helt ude:** 90° er for meget til hovedfiguren. Brug 80° (F4). Forbeholdene om skulderen siger nok, men
de står det forkerte sted (F1).

- **Vinklen:** 90° ud i brystets plan er en guillotine. Stangen lander 16,2 cm nærmere halsen, ved kravebenet. Den
  løfter, en coach kalder "albuerne helt ude", har typisk 75-85°, og stangen rører lidt højt på brystet. Tabellens
  80°-række (9,8 cm nærmere halsen) ligner det, jeg ser. Retningen og albuens ×4,5 er de samme.
- **Forbeholdene:** teksten om skulderen er god og præcis. Men "skulder −44 %" står i selve figuren og i "Falder"
  lige under den. Forbeholdet står 3995 px længere nede på 390 og 2136 px på 1280, og SVG'erne kopieres til sitet,
  som de er, uden siden omkring (F1). En atlet vil læse −44 % som "skånsomt for skulderen".
- **Min krops fane:** ja, grader og cm uden momenter er nok og det rigtige niveau for en atlet. De fem rækker er
  rigtige for squat og dødløft. For bænken skal "Afstand stang–skulder" ud (samme fejllæsning som F1) og erstattes
  af underarmens hældning. Den er dét, coachen ser i begge bænkfejl: underarmen er ikke lodret, set forfra eller
  fra siden (F9).

## Fund

| | Hvor | Fund | Alvor | Ret sådan |
|---|---|---|---|---|
| F1 | `bp-albue-ud.svg`, `bp-hoejt-bryst.svg`, sidens "Falder"-linjer | Den klassiske skulderfejl vises med "skulder −44 %" (og −41 %) i selve figuren uden forbehold. Forbeholdet står 3995 px længere nede på 390, og SVG'erne kopieres alene til sitet. | høj | Fjern skulderens procent fra bænkfigurerne og fra "Falder". Skriv ved figuren: "Skulderen: modellen kan ikke se skulderleddets stilling, så den siger intet om skulderen her." |
| F2 | B1 "skulderen glider frem" (figur, sætning, tabel) | For den fejl, coaches mest forbinder med lænden, siger figuren "lænd −11 %" og "hoften og lænden får ikke mere at holde". Det er modellens stive ryg, ikke løfteren. | høj | Ikke på sitet og ikke i Min krop. Vælg A. |
| F3 | B2 "kroppen flytter bagud" (figur) | Skulderen 5 cm bag stangen ved knæhøjde er ikke det, en coach ser, når stangen glider frem, og kan læses som "læn dig tilbage". | middel | Vælg A. B2 kun som én sætning (se svar 2). |
| F4 | "Albuen helt ude" | 90° i brystets plan lander stangen ved kravebenet, og albuen står langt uden for hånden. Coachen ville kalde det to fejl (albue ud og for smalt greb). ×4,5 kommer mest af underarmens hældning forfra. | middel | Hovedfigur med 80° ud. Skriv ved figuren, at grebet er holdt fast, og at en løfter ofte flytter grebet med albuen. |
| F5 | "Stangen glider frem", A | "Falder: skulder −54 %" læses af en atlet som en fordel. Det er armens tag om stangen, det, der skulle holde stangen ind, og som slipper. | middel | Omdøb til "armen, der holder stangen ind mod benene: −54 %", eller lad den ud for atleter. |
| F6 | `dist/loeft-fejl/index.html` | Interne navne og ordrenumre på en offentlig side: "(Bhishak 457: 10-15 %)", "Variant A, som i 476", "(ny i 481)". | lav | Fjern før sitet. Med F2/F3 forsvinder A/B-mærkerne af sig selv. |
| F7 | Setus sætning 2 (Rapport dag 63) | "fra hælen frem mod tæerne" overdriver. Tyngdepunktet går fra 2,5 cm bag til 2,0 cm foran midtfoden, ikke fra hælen. | lav | "fra lidt bag midtfoden til lidt foran den, mod forfoden". |
| F8 | "Vokser"-listerne | "knæ +132 % (vægten vil strække knæet, mere end før)" står sammen med hofte og lænd under "Vokser". En atlet læser det som "mere for knæet". | lav | For atleter: skriv knæet i ord ("vægten vil strække knæet mere") uden procent. |
| F9 | Min krop, rækkerne for bænk | "Afstand stang–skulder" er samme fejllæsning som F1, i cm. | lav | Erstat med underarmens hældning (forfra og fra siden). |
| F10 | Siden på 390 | 14.947 px lang (476: 11.075) efter varianterne. | lav | Går af sig selv med F2/F3. |

## Holdninger, der ikke bør stå i Marcs navn

- **"Så får hoften omtrent det samme og lænden ca. 11 % mindre at holde end i modellen"** (B1). Stillet op som en
  coachs side om fejl siger den, at en af de mest belastende fejl i dødløftet aflaster lænden. Det er modellens
  grænse, ikke en holdning, nogen coach har (F2).
- **"Skulderens falder ca. 44 %, fordi stangen står nærmere over leddet"** (bænk). Sætningen er sand i modellen,
  men under Marcs navn læses den som en anbefaling: albuerne ud skåner skulderen. Coaches mener det modsatte, af
  grunde modellen ikke kan se (F1).
- **At kalde et højt berøringspunkt for en fejl i sig selv.** Ved 15 cm (op mod kravebenet) er det en fejl. Ved 10 cm
  kan det være stil (smalt greb, albuerne inde, stor bue). Tabellens 10 cm-række bør ikke stå under overskriften
  "fejl" uden den linje. Lav alvor. Siden bruger 15 cm som figur, og det er i orden.
- Resten er modellens tal med modellens forbehold og ikke holdninger. Det gælder også den gode indledning ("ikke
  hvad en løfter skal gøre"). Min krops fane er holdningsfri.

## Hvad der er i orden

- A1 og A2 lærer det rigtige og i coachens sprog: benene giver slip, stangen væk fra benene giver længere arme.
- Forbeholdene er præcise og ærlige (stiv ryg, ingen muskler, statisk, størrelsen er valgt).
- Ingen vandret rulning på 390 og 1280, ti billeder, og ingen netværkskald (`figurer-483.json`).
- Min krop viser kun grader og cm, og siger det.

Ingen atletdata er brugt. Kroppen er modellens (Marcs egne mål, som resten af modellen bruger).
