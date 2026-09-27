Mål dit billede klar til sitet: ja
foer og efter klar til sitet: ja

B13 er lukket: med Min krop er siden 360, 375 og 390 px i alle seks faser, også med "Stang −10,7 cm" og "Stang −8,5 cm". E7, E8 og E3-resten er lukket. Krydset "Et af de fjerne nav er skønnet" tager de falske forskelle fra 41 % til 16 % (stangen fra 33 % til 1 %), og faktoren 2 er ikke for streng: den er præcis det, der skal til, når coachen klikker samme sted på kanten tre gange. Ét nyt, lavt fund (E9): med krydset siger sætningen stadig "Stangen samme sted", selv om grænsen nu er 6 cm. Det stopper ikke sitet.

# Kritik 530, blok 1: Mål dit billede og før/efter efter Yantras 522 (B13, E7, E8, E3-rest)

Bhishak, 27. sep 2026. Ordre 530 fra Dhruva via Marc. Planet coaching, spor kropsmodel-til-teknikfeedback.

**Grundlag:** `entropi-loeftmodel-dhruva` main @ `c9950e0` (522 merget), hentet med `git archive` til en midlertidig mappe. `docs/RAPPORT-dag-73.md` og `dist/maal-billede/` er læst. Intet træ er rørt, og intet er merget.

**Målingerne:**
- `outputs/kritik-530/maal-side-530.mjs` → `maal-side-530.json` og `M-*.png`: siden headless uden net på 360, 375 og 390 px med touch og 1280 med mus. **19/19** tjek grønne.
- `outputs/kritik-530/foer-efter-530.mjs` → `foer-efter-530.json`: mine scenarier fra 511 og 521 (samme pinhole, dybder, klikfejl og 507-ændring) mod 522's `foerEfterTabel(…, { navSkoennet })`, `saetningsRaekker` og `faseHoejdeTjek`. 2000 par pr. linje uden ændring, 1000 med ændring.
- **Min krop:** gennemsnitlige proportioner for 183 cm og 120 kg under Min krops egen nøgle, som i 517. Det var det tilfælde, der gav B13.
- **Billeder:** modellens egne stillinger med Min krops længder i alle seks faser (tegnet, SYNTETISK). Marcs to billeder fra 462 med mine klik fra 494; skærmbillederne af dem er kun udsnit af tallinjen. Før og efter: Marcs gulvbillede med og uden Yantras skønnede fjerne nav (514), mod 514's tegnede efter-billede og samme stilling fotograferet 10° skråt. Squatten er modellens sticking point (178 cm) i mine fire kamerapladser fra 521, tegnet.

## B13: tallinjen

| Fund | 517 | Nu (522) | Status |
|---|---|---|---|
| B13 | Tallinjens tal stod uden mellemrum; med Min krop var siden 377-388 px på 360 og 375 i squat og dødløft | Mellemrum mellem tallene. Siden er 360 / 375 / 390 px i alle seks faser med stangens vægt. På 360 og 375 brydes linjen efter "Knæ" (to linjer, højre kant 262-270 px). På 390 er den én linje, højre kant 362-373 px | **lukket** |
| E6 | "Stang −8,5 cm" (10° skråt) gav 395 px på 390 | 360 / 375 / 390 px | **lukket** |

**Siden og tallinjens højre kant med Min krop og 270 kg, i px (side / højre kant):**

| Fase | 360 | 375 | 390 |
|---|---|---|---|
| Squat bund | 360 / 262 | 375 / 262 | 390 / 373 |
| Squat midt | 360 / 262 | 375 / 262 | 390 / 373 |
| Dødløft gulv | 360 / 262 | 375 / 262 | 390 / 362 |
| Dødløft knæ | 360 / 270 | 375 / 270 | 390 / 370 |
| Bænk bryst | 360 / 293 | 375 / 293 | 390 / 293 |
| Bænk midt | 360 / 285 | 375 / 285 | 390 / 285 |

- **Det lange tal:** dødløft ved gulvet med "Stang −10,7 cm" og "Stang 13,7 cm": 360 / 375 / 390 px (`M-360-tallinje-lang.png`).
- **Marcs gulvbillede:** 360 px på 360 (517: 385).
- **B12 holder:** "Knæ 119,6° (stangen 31 cm under knæet)" står i tallinjen på Marcs knæhøjde-billede med samme cm som beskeden, og siden er 360 og 390 px (`M-360-marc-tallinje.png`, `M-390-marc-tallinje.png`).
- `M-360-squat-tallinje-min-krop.png` er samme skærm som i 517: dengang var "Stang −1,0 c" skåret af, og billedet flød ud over skærmen. Nu står "Stang −1,0 cm" på linje to.

## E7: det skønnede fjerne nav

**På siden (360, 375, 390 og 1280):**
- Afkrydsningen står, når begge billeder har det fjerne nav, og ikke uden (517's sag). Den er 44 px høj og ender 337 / 352 / 367 px inde, altså inden for skærmen.
- Et tryk på selve teksten sætter krydset. Stangens grænse går fra 3,0 til 6,0 cm (`M-360-e7-krydset.png`, `M-390-e7-krydset.png`).
- Noten siger "Klik kun et nav, du kan se; er det skjult bag benet, så sæt kryds …" og med krydset, hvorfor grænserne er fordoblet. Siden siger det samme ved punkt 8 og under "Sæt det fjerne nav".
- Intet gemt ud over Min krop, intet net, ingen JS-fejl.

**Min Monte Carlo** (dødløft ved gulvet, par uden ændring; sætningen nævner en forskel i alt / heraf stangens rækker):

| Klik | Runder | Det fjerne nav | Uden kryds | Med kryds (×2) | ×1,5 (regnet) |
|---|---|---|---|---|---|
| omhyggelig | 1 | intet | 16 % / 0 % | — | — |
| omhyggelig | 1 | skarpt (0,5 cm) | 23 % / 12 % | — | — |
| omhyggelig | 1 | skønnet (2,5 cm) | 41 % / 33 % | **16 % / 1 %** | 21 % / 8 % |
| omhyggelig | 3 | skønnet | 27 % / 18 % | 13 % / 1 % | 15 % / 4 % |
| omhyggelig | 3 | skønnet, **samme sted på kanten tre gange** | 51 % / 46 % | **18 % / 9 %** | 29 % / 21 % |
| typisk | 1 | skønnet | 73 % / 55 % | 50 % / 6 % | 57 % / 23 % |
| typisk | 3 | skønnet, samme sted | 58 % / 47 % | 31 % / 8 % | 40 % / 21 % |

- Mine tal uden kryds er som i 521 (42 % / 34 %). Med krydset er det 16 % / 1 %, på niveau med "intet nav" (16 %). Yantras 11 % / 1 % er lavere, fordi hans regning ikke har perspektiv.
- Min egen regning af rækkerne med faktor 1 og 2 giver de samme rækker som 522's kode i 100 % af parrene.

**Yantras spørgsmål: er faktoren 2 for streng?** Nej.
- Med én runde ville 1,5 være nok: stangen 8 %, under et skarpt nav (12 %).
- Men det farlige tilfælde er det, Yantra selv nævner: coachen klikker samme sted på kanten tre gange. Så ser siden ingen spredning, og grænsen bliver lille. Med 1,5 er stangen med i 21 % af parrene uden ændring; med 2 er det 9 %, som et skarpt nav med tre runder (10 %). Faktoren 2 er altså præcis det, der skal til.
- **Prisen:** med et skønnet nav og krydset kan siden ikke se en lille stangændring. En ren stangændring (kroppen står stille) bliver fundet i stangens rækker:

| Stangen flyttet | 1 runde, kryds | 3 runder, kryds | 3 runder, skarpt nav uden kryds |
|---|---|---|---|
| 2 cm | 6 % | 7 % | 77 % |
| 3 cm | 13 % | 19 % | 98 % |
| 5 cm | 40 % | 67 % | 100 % |

Det er ærligt: et nav, man ikke kan se, kan ikke måle 3 cm. Svaret er Yantras regel, ikke en mindre faktor: klik kun et nav, du kan se.

## E8: sætningen læser mange rækker

- Noten under tabellen siger "Sætningen læser 8 rækker, så to billeder af samme stilling giver alligevel en forskel i sætningen i ca. hvert fjerde par med omhyggelige klik (oftere med hurtige)" (dødløft med nav) og "5 rækker … ca. hvert sjette" (uden nav). Samme på 360, 375 og 390.
- Min Monte Carlo: 16 % uden nav (hvert sjette) og 23 % med skarpt nav (hvert fjerde). Teksten passer. Med typiske klik er det 50 % og 65 %; "oftere med hurtige" er vagt, men ikke forkert.
- Med krydset siger noten stadig "ca. hvert fjerde", mens det reelt er ca. hvert sjette (16 %). Det advarer lidt for meget, ikke for lidt.
- **Status: lukket.**

## E3-resten: squattens højde uden nav er et hint

| Kamera | Uden nav | Med nav |
|---|---|---|
| 3 m, 80 cm, vinkelret | +2,9 cm, ok (hint) | −0,8 cm, ok |
| 30 cm højere, vippet ned | −5,8 cm, "lavere" **som hint** | −2,3 cm, ok |
| 60 cm (lavt) | +7,4 cm, "højere" **som hint** | −0,8 cm, ok |
| 10° skråt | +4,1 cm, ok (hint) | +0,5 cm, ok |

- Samme tal som 521, nu med den rigtige dom. Siden siger på 360 og 390: "Billedets stang ser 6 cm lavere ud … måske fra et andet sted i opturen … Uden det fjerne nav er "lavere" kun et hint, ikke en dom … Står stangen også lavere med navet, så vælg et billede lidt senere i løftet." (`M-390-squat-lav60-uden-nav.png`, `M-390-squat-lav60-nav.png`).
- **Rigtige fasefejl** (billedet fra et andet sted i opturen, vinkelret kamera): stangen 12 cm fra sticking point giver en dom uden hint, med og uden nav. 6 cm over giver "højere" uden hint (+10,2 cm). 6 cm under giver uden nav "ok" (hint, −4,5 cm) og med nav "lavere". Det er grænsen på 8 cm, der virker som den skal: over den er det ikke kameraet.
- **Status: lukket.**

## Nyt fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| E9 | lav | Med krydset siger sætningen stadig "Stangen samme sted (inden for målefejlen)", og den sætning kopierer coachen. Men grænsen er nu 6 cm, og en stang flyttet 3 cm bliver kun fundet i 13-19 % af parrene. At navet er skønnet, står i noten, ikke i sætningen. Krydset huskes også, når fasen skiftes (prøvet; nye billeder ikke prøvet) | Med krydset: "Stangen: ingen forskel over 6 cm (det fjerne nav er skønnet)", eller udelad stangen af sætningen. Ikke en stopper: det advarer ikke for lidt om kroppen, og forbeholdet står i noten |

## Status

| Fund | Status |
|---|---|
| B1-B9, B11, B12 | lukket (508, 517); B12 gentjekket her |
| B10 | åben: venter på Marcs squatklip fra siden |
| B13, E6 | **lukket** |
| E1-E5 | lukket (521) |
| E3-rest, E7, E8 | **lukket** |
| E9 | ny, lav |

## Domme

- **Mål dit billede klar til sitet: ja.** B13 var den sidste stopper. Setu kan kopiere `dist/maal-billede/` fra `c9950e0`.
- **foer og efter klar til sitet: ja.** E7 er lukket med både vejledningen og krydset, og faktoren 2 holder også i det værste tilfælde. E9 er en ordlyd, ikke en stopper.
- **Marc:** klik kun det fjerne nav, hvis du kan se det. Har du skønnet det, så sæt krydset, og send ikke "Stangen samme sted" til atleten fra et sådant par, før E9 er rettet.

## Ærlige grænser

- **Kun headless Chromium på Windows,** ikke Safari på en iPhone og ikke Chrome på en rigtig Android. Tallinjens brud afhænger af skrifttypen; mellemrummet gør ikke. På 390 er der 17 px luft (373 px højre kant), mod 3 px i 517.
- **Klikfejlen er antaget, ikke målt** (som i 511, 514, 521 og 522). Navets 2,5 cm er Yantras skøn på ét billede. "Samme sted på kanten" er min model: navets fejl trukket én gang pr. billede, plus 0,5 cm pr. runde.
- **Pinhole uden linseforvrængning,** dybderne er antagelser og står i JSON. Efter-billederne og squatten er tegnede figurer (SYNTETISK); kun Marcs før-billede er et foto.
- **E9's "huskes"** er kun prøvet ved faseskift, ikke ved et nyt billede.
- Ingen atletdata ud over Marcs eget klip fra 462, intet skrevet til lageret ud over Min krop, ingen JS-fejl og intet net.
