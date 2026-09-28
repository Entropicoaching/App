Instagram 1-6 klar til Marcs godkendelse: ja (ingen numre skal rettes; I4, I6 og I7 er valgfri)

# Kritik 622, blok 2: de seks Instagram-opslag efter Setus 615 (Bhishak)

## Hvad jeg målte

- **Kilderne:** `ordrer/kilder/setu-606/` (`slides.mjs`, `tegn.mjs`, `billedtekst-1..6.txt`, 24 PNG), Setus kopi fra før 615 i `setu-615/foer-606/` og `Desktop/LAES-INSTAGRAM.html`. Alt er kun læst.
- **`outputs/kritik-622/insta-622.mjs`:** 14/14 grønne. Det er mine egne regeltjek fra 613, gjort strengere:
  - Tankestreger, opfordringer, dramatiske åbninger, "Marc", kilo, atletnavnene fra appens `.gitignore`, meta og engelske fagord.
  - Opslag 2 og 3 er holdt op mod mine fund I1-I3 og I5.
  - Opslag 1, 4, 5 og 6 er ikke rørt, og de rettede slides i 2 og 3 er andre byte for byte end før 615.
  - LAES-INSTAGRAM viser alle 24 nuværende PNG byte for byte og de nye billedtekster.
  - LAES-INSTAGRAM er åbnet som `file://` i Google Chrome headless på 390 med touch og 1280 med mus, uden net.
  - Alle 24 slides er set i 360 px bredde (`I-ark-1..4.png`), og 2's slide 4 og 3's bænke er set før og efter.
- **Tallene i opslag 1 og 4** er holdt op mod squat-artiklen på `9ae75d5` (kapitel 1 og 7).

## Tværs af alle seks

- **0 regelbrud:** 0 tankestreger, 0 opfordringer, 0 dramatiske åbninger, 0 "Marc", 0 kilo, 0 atletnavne og nu også 0 engelske fagord.
- **Henvisningen:** alle seks billedtekster slutter neutralt med "... ligger på entropicoaching.dk."
- **Forbeholdet** står i billedtekstens sidste afsnit.
- **Ingen genkendelige atleter.** Alle figurer er løftmodellens, og opslag 5 har kun kasser og tekst.
- **LAES-INSTAGRAM:**
  - 24/24 billeder indlæst, 6 kopiknapper og svarformen `instagram ok 1-6` / `instagram ret N: ...`.
  - 0 JS-fejl, 0 kald ud og ingen sidelæns rulning på 390 og 1280.
  - Under titlerne på 2 og 3 står en markeret linje om, hvad der er rettet, og boksen øverst siger, at 1, 4, 5 og 6 er uændrede.

## Opslag for opslag

1. **Squat, hvad jeg kigger efter: klar.** Ikke rørt. I4 (183 cm-kroppens tal) står åben som Marcs valg.
2. **Dødløft, stangen frem: klar. I2 og I3 er lukket.**
   - Slide 4 og billedteksten siger nu "Med stangen fremme skal skulderen holde ca. 54 % mindre, og hofte, lænd, knæ og ankel mere." Det er rigtig fysik (momentet flytter, vægten gør ikke), og det kan ikke læses som en fordel.
   - Tegningen siger "skulderen holder ca. 54 % mindre / hofte, lænd, knæ og ankel holder mere". Der er intet "−54 %" og intet "vægten flytter ud".
   - Slide 5 starter med "Modellen har ingen muskler", og "Fejl betyder her" er ude.
   - Slide 1-3 er uændrede. Slide 1 er renderet igen, men den eneste forskel er kantudglatning i en streg.
   - Billedteksten har en ny kort sætning: "Armens moment om skulderen holder stangen ind mod benene." Den er rigtig, men fagsprog. Den kan blive.
3. **Bænk, buen: klar. I1 og I5 er lukket.**
   - "ca. 10 cm kortere" står ved 46,2 og 35,8.
   - Sætningen "men den rører ikke hele vejen længere mod fødderne" er slettet.
   - "leg drive" hedder "skub fra benene".
   - I 360 px er hver bænk ca. 140 px bred mod ca. 100 før, og buen kan ses: brystet står tydeligt højere i stor bue end i lille. At knæene er skåret af i højre kant er i orden, fordi buen går fra skulderbladene til balderne, og de er med (Setus spørgsmål 5).
   - Ny lav: fodnoten "lille og stor i blåt, middel svagt bagved" passer ikke til det nye layout. Middel står som sin egen grå figur i midten, ikke bagved (I7).
4. **Squat, to fejl: klar.** Ikke rørt. Alle 12 tal står stadig i artiklens kapitel 7 på `9ae75d5`. I6 står åben.
5. **Et løft i sin sammenhæng: klar.** Ikke rørt.
6. **Konventionel og sumo: klar.** Ikke rørt.

## Fund

| Fund | Alvor | Nr. | Status efter 615 | Hvad Setu gør |
|---|---|---|---|---|
| I1 | middel | 3 | lukket | Intet. |
| I2 | middel | 2 | lukket | Intet. |
| I3 | lav | 2 | lukket | Intet. |
| I4 | lav | 1 | åben, Marcs valg | Intet, medmindre Marc vil have den balancerede krops tal (0,9 / 20,5 / 21,4 cm). |
| I5 | lav | 3 | lukket | Intet. |
| I6 | lav | 4 | åben, valgfri | Eventuelt "I modellen, hvor anklen højst bøjer 45°, ..." på slide 2. |
| I7 | lav | 3 | ny | Fodnoten på bænk-sliden: skriv fx "lille og stor i blåt, middel i gråt" i stedet for "middel svagt bagved", og kør `node lav.mjs 3` og `node laeseside.mjs` igen. |

## Ærlige grænser

- Headless Chrome og et kontaktark i 360 px, ikke Instagram på en rigtig telefon.
- Kopiknappen er talt, ikke trykket.
- Tallene i opslag 2, 3 og 6 er ikke regnet igen i løftmodellen. Jeg har kun tjekket, at de hænger sammen indbyrdes og med 606.
- "Ikke rørt" for 1, 4, 5 og 6 er målt på filernes tid mod de nye PNG i 2 og 3, ikke mod en kopi byte for byte. Der findes ingen kopi af dem fra før 615.
- Navnetjekket fanger kun navnene i appens `.gitignore`.
