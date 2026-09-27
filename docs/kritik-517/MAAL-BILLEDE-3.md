Mål dit billede klar til sitet: nej. B11 og B12 er lukket på 390 px med Min krop. Men et nyt fund stopper sitet: tallinjen under billedet kan ikke bryde (B13). Med en kendt skala gør den siden 377-388 px bred på telefoner med 360 og 375 px i squat og dødløft. På 390 er der kun 3 px luft, og med −8,5 cm er siden 395 px (E6 fra 511). Rettelsen er ét mellemrum mellem tallene. Når B13 er rettet: ja til målesiden. Før og efter bør vente på E1-E3 eller stå som "prøv selv" uden en sætning til atleten.

# Kritik 517, blok 1: Mål dit billede efter Yantras 510 (B11, B12)

Bhishak, 27. sep 2026. Ordre 517 fra Dhruva via Marc.

**Grundlag:** `entropi-loeftmodel-dhruva` @ `7f604f7` (510 merget), hentet med `git archive` til en midlertidig mappe. Intet træ er rørt, og intet er merget.

**Målingerne:**
- **Script:** `outputs/kritik-517/maal-side-517.mjs`, 20 tjek, alle grønne. Tallene står i `maal-side-517.json`, og skærmbillederne er `M-*.png`.
- **Browser:** headless Chromium uden net. 360, 375 og 390 px med touch, 1280 med mus.
- **Min krop:** gennemsnitlige proportioner for 183 cm og 120 kg (462). De ligger under Min krops egen nøgle, som i 510.
- **Billeder:**
  - **Syntetiske:** modellens egen stilling med Min krops længder i alle seks faser, tegnet uden perspektiv. Billedet er lig modellen, så hver række får ≈. Det er det bredeste tilfælde for B11.
  - **Marcs to billeder fra 462** med mine klik fra 494. Skærmbillederne af dem er kun udsnit af tallinjen og tabellen, fordi klippet har andre mennesker i baggrunden.
  - **Før og efter:** Marcs gulvbillede som før. Som efter tre tilfælde:
    - samme stilling fotograferet 10° skråt (skraa10)
    - samme stilling fotograferet 30 cm højere (op30)
    - 507's egen syntetiske ændring

## B11 og B12

| Fund | 508 | Nu (510) | Status |
|---|---|---|---|
| B11 | Med Min krop var tabellen 494 px og siden 510 px på 390 | **390:** tabellen 358 px og siden 390 px i alle seks faser, med og uden stangens vægt (12 af 12). ≈ står foran tallet i hver række inden for målefejlen, og forklaringen står lige under tabellen. **360/375:** tabellen er 328/343 px og holder sig, men se B13 | **lukket** |
| B12 | Knæfase-beskeden stod 745 px under tallinjen | Tallinjen på Marcs "knæhøjde"-billede: "Knæ 119,6° (stangen 31 cm under knæet)" i guld. Samme 31 cm som beskeden, på 360, 390 og 1280. Rullet, så billedets bund ses, står tallinjen på skærmen (bund 806 px, vinduet er 844 px). Intet mærke i gulvbilledet og intet i et billede fra knæhøjde | **lukket** |

B1-B9 er ikke gentjekket her (lukket i 508, og 510 har ikke ændret dem). B10 er stadig åben og kræver et squatklip fra siden (Marcs valg).

## Yantras tre spørgsmål (dag 70)

1. **Er ≈ tydeligt nok på en telefon?**
   - Ja. Tegnet er guld (#c8923a) i 14 px foran et hvidt tal. Forklaringen står 15 px under tabellen i 14,7 px (`M-390-tabel-dl-gulv.png`).
   - Ordene i `title` vises ikke ved et tryk på en telefon. Det gør ikke noget, fordi forklaringen står på siden.
2. **Kan en coach sende sætningen uændret?**
   - **Ordene:** Ja. "knæet mere bøjet (knævinkel −6,6°) og torsoen mere oprejst (torso fra lodret −4,6°)" er forståeligt for en atlet (`M-390-saetning-aendring507.png`).
   - **"Knæet længere frem over foden" og "hoften længere bag stangen":** forståelige.
   - **Men indholdet er ikke til at sende endnu:**
     - Samme stilling fotograferet 10° skråt giver: "stangen længere tilbage mod hælen (stangen foran midtfoden −13,3 cm) og hoften tættere på stangen (−12,6 cm)" (`M-390-saetning-skraa10.png`). Det er E2 fra 511, og nu står det i ord, en atlet tror på.
     - Tærsklen er stadig 4° og 3 cm pr. række (E1), så sætningen finder en forskel i 74-92 % af par uden nogen ændring (511).
     - Forbeholdet under tabellen ("Stod kameraet et andet sted anden gang …") er nyt og godt. Men det følger ikke med, når coachen kopierer sætningen.
3. **Mærket bryder på 390. Er det godt nok?**
   - Mærket selv, ja. "(stangen 31 / cm under knæet)" over to linjer kan læses (`M-390-marc-tallinje.png`).
   - Men Yantras eget forslag er det rigtige, og det er nødvendigt af en anden grund: tallinjen skal have mellemrum mellem tallene. Se B13.

## Nyt fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| B13 | middel, stopper sitet | Tallinjens tal (`<span>` med `nowrap`) er sat sammen uden mellemrum, så linjen kun kan bryde inde i B12-mærket. Med en kendt skala (Min krop eller højdefeltet) er den 361-371 px bred. **Tallinjen, ikke tabellen, er det bredeste element på siden.** Se tallene under tabellen. Uden skala står "Stang —", og linjen er kort nok | Ét mellemrum (eller `display:flex; flex-wrap:wrap; gap`) mellem spans i `src/embed/maalBillede.js`, hvor tallinjen bygges (`.join('')` → `.join(' ')`). Test: `scrollWidth <= 360` med Min krop i alle seks faser og i før/efter |

**Siden, tabellen og tallinjen med Min krop og stangens vægt, i px (side / tabel / tallinje):**

| Fase | 360 | 375 | 390 |
|---|---|---|---|
| Squat bund | **387** / 328 / 371 | **388** / 343 / 371 | 390 / 358 / 371 |
| Squat midt | **387** / 328 / 371 | **388** / 343 / 371 | 390 / 358 / 371 |
| Dødløft gulv | **377** / 328 / 361 | **377** / 343 / 361 | 390 / 358 / 361 |
| Dødløft knæ | **385** / 328 / 369 | **385** / 343 / 369 | 390 / 358 / 369 |
| Bænk bryst | 360 / 328 / 328 | 375 / 343 / 343 | 390 / 358 / 358 |
| Bænk midt | 360 / 328 / 328 | 375 / 343 / 343 | 390 / 358 / 358 |

**Hvad B13 betyder:**
- **360 og 375 er almindelige telefoner:** mange Android-telefoner er 360 px brede, og iPhone SE/mini er 375 px.
- **På 360 går billedet ud over skærmen:** `M-360-squat-tallinje-min-krop.png` viser, at "Stang −1,0 c" er skåret af, og at billedet flyder ud over skærmen.
- **På 390 holder det kun med få px luft:** siden er 390, men tallinjen er 371 px i et felt på 358. Der er 3 px til overs, fordi den flyder ud i sidens margen. Tallene i skærmbillederne er korte.
  - Med "Stang −8,5 cm" (skraa10) er siden 395 px på 390. Det er E6 fra 511, med samme årsag.
  - "Hofte 100,2°" eller "Stang −10,5 cm" vil gøre det samme.
- **Marcs gulvbillede:** siden er 385 px på 360 og 390 px på 390.
- **Før og efter på 360:** siden er 385-395 px i alle tre tilfælde.
- **Samme slags problem som B11:** B11 var én CSS-regel, og det er det samme tilfælde, som siden anbefaler (Min krop udfyldt). Derfor dømmer jeg det ens.

## Før og efter (511's E1-E6 efter 510)

| Fund | Nu | Status |
|---|---|---|
| E1 | Tærsklen er stadig 4° / 3 cm pr. række | åben |
| E2 | 10° skråt: "stangen længere tilbage mod hælen (−13,3 cm)". 30 cm højere: "Ingen forskel over målefejlen" | åben |
| E3 | Squat midt: 5 cm-grænsen er uændret | åben (ikke gentjekket) |
| E4 | Bænk midt: 8 cm er uændret | åben (ikke gentjekket) |
| E5 | Retningen står i ord, og der er et forbehold om kameraet under tabellen | **lukket** i 510 (ordene). Forbeholdet er ikke en del af sætningen |
| E6 | 395 px på 390 | åben, rettes med B13 |

## Klar til sitet og til Marc

- **Målesiden på sitet: nej, B13 først.**
  - B13 er ét mellemrum og en test på 360.
  - Alt andet i B1-B12 er lukket undtagen B10 (Marcs klip).
- **Før og efter på sitet:** den bør ikke stå med en sætning, man kan sende, før E1 og E2 er rettet.
  - Enten tre klik pr. billede eller tærskler pr. række.
  - Og skiveproblemet ved et skråt kamera (to nav eller en advarsel).
  - Indtil da: skjul "Størst forskel"-sætningen på sitet, eller skriv forbeholdet ind i selve sætningen.
- **Marc hver uge på 1280: ja.** Intet her stopper ham.

## Ærlige grænser

- **Kun headless Chromium på Windows,** ikke Safari på en iPhone og ikke Chrome på en rigtig Android. En anden skrifttype kan gøre tallinjen et par px bredere eller smallere. B13's margen på 390 (3 px) kan derfor gå begge veje.
- **De syntetiske billeder er modellens egne stillinger,** tegnet uden perspektiv. De er valgt, fordi de giver ≈ i hver række (bredeste tabel), ikke fordi de ligner et rigtigt billede.
- **Marcs klip er mine egne klik fra 494,** ét forsøg (knæ 119,6°, Yantras 122,8°).
- **E3 og E4 er ikke regnet igen,** fordi 510 ikke rørte dem.
- **Intet net, intet skrevet til lageret** ud over Min krop, som scriptet selv lægger. Ingen JS-fejl på nogen bredde.
