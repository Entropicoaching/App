karrusellerne klar til Marc: ja

K1-K5 fra 576 er lukket, og K2 lukkede sig selv, da Setu rettede værktøjssiden (W1-W3). Kun K6 (lav, etiketter på 30 px) står tilbage, og den skal ikke rettes først.

Én betingelse ligger uden for karrusellerne (K7, middel, Marcs valg): begge billedtekster slutter "... ligger på entropicoaching.dk". Efter mergen af `vaerktoejer` ligger Mål dit billede der, men ingen side på sitet linker til `/vaerktoejer/`, og siden har noindex. En læser, der går ind på entropicoaching.dk, kan altså ikke finde den. Karrusellerne postes derfor først, når værktøjssiden er live og kan findes fra sitet. Trinene står i RAPPORT-585 under "Hvad er næste".

# Kritik 585, blok 2: Setus to karruseller efter 579

## Hvad jeg målte

- **Kilderne:** `C:\Users\Entropi\Desktop\ordrer\kilder\setu-573\` (kun læst) og Setus `setu-579\RAPPORT-579.md`.
  - Siden 576 har Setu ændret 7 filer: slide 3 og 4 i karrusel 1 (PNG og HTML), `billedtekst-1.txt`, `slides.mjs` og `tegn.mjs`.
  - 29 filer er byte for byte som i 576, blandt dem hele karrusel 2 og `billedtekst-2.txt`.
  - Alle 36 filers sha256 står i `karruseller-585.json`, og verificeringen tjekker, at ingen er ændret.
- **Holdt op mod:**
  - Marcs regler fra ordre 573,
  - vejledningen i Mål dit billede (dhruva main `291f5bf`, `git archive`),
  - `FILM-KLIP.html` på skrivebordet (kun læst),
  - værktøjssiden og Mål dit billede på grenen `vaerktoejer` (`eb7bf79`, `git archive`),
  - Mål dit billede selv, headless i Google Chrome på 390 px med touch og uden net, med Setus egen tegnede krop med lange lår (`kroppe.json`).
- **Script:** `outputs/kritik-585/karruseller-585.mjs` med 20 af 20 tjek grønne.
- **Slides i telefonstørrelse:** 390 px brede som i feedet, i `K1-390-slides-*.png` og `K2-390-slides-*.png`. Jeg har set slide 3 og 4 i fuld størrelse og alle 14 i 390 px.

## Slide 3

**K3 er lukket.** Tabellen er nu Mål dit billedes egen. Jeg målte den igen på sitets kopi (`eb7bf79`, som er main `291f5bf`, altså efter Yantras 580) for samme krop, 178 cm og 85 kg, squattens bund (`K1-390-vaerktoejet-lange-laar.png`):

| Række | Slide 3: billede / model / forskel | Mål dit billede selv | Billede minus model |
|---|---|---|---|
| overkrop | ≈51,8° / 49,2° / +2,6° | ≈51,8° / 49,2° | +2,6 |
| hofte | ≈34,6° / 36,9° / −2,3° | ≈34,6° / 36,9° | −2,3 |
| knæ | 41,4° / 46,1° / **−4,7°** (guld) | 41,4° / 46,1° | −4,7 |
| stang til hofte | ≈22,3 cm / 21,3 cm / +1 cm | ≈22,3 cm / 21,3 cm | +1,0 |

- Rækkerne står ordret som i værktøjet, med værktøjets ≈. Forskellen er regnet rigtigt.
- Skinneben-rækken og stang til midtfod er væk. "Det er lårene, ikke teknikken" er væk.
- **"Kun knæet skiller sig ud":** sandt. Kun knæet er over ca. 4° eller 3 cm, og kun knæet er i guld.
- **"linjen under siger "Ligner ikke"":** sandt. Værktøjet siger "Ligner ikke "kun knæene" eller "hoften skudt for langt tilbage" over målefejlen. Det udelukker ikke fejlen: ... Andre fejl tjekker siden ikke."
- **Rest (lav, ikke et fund):** sliden viser kun linjens begyndelse. Resten ("Det udelukker ikke fejlen") står kort på slide 7: ""Ligner ikke" betyder ikke uden fejl". Det er nok.
- Sliden siger nu, hvad den viser: en tegnet krop med lange lår mod gennemsnittet. Den drager ingen slutning om proportioner mod teknik.

## Slide 4

**K4 er lukket.** Legenden siger nu "skinnebenet 10° frem, overkroppen ens, tegnet, ikke modellens egen fejlfigur".
- Figuren opfylder reglen: mindst 8° og torsoen ikke mere frem. Så "Ligner: kun knæene" i boksen er det, værktøjet ville sige.
- Linjens ordlyd "Ligner: kun knæene" er værktøjets egen (se VAERKTOEJER.md, seks punkter trykket).
- Setu byttede ikke til modellens `k7-kun-knae-bund.svg`. Det var den anden mulighed i 576, og mærkningen er nok.

## Billedtekst 1

**K1 er lukket.** Billedteksten slutter "Mål dit billede ligger på entropicoaching.dk." Artiklerne om de tre løft er ikke nævnt.
- Sætningen bliver sand med mergen af `vaerktoejer`. I dag ligger `vaerktoejer/` ikke på sitets main, men Mål dit billede ligger på grenen.
- `merge-tree` af sitets main og `vaerktoejer` giver ingen konflikter.

**K5 er lukket.** "Du klikker seks punkter: stangen, midtfoden, anklen, knæet, hoften og skulderen". Seks ting, i vejledningens rækkefølge, og "på knoglerne" er væk.

**K7 (middel, Marc):** "ligger på entropicoaching.dk" er kun sandt for en læser, hvis siden kan findes.
- På `vaerktoejer` linker ingen side til `/vaerktoejer/` (heller ikke `viden.html` eller menuen).
- `/vaerktoejer/` har `noindex, nofollow`, og robots.txt udelukker `/assets/vaerktoejer/`.
- Setu nævner det selv i 579 og 584 som Marcs valg. For karrusellerne er det en betingelse: mindst ét link fra sitet til `/vaerktoejer/`, før der postes. Noindex kan blive, hvis Marc vil. Et link er nok til, at en læser kan finde den.

## Karrusel 1 og 2 igen

**Marcs regler holder i begge:**

| Regel | Karrusel 1 (8 slides) | Karrusel 2 (6 slides) |
|---|---|---|
| Tankestreger (slides, tegninger, billedtekst) | 0 | 0 |
| Atletnavne | 0 | 0 |
| Opfordringer (prøv, følg, link i bio, gem, del, udråbstegn ...) | 0 | 0 |
| Dramatisk åbning | ingen | ingen |
| Meta ("denne karrusel", "swipe") | 0 | 0 |
| Forbehold nederst | slide 7-8, rene tekstslides | slide 6, ren tekstslide |
| Neutral henvisning til sidst | "Mål dit billede ligger på entropicoaching.dk." | "Vejledningen og Mål dit billede ligger på entropicoaching.dk." |

**Læsbar:** alle 14 PNG er 1080 x 1350. Slideteksten i hver PNG's HTML er den samme som i `slides.mjs`, så PNG'erne er lavet efter rettelsen. Mindste tekst er 30 px (ca. 10,8 px på en 390 px telefon), laveste kontrast 6,7, og al tekst står mindst 51 px fra kanten.

**Sand:** 16 af 16 påstande står ordret eller næsten ordret i vejledningen (main `291f5bf`) eller FILM-KLIP. Det er de 15 fra 576 plus slide 3, som er målt ovenfor. Yantras 580 ændrede ingen af dem.

**K2 er lukket.** Karrusel 2 og værktøjssidens filmeguide siger nu det samme:

| | Karrusel 2 | Filmeguiden på `vaerktoejer` |
|---|---|---|
| telefonen | "På højkant og lige" | "hold telefonen lodret, også til bænkpres" |
| afstand | "3-4 m væk" | "Fra 3-4 m og zoomet ind er det fint" |
| dødløft | "mindst 3 m væk" | "Dødløft filmes fra mindst 3 m" |
| bænkpres | "i bænkens højde" | "Til bænkpres i højde med bænken" |
| video | "Et løft kan måles fra en video" | "Videoen kan åbnes direkte i Mål dit billede" |
| sumo | "præcis 3 m, og stativet højst ca. 20 cm frem" | ikke nævnt (W8, lav, ikke i strid) |

**Siger de noget, modellen ikke kan?** Nej, ikke længere. Slide 3's slutning om lårene var det eneste sted i 576, og den er væk.

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| K1 | lukket | Billedtekst 1 nævner ikke længere artiklerne. | |
| K2 | lukket | Filmeguiden på værktøjssiden siger det samme som karrusel 2 (W1-W3 lukket). | |
| K3 | lukket | Slide 3 er Mål dit billedes egen tabel, målt igen på sitets kopi af main `291f5bf`. Kun knæet i guld, og "Ligner ikke" som i værktøjet. | |
| K4 | lukket | Slide 4's figur er mærket "tegnet, ikke modellens egen fejlfigur". | |
| K5 | lukket | "seks punkter: stangen, midtfoden, anklen, knæet, hoften og skulderen". | |
| K6 | lav | Etiketterne i tegningerne er stadig 30 px, ca. 10,8 px på en telefon. Læseligt. | Hvis Marc vil: 34-36 px på slide 1 og 4. Ikke før udgivelse. |
| K7 | middel | "ligger på entropicoaching.dk" kræver, at siden kan findes. Efter mergen linker intet på sitet til `/vaerktoejer/`. | Marc (eller Setu på hans ordre): ét link fra sitet til `/vaerktoejer/`, fx fra `viden.html`, før karrusellerne postes. |

## Ærlige grænser

- **Ingen rigtig telefon:** læsbarheden er målt (pixel, kontrast, kant) og set i 390 px på skærmen, ikke på en telefon i Instagram.
- **Sandheden er holdt op mod kilder:** påstandene er holdt op mod vejledningen og FILM-KLIP. Tallene deri er Yantras. Kun slide 3 er målt selv, i værktøjet på sitets kopi.
- **Slide 3's krop er tegnet:** tabellen er værktøjets svar på et ensfarvet billede med klik sat præcis på Setus syntetiske krop. Et rigtigt foto giver klikfejl, og sliden siger det ikke. Det gør slide 8 ("Punkterne er skøn").
- **K7 er målt på grenen:** jeg har tjekket, at ingen side på `vaerktoejer` linker til `/vaerktoejer/`. Hvad Marc vælger at linke fra efter mergen, har jeg ikke set.
- **Navnetjekket** bruger fornavnene fra appens `.gitignore`. Slidene har ingen personer.
