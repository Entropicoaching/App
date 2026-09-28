videoen klar til sitet: ja

Ja. I Google Chrome går hvert tryk præcis ét billede i mine H.264-klip, både MP4 og MOV, i 29,97 og i en telefons variable billedrate. Det gælder også over et tabt billede og i et stykke i 24 billeder/s. "Hop til" med to buer rammer bunden i alle fem squats. De første tryk er hurtige nok med 4 gange langsommere CPU, og 4K virker, som Yantra skriver.

Ét nyt fund (V7, lav) handler ikke om siden:
- Playwrights Chromium-build kan ikke vise alle billeder i en H.264 med B-billeder og variabel billedrate, så dér springer et tryk et billede over.
- Google Chrome viser dem, og siden går rigtigt.
- Yantras tests bør have sådan et klip med.

# Kritik 582, blok 2: videoen i Mål dit billede efter Yantras 571

Bhishak, 28. sep 2026. Ordre 582. Siden er løftmodellens `dist/maal-billede` fra `main`, hentet med `git archive`; træet er urørt.
- Main flyttede fra `cc4dd7d` til `291f5bf` (Yantras 580, W4-W6), mens jeg arbejdede. Videoen er målt på `291f5bf`.
- 580 rører "Ligner"-linjen, fejlfigurens navn og skulderpunktet, ikke videoen: `src/maalVideo.js` er uændret.
- Yantras `docs/RAPPORT-dag-84.md` er læst.

## Hvad jeg målte

`outputs/kritik-582/klip-582.mjs` laver mine syntetiske klip, og `video-582.mjs` måler dem. Resultatet står i `video-582.json` og `V-*.png`. **21/21** tjek er grønne.

**Klippene** er tegnet i node, som i 564, og kodet med ffmpeg-static (libx264 High med B-billeder, 16 Mbit/s, og libx265):
- Hvert billede har sit nummer i 12 blokke øverst. Nav og skive går gennem mine fem squats fra 564, tegnet til billedets egen tid.
- Billedernes tider er læst tilbage fra filerne med ffmpeg. Det er facit, ikke regnede tider.

| Klip | Hvad | Mellemrum |
|---|---|---|
| `sq2997.mp4` | H.264, 1080 x 1920, 30000/1001, 30 s, 899 billeder, tidsskala 30000 | 33,37 ms |
| `sq2997.mov` | samme spor i MOV med tidsskala 600, som en iPhone | 33,3 og 35,0 ms |
| `sqvfr.mp4` | variabel billedrate efter Yantras mønster, 796 billeder, tidsskala 90000 | 31,3-66,7 ms |
| `sqvfr.mov` | samme, MOV med tidsskala 600 | 30,0-66,7 ms |
| `sq4k.mp4` | H.264 2160 x 3840, 29,97, 6 s, 42 Mbit/s | 33,37 ms |
| `sqhevc.mov` | HEVC (hvc1), 1080 x 1920, 29,97, 6 s, tidsskala 600 | 33,3 og 35,0 ms |

Den variable billedrate har ca. 30/s med ±2 ms uro, hvert 9. billede tabt (66,7 ms) og billede 240-359 i 24/s.

**Browseren:**
- Google Chrome 154 headless, den installerede, som en coach har den. Playwrights Chromium 151 er kun brugt til sammenligningen i V7.
- 390 x 844 med touch (Playwrights tryk, ingen OS-mus) og 1280 med mus.
- Alt andet end file, data og blob afvises og tælles: **0 netkald** i alle kørsler.
- Hvert tryk måles i siden, fra pointerdown til siden har vist det nye billede (en færdig handling mere, køen tom, ingen søgning i gang). Nummeret læses bagefter i blokkene.

## Trinene i H.264 MP4 og MOV

Hvert tryk går præcis ét billede i alle 8 kørsler: fire klip på 390 med touch og på 1280 med mus.

**Hvert klip får samme prøve:**
- 24 tryk frem fra 0 giver billede 1-24.
- Fra skyderen midt i billede 290 (+3 ms): 8 frem giver 291-298, og 6 tilbage giver 297-292.
  - I VFR-klippene ligger 290 i stykket i 24/s, og det tabte billede mellem 296 og 297 (66,7 ms) krydses. Mellemrummene var 41,7 ms syv gange og 66,7 ms én gang, og trykket gik stadig ét billede.
- Fra billede 250: det samme, og i VFR går trykket over et tabt billede ved 251-252.
- Tiden under videoen er billedets egen: "0,80 s" i 29,97 og "0,87 s" i VFR efter 24 tryk, som i filen.
- "Brug dette billede" giver fotoet af det viste billede (252 i alle), og navnet siger "8,41 s" og "9,43 s".

**Teksten under knapperne** i alle fire: "Et tryk går præcis ét billede frem eller tilbage: browseren siger tiden på hvert billede, også i 29,97 billeder/s og en telefons skiftende billedrate" (`V-390-trin-vfr-mov.png`). Det passer i Chrome.

**MOV med tidsskala 600:** tiderne afrundes til 1/600 s. Mellemrummene i 29,97 bliver et fast mønster af 33,3 og 35,0 ms, og VFR's korteste bliver 30,0 ms. Siden går stadig ét billede. Det er Yantras grænse "under ca. halvt så langt som det korteste", som ikke rammes her.

**HEVC-MOV:** den åbner i Chrome på 63 ms, og 5 tryk giver 1-5 (`V-390-hevc.png`). I 564 kunne Chromium ikke afkode den. Chrome på denne pc kan, men det er Windows' egen HEVC-afkoder; en anden pc eller telefon kan mangle den.

**V7 (Chromium mod Chrome).**
- **I Playwrights Chromium 151** vises billede 19 i `sqvfr.mp4` aldrig:
  - En søgning til 19's start + 1 ms og til midten af 19 viser 18.
  - Midten af 20 viser 20.
  - Et tryk går derfor 18 → 20, og det samme i MOV'en og på 1280.
- **I Chrome 154** vises 18, 18, 19, 19, 20, 20, og trykket går 18 → 19.
- **B-billederne er årsagen:** samme 3 s kodet uden B-billeder viser 19 i Chromium. Med B-billeder gør det ikke.
- **Det er ikke sidens fejl:** heller ikke skyderen kan vise billedet i den browser.
- **Men det betyder to ting:**
  - Yantras egne klip er VP8 uden B-billeder og kan ikke finde sådan et hul.
  - Siden kan ikke vide, at den sprang over.

## Hop til med to buer

**I browseren** klikkede jeg navet med fingeren i det billede, siden viste. Tallene er billeder fra bunden (0 = på bunden; i "pause" er hvert billede i de 0,6 s bunden):

| Squat | To klik 10 % | Tekstens råd: 10 % og 30 % på hver side | En træner: 3 % og 40 % ned, 8 % og 25 % op | Tre klik |
|---|---:|---:|---:|---:|
| jævn | −1 | 0 | 0 | −1 |
| hurtig op | −4 | 0 | 0 | −3 |
| grind | +5 | 0 | 0 | +5 |
| pause | 0 | 0 | 0 | 0 |
| dyk | +3 | 0 | 0 | +3 |

- **Tabellen er målt på 390 i `sq2997.mp4`.**
- **I `sqvfr.mov`** gav to buer 0 i alle fem, og to klik −1, −4, +3, 0 og +2.
- **På 1280 med mus** gav to buer 0 i alle fem.
- **Siden valgte to buer** i alle 20 hop med fire klik.
- **Tre klik giver én bue og samme fejl som to klik.** Siden siger det selv: "Buen er lige stejl på begge sider, så den rammer ikke bedre end to klik. Klik to billeder på hver side af bunden, ét tæt på bunden og ét højere oppe ..." (`V-390-hop-tre-klik.png`).
- **Er teksten nok (Yantras spørgsmål)?** Ja. Jeg regnede det med sidens egen `lavestePunkt` og 500 forsøg pr. squat:
  - Træneren følger teksten: "tæt på bunden" 2-12 %, "højere oppe" 15-50 %, klikstøj ±1 % af dybden. Det er ca. 9 videopixels, eller 3 px under en finger på 390.
  - To buer bliver brugt i 88-91 % af forsøgene.
  - De rammer med median 0-1 og p90 1 billede fra bunden, værst 2.
  - To klik i samme højde rammer ved siden af med median 7, 10, 2, 0 og 2.
  - Med ±2 % støj er det 87-90 %, median 0-1 og p90 2, værst 4.
  - Med Yantras tilfældige højder (5-40 %) bruges to buer kun i 45-51 %, fordi højderne ofte ligger for tæt. Så siger siden "for tæt" og beder om et klik højere oppe.

## De første tryk på en telefon

390 med touch og `sq2997.mp4` (1080p, 57,6 MB):

| | Åbne | Tryk 1-5 (ms) | Senere tryk, median / maks. | Tilbage, median | Hop | Brug dette billede |
|---|---:|---|---:|---:|---:|---:|
| Uden bremse | 61 ms | 71, 41, 15, 15, 15 | 15 / 16 | 15 | 39 ms | 109 ms |
| 4 gange langsommere CPU | 189 ms | 168, 64, 24, 17, 22 | 17 / 25 | 17 | 52 ms | 457 ms |

- **Kun de to første tryk koster mere.** Det er Yantras søgninger, mens siden måler billedernes længde.
- **Første tryk:** 66-146 ms i de otte trin-kørsler uden bremse, og 168 ms med bremsen. Et tryk under 0,2 s føles ikke langsomt. Det gør de to første heller ikke.
- **VFR:** senere tryk har et maks. på 45-47 ms, når siden møder et tabt billede og søger en halv længde videre. Median 14-15 ms.
- **Brug dette billede** tager 0,46 s med bremsen. Det er én gang pr. billede.

## 4K

390 med touch og `sq4k.mp4` (2160 x 3840, H.264, 31,6 MB):

| | Åbne | Tryk 1-3 (ms) | Senere, median | Brug dette billede × 3 | Fotoet |
|---|---:|---|---:|---|---|
| Uden bremse | 124 ms | 183, 141, 23 | 23 | 137, 101, 96 ms | 1080 × 1920, det viste billede |
| 4 gange langsommere CPU | 314 ms | 241, 144, 25 | 26 | 450, 424, 436 ms | 1080 × 1920, det viste billede |

- **Linjen i videoboksen:** "Videoen er 2160 × 3840. Billedet til klik-trinnet tages ned til 1080 × 1920 (som et 1080p-klip), hvilket er nok til klikkene og fylder ca. 25 % af et foto i fuld størrelse i telefonens hukommelse." (`V-390x4-4k.png`)
  - Den er klar for en træner.
  - "25 %" er rigtigt for pixelantallet: 1080 × 1920 er en fjerdedel af 2160 × 3840.
- **10 tryk frem** giver billede 1-10 med og uden bremse.
- **Hukommelsen** er browserens processer tilsammen (privat hukommelse fra Windows):
  - 810 MB tom, 1272 med 4K-videoen åben, 1423 efter tre fotos og 1372 0,8 s efter "Luk videoen".
  - Tallene svinger mellem kørsler, og det, der blev frigivet ved "Luk videoen", nåede jeg ikke at se falde på 0,8 s. Det er ikke et fund, men heller ikke målt færdigt.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| V7 | lav | I Playwrights Chromium 151 vises et billede i en H.264 med B-billeder og variabel billedrate aldrig (billede 19 i `sqvfr.mp4` og `.mov`), så et tryk går 18 → 20 uden at siden ved det. I Chrome 154 går det rigtigt, og uden B-billeder går det rigtigt i begge. Siden kan ikke gøre det bedre end browseren. Yantras klip (VP8) har ingen B-billeder og kan ikke finde et sådant hul. | Yantra: læg et H.264-klip med B-billeder og variabel billedrate ind i testen, fx med ffmpeg-static som mine, og kør det i Chrome. Siden selv skal ikke rettes. |

V1-V6 fra 564 er lukket. V3 og V6 er lukket i 571, og jeg har set dem virke her. Ingen middel eller høj.

## Ærlige grænser

- **Ikke en rigtig telefon:**
  - Headless Google Chrome og Chromium på Windows, ikke en telefon, ikke Safari og ikke Firefox.
  - Touch er Playwrights, og "4 gange langsommere CPU" er Chromes bremse.
  - HEVC virker her, fordi Windows på denne pc har en HEVC-afkoder.
- **Klippene er mine:** kodet af ffmpeg med en telefons bitrate, korn og billedtider, ikke optaget af en telefon. De har ingen rotationsmærke og ingen lyd. En iPhones MOV kan have andre B-billeder og redigeringslister.
- **Hop til:** navet er klikket præcis, hvor jeg tegnede det. Støjen er kun med i regningen, ikke i browseren. Squattene har en stille bund (sinus og cosinus), som Yantras grænse siger.
- **Hukommelsen:** den er browserens processer på en pc, ikke en telefons grænse for en fane, og den er ikke målt færdigt efter "Luk videoen".
- **Grænserne:** ingen rigtige atleter eller klip. Klippene ligger i `%TEMP%\kritik-582-klip`, ikke i repoet. Løftmodellen er ikke rørt.
