Instagram 1-6 klar til Marcs godkendelse: nej (1, 4, 5 og 6: ja; 2 og 3 rettes først)

# Kritik 613, blok 2: de seks Instagram-opslag fra Setus 606 (Bhishak)

## Hvad jeg målte

- **Kilderne:** `ordrer/kilder/setu-606/` (`slides.mjs`, `billedtekst-1..6.txt`, 24 PNG) og `Desktop/LAES-INSTAGRAM.html`. Alt er kun læst.
- **`outputs/kritik-613/insta-613.mjs`:** 11/11 grønne. Jeg har skrevet mine egne regeltjek i stedet for at genbruge Setus `tjek.mjs`.
  - Tjekket leder efter tankestreger, opfordringer, dramatiske åbninger, "Marc", kilo, atletnavnene fra appens `.gitignore`, meta om opslag og engelske fagord.
  - Tallene i opslag 1 og 4 er holdt op mod squat-artiklen (`f3c1684`), og regnestykket i opslag 3 er regnet efter.
  - LAES-INSTAGRAM er åbnet som `file://` i Google Chrome headless på 390 med touch og 1280 med mus, uden net.
  - Alle 24 slides er set i 360 px bredde, som på en telefon (`I-ark-1..4.png`).
- **Opslag 5:** holdt ordret op mod `artikel-hvad-laver-en-coach.html`.

## Tværs af alle seks

- **0 regelbrud i teksten:** 0 tankestreger, 0 opfordringer, 0 dramatiske åbninger, 0 "Marc", 0 kilo og 0 atletnavne.
- **Henvisningen:** alle seks billedtekster slutter neutralt med "... ligger på entropicoaching.dk."
- **Forbeholdet** står i billedtekstens sidste afsnit og på sidste slide i hver karrusel.
- **Ingen genkendelige atleter.** Alle figurer er løftmodellens, og opslag 5 har kun kasser og tekst. Marcs eget dødløftklip er valgt fra.
- **LAES-INSTAGRAM:** 24/24 billeder indlæst, 6 kopiknapper og svarformen `instagram ok 1-6`. Der er 0 JS-fejl, 0 kald ud og ingen sidelæns rulning på både 390 og 1280.

## Opslag for opslag

1. **Squat, hvad jeg kigger efter: klar.**
   - Marcs egne ord fra kapitel 8, ordret.
   - Tallene (1 cm, 21,7 cm, 23 cm) er 183 cm-kroppens. Det er samme krop som opslag 4, men ikke artiklens kapitel 1 og 8, som bruger 0,9 / 20,5 / 21,4 cm for den balancerede krop (I4).
   - "Jo længere afstand, jo mere skal leddet holde" gælder kun stangens bidrag. Det er acceptabelt forenklet til Instagram.
2. **Dødløft, stangen frem: rettes.**
   - Tallene er modellens.
   - "stangens vægt flytter ud til hofte, lænd, knæ og ankel" (slide 4 og billedtekst) er upræcis fysik. Vægten flytter ikke. Momentet om de led vokser, mens skulderens falder.
   - En løfter kan læse "armens moment ... bliver ca. 54 % mindre" som en fordel ved at lade stangen glide (I2).
   - Slide 5 åbner med "Fejl betyder her kun det, modellen viser", men ordet fejl er ikke brugt før i opslaget. Det er en forsvarende meta-sætning (I3).
3. **Bænk, buen: rettes.**
   - "men den rører ikke hele vejen længere mod fødderne" i billedteksten kan ikke forstås (I1).
   - "10,5 cm kortere" står ved de viste 46,2 og 35,8, og en læser regner 10,4 (I1).
   - Figurerne er små. I 360 px er hver bænk ca. 100 px bred, og buen, som opslaget handler om, er svær at se (I5).
   - "leg drive" er engelsk. Styrkeløftere siger det, men det kan hedde benenes skub (lav).
4. **Squat, to fejl: klar.**
   - Alle 12 tal står i artiklens kapitel 7 (samme krop).
   - "Anklen løber tør for bøjning, så ... hælen letter 3,7 cm" er modellens ankelgrænse, ikke en regel for fejlen. Slide 2 siger "i modellen", og forbeholdet står sidst. Kan blive, men se I6.
5. **Et løft i sin sammenhæng: klar.**
   - Alle sætninger findes i Marcs artikel. Eneste ændring er "din vurdering" til "atletens vurdering".
   - De fem trin er artiklens egne (Observer, Sammenlign, Beslut, Forklar, Følg op).
   - Ingen nye påstande.
6. **Konventionel og sumo: klar.**
   - Retningen (sumo: kortere vej, mere oprejst, mindre hofte- og lændmoment i starten) passer med litteraturen.
   - Billedteksten siger selv, at sumo kun er set fra siden, uden knæ ud og uden hofterotation.

## Fund

| Fund | Alvor | Nr. | Hvad | Hvad Setu gør |
|---|---|---|---|---|
| I1 | middel | 3 | Billedteksten: "men den rører ikke hele vejen længere mod fødderne" kan ikke læses, og "10,5 cm kortere" mod de viste 46,2 - 35,8 = 10,4. | Skriv fx "Stangen ligger højere over bænken, 25,2, 29,0 og 32,9 cm." og slet resten af sætningen. Skriv "ca. 10 cm kortere" eller 10,4. |
| I2 | middel | 2 | "stangens vægt flytter ud til hofte, lænd, knæ og ankel" og "-54 %" kan læses som en fordel. | Fx "Skulderen skal holde ca. 54 % mindre, og hofte, lænd, knæ og ankel mere." på slide 4 og i billedteksten. |
| I3 | lav | 2 | Slide 5: "Fejl betyder her kun det, modellen viser: en anden stilling i samme øjeblik." er forsvarende meta. | Start slide 5 med "Modellen har ingen muskler, ...". |
| I4 | lav | 1 | 183 cm-kroppens tal mod artiklens balancerede krop (0,9 / 20,5 / 21,4 cm) for "modellens squat i bunden". | Marcs valg. Ingen rettelse nødvendig nu, men når artiklen er ude, siger to steder forskellige tal om samme billede. |
| I5 | lav | 3 | Bænkfigurerne er ca. 100 px brede på en telefon, og buen er svær at se. | Tegn de tre bænke under hinanden eller større, og beskær væk fra benene. |
| I6 | lav | 4 | Hælløftet er modellens ankelgrænse. | Eventuelt "I modellen, hvor anklen højst bøjer 45°, ..." på slide 2. |

## Ærlige grænser

- Headless Chrome og et kontaktark i 360 px, ikke Instagram på en rigtig telefon.
- Kopiknappen er talt, ikke trykket.
- Tallene i opslag 2, 3 og 6 er ikke regnet igen i løftmodellen. Jeg har kun tjekket, at de er løftmodellens figurers (dist) og hænger sammen indbyrdes.
- Navnetjekket fanger kun de tre navne i appens `.gitignore`.
