karrusellerne klar til Marc: nej

Dommen bliver **ja**, når tre ting er rettet. Ingen af dem kræver Marc:
- **K3:** slide 3 i karrusel 1 bruger tabellen fra Min krop og ikke tabellen fra Mål dit billede. Den viser en skinneben-række, som værktøjet ikke har, og siger "det er lårene, ikke teknikken". Det kan værktøjet ikke sige om et rigtigt billede.
- **K1:** billedtekst 1 siger, at artiklerne om de tre løft ligger på entropicoaching.dk. Det gør de ikke, og de to, jeg har set (568 og 572), er ikke klar.
- **K2:** karrusel 2 og billedtekst 2 peger på værktøjssiden, men filmeguiden dér siger det modsatte om bænken, afstanden og målestokken (W1-W3 i `VAERKTOEJER.md`). Det er sitet, der skal rettes, og ikke karrusellen.

Resten holder:
- Marcs regler er overholdt i begge karruseller.
- Alle slides kan læses på en telefon.
- 15 af 15 påstande står ordret eller næsten ordret i vejledningen eller i FILM-KLIP.
- Karrusel 2 er sand, som den står.

# Kritik 576, blok 2: Setus to Instagram-karruseller (ordre 573)

## Hvad jeg målte

- **Kilderne:** `C:\Users\Entropi\Desktop\ordrer\kilder\setu-573\` med 14 PNG, `slides.mjs`, `tegn.mjs`, `kroppe.json`, billedteksterne og HTML'en bag hver PNG. Alt er kun læst. De 36 filers sha256 står i `karruseller-576.json`, og verificeringen tjekker, at ingen er ændret.
- **Holdt op mod:**
  - Marcs regler fra ordre 573,
  - vejledningen i Mål dit billede (`dist/maal-billede/index.html` på løftmodellens main `cc4dd7d`, hentet med `git archive`),
  - `FILM-KLIP.html` på skrivebordet (kun læst),
  - værktøjet selv, headless på 390 px med touch og uden net, med Setus egen tegnede krop med lange lår.
- **Script:** `outputs/kritik-576/karruseller-576.mjs` med 17 af 17 tjek grønne.
- **Slides i telefonstørrelse:** 390 px brede som i feedet, i `K1-390-slides-*.png` og `K2-390-slides-*.png`. Jeg har set dem alle igennem i den størrelse.

## Marcs regler

| Regel | Karrusel 1 (8 slides) | Karrusel 2 (6 slides) |
|---|---|---|
| Ingen tankestreger (slides, tegninger, billedtekst) | 0 | 0 |
| Ingen atletnavne | 0 | 0 |
| Ingen opfordring (prøv, følg, link i bio, gem, del, udråbstegn ...) | 0 | 0 |
| Ingen dramatisk åbning | "Mål dit billede måler ét billede af et løft fra siden." | "Telefonen står på et stativ ude til siden ..." |
| Ingen meta ("denne karrusel", "swipe") | 0 | 0 |
| Forbehold nederst | slide 7-8, rene tekstslides, intet forbehold før | slide 6, ren tekstslide |
| Neutral henvisning til sidst | "Mål dit billede og artiklerne om de tre løft ligger på entropicoaching.dk." | "Vejledningen og Mål dit billede ligger på entropicoaching.dk." |

- **Formen:** slides og billedtekster er skrevet i beskrivende form ("telefonen står ...", "du klikker ..."). Det er ikke opfordringer, men det er heller ikke Marcs egen stemme. Der er ingen erfaringer eller holdninger i hans navn.
- **Ét "du" i karrusel 2:** "hvor hoften er, når du står oprejst". Det er en forklaring og ikke en opfordring.

## Læsbar på en telefon

Jeg har åbnet HTML'en bag hver PNG i 1080 x 1350 og målt al tekst, også teksten i tegningerne. På en telefon, der viser billedet 390 px bredt, er tallene ganget med 0,36.

- **Slidetekst:** 46 px, og 56 px på tekstslides. Det svarer til ca. 17 og 20 px på telefonen. Den er let at læse, og ingen slide har over 4 linjer.
- **Mindste tekst:** 30 px på alle 14, altså ca. 10,8 px på telefonen. Det er etiketterne i tegningerne:
  - "stangen" ... "skulderen" på slide 1,
  - "skinnebenet 10° frem, overkroppen ens" på slide 4,
  - "set oppefra, ikke målfast" og "3-4 m, ikke målfast" i karrusel 2.
  - De kan læses, men de er det mindste (K6).
- **Kontrast og kant:** laveste kontrast er 6,7 (krav 4,5), og al tekst står mindst 51 px fra kanten.
- **Linjelængden i billedteksterne:** 811 og 882 tegn, 7 og 8 sætninger og ingen lange ord.

## Sand

**15 påstande står ordret eller næsten ordret i kilden:**
- **Karrusel 1:** seks punkter i fast rækkefølge; samme fase, skala, midtfod og gulv; klikkene i blåt; "Ligner"-reglen; bliver i browseren, intet gemmes; skråt forfra giver forkerte vinkler; ingen muskler og stiv ryg; "Fejl" er kun det, modellen viser; 2 cm forkert giver knæet 4-5°; ca. 4° eller 3 cm.
- **Karrusel 2:**
  - 3-4 m, højkant, ikke vippet, zoom,
  - ½ m frem uden at dreje giver under 1° (vejledningen: "50 cm ved siden af ... flytter vinklerne under 1°"),
  - hoftehøjde og tape,
  - dødløft mindst 3 m, fordi stangen tættere på ser lavere ud,
  - sumo præcis 3 m og højst ca. 20 cm frem,
  - bænkens højde og 3 m,
  - i hånden giver ca. 3°,
  - et flyttet kamera virker som en ændret teknik.
- **Billedtekst 2:** afstandene (3-4 m, mindst 3 m, præcis 3 m, 3 m) følger FILM-KLIP.

**Karrusel 2 er sand, som den står.** Tegningerne siger "ikke målfast". Bænken filmes på højkant som i vejledningen og FILM-KLIP. Problemet er kun, at værktøjssiden siger noget andet (K2).

**Karrusel 1, slide 3 (K3):** jeg lagde Setus egen krop med lange lår (`kroppe.json`) ind i Mål dit billede, 178 cm og 85 kg, squattens bund (`K1-390-vaerktoejet-lange-laar.png`).

| Række | Slide 3 | Mål dit billede selv |
|---|---|---|
| overkrop | 51,8° / 49,2° / +2,6° | ≈51,8° / 49,2° |
| hofte | 34,6° / 36,9° / −2,3° | ≈34,6° / 36,9° |
| knæ | 41,4° / 46,1° / **−4,7°** (guld) | 41,4° / 46,1° |
| skinneben | 45° / 40° / **+5°** (guld) | **ingen række** |
| stang til midtfod | 0,7 cm / 0,8 cm / −0,1 cm | −0,7 cm (bag midtfoden) / "skriv stangens vægt" |
| stang til hofte | ingen række | ≈22,3 cm / 21,3 cm |

- De tre vinkler passer. Men tabellen er Min krops ("tabel" i `kroppe.json` fra 524) og ikke værktøjets.
- Vejledningen siger det udtrykkeligt: "Det, modellen selv vælger, fx squattens skinneben ..., står under tabellen, ikke i den."
- Så slidens "Knæ og skinneben skiller sig ud" er i værktøjet kun knæet.
- Stangen står med den forkerte side af midtfoden (0,7 foran i stedet for 0,7 bag) og en modelværdi, værktøjet ikke viser uden stangens vægt.
- For samme krop siger værktøjet "Ligner ikke "kun knæene" eller "hoften skudt for langt tilbage" over målefejlen", fordi kroppen er modellens egen udførelse.

**Karrusel 1, slide 4 (K4):**
- Guldfiguren "kun knæene" er Setus egen: modellens bund med skinnebenet 10° frem og overkroppen ens. Legenden siger "skinnebenet 10° frem, overkroppen ens".
- Modellens egen fejlfigur ("kun knæene" i bunden, 178 cm) har skinnebenet ca. 16° frem, overkroppen ca. 8° mere oprejst og hælen løftet. Det er den, værktøjets link viser.
- Setus figur opfylder reglen (mindst 8°, torsoen ikke mere frem), så den er ikke forkert. Men den er ikke modellens fejlfigur, og det står ikke på sliden. Setus rapport siger "tegnet, ikke målt", men det gør sliden ikke.

**Billedteksterne (K1, K5):**
- Billedtekst 1 slutter "Mål dit billede og artiklerne om de tre løft ligger på entropicoaching.dk." På sitets main ligger i dag hverken `vaerktoejer/` eller artiklerne om squat, dødløft og bænk. Kun de to ældre dødløftartikler (kropsbygning og stangbane) ligger der. Setu skriver selv, at værktøjssiden først skal ud, men han nævner ikke artiklerne.
- Billedtekst 2 er sand, når værktøjssiden er ude.
- Billedtekst 1 siger "Du klikker seks punkter på knoglerne, stangen, midtfoden, anklen, knæet, hoften og skulderen". Det læses som syv ting, og stangen og midtfoden er ikke knogler (K5).

## Siger de noget, modellen ikke kan?

**Ja, ét sted: slide 3's "det er lårene, ikke teknikken".**
- Mål dit billede sammenligner et billede med gennemsnitsmodellen, eller med Min krops mål i guld, hvis de er skrevet ind. Det kan ikke skille proportioner fra teknik i et rigtigt billede.
- På sliden er det sandt, fordi "billedet" er modellens egen tegning af en krop med lange lår. Men sliden siger ikke, at det er derfor, og læseren tager det som en regel: "skiller knæ og skinneben sig ud, er det lårene".
- Værktøjets eget svar på samme billede er "Ligner ikke". Det er det ærlige eksempel.
- Resten af karrusel 1 og hele karrusel 2 siger kun det, vejledningen siger.

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| K1 | middel | Billedtekst 1: "artiklerne om de tre løft ligger på entropicoaching.dk". De ligger der ikke (sitets main har ingen `artikel-squat`, `artikel-doedloeft` eller `artikel-baenk`), og dødløft (568) og bænk (572) har fået nej. Værktøjssiden er heller ikke ude. | Setu: "Mål dit billede ligger på entropicoaching.dk." uden artiklerne, eller vent til de er ude. Karrusellerne bruges først, når værktøjssiden er ude, som Setu skriver. |
| K2 | middel | Karrusel 2 og billedtekst 2 peger på værktøjssiden, men dens filmeguide siger "Til bænkpres lægges telefonen ned på siden", "Et par meter væk", "Skiven er målestokken" og "tag et skærmbillede". Karrusellen siger "på højkant", "3-4 m" og nævner videoen. | Setu: W1-W3 på værktøjssiden. Karrusellen er rigtig. |
| K3 | middel | Slide 3 viser Min krops tabel som "Tabellen viser billedet mod modellen". Værktøjet har ingen skinneben-række, stangen er −0,7 cm uden modelværdi, og "Knæ og skinneben skiller sig ud, og det er lårene, ikke teknikken" er en slutning, værktøjet ikke kan drage om et rigtigt billede. | Setu: tabellen tages fra Mål dit billede (overkrop, hofte, knæ, stang til hofte), og teksten siger, hvad sliden viser: en tegnet krop med lange lår, hvor kun knæet skiller sig ud, og værktøjet siger "Ligner ikke". |
| K4 | lav | Slide 4's guldfigur "kun knæene" er tegnet af Setu (10°, overkroppen ens), ikke modellens fejlfigur (ca. 16°, overkroppen ca. 8° mere oprejst, hælen oppe). | Setu: "tegnet, ikke modellens figur" i legenden, eller modellens `k7-kun-knae-bund.svg`. |
| K5 | lav | Billedtekst 1: "seks punkter på knoglerne, stangen, midtfoden, anklen, knæet, hoften og skulderen" læses som syv. | Setu: "seks punkter: stangen, midtfoden, anklen, knæet, hoften og skulderen". |
| K6 | lav | Etiketterne i tegningerne er 30 px, altså ca. 10,8 px på en telefon. Det er læseligt, men den mindste tekst står på det, man skal forstå tegningen af (punkternes navne, "skinnebenet 10° frem"). | Hvis Marc vil: 34-36 px til etiketterne på slide 1 og 4. |

## Ærlige grænser

- **Ingen rigtig telefon:** læsbarheden er målt (pixel, kontrast, kant) og set i 390 px på skærmen, ikke på en rigtig telefon i Instagram. Instagram kan beskære 4:5 i gitteret, men ikke i feedet.
- **Sandheden er holdt op mod kilder:** jeg har holdt påstandene op mod vejledningen og FILM-KLIP og ikke målt dem selv. Tallene deri er Yantras. FILM-KLIP er en vejledning til Marcs egne valideringsklip. Karrusel 2's "præcis 3 m i sumo" og "3 m i bænkpres" kommer derfra og ikke fra værktøjets vejledning, der siger "3-4 m" og "mindst 3 m". De to er ikke i strid.
- **Den nye main:** vejledningen er læst på den nye main (`cc4dd7d`, Yantra 571). 571 ændrede kun videoafsnittene, og ingen slide bygger på dem.
- **Navnetjekket** bruger fornavnene fra appens `.gitignore`. Et navn uden for listen ville ikke blive fanget, men slidene har ingen personer.
- **Tegningerne i karrusel 2** er stregtegninger. Dødløftfiguren (slide 4) er den sværeste at læse på 390 px, men sliden siger ikke noget om stillingen, kun om telefonen.
