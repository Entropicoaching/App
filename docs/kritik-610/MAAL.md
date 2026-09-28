Maal dit billede stadig klar til sitet: ja

**Ja, og Setu skal kopiere den nye udgave nu.** 608 blev merget, mens jeg målte (`main` `f3e0200`). Den lukker min betingelse fra 603:
- **M1 er lukket:** miniaturerne har ingen mørke striber længere.
- **M4 er lukket:** en fil, siden ikke kan bruge, siger det nu.

Det nye i 599, 601 og 608 holder, med mine egne scripts. Mine to nye fund, M5 og M6, er lave og stopper ikke kopien.

**Setu kopierer i én kopi fra løftmodellens `main` (`f3e0200`):**
- `dist/maal-billede/` hel, med `miniaturer/`. Mod sitet er det `index.html`, `maal-billede.js` og alle 8 miniaturer.
- `dist/tre-loeft/tre-loeft.js` og `dist/min-krop/min-krop.js` (W7).
- `dist/baenk-figurer/index.html` (BA1). M2 står stadig, men stopper ikke kopien.
- Intet andet. Fejlsiden og squat- og dødløftfigurerne er ens med sitet.

# Kritik 610, blok 1: Mål dit billede efter Yantras 601 og 608

Bhishak, 28. sep 2026. Ordre 610.

**Løftmodellen:** `entropi-loeftmodel-dhruva`, hentet med `git archive`. Intet træ er rørt.
- Da jeg begyndte, stod `main` på `207d4ec`, det samme, jeg målte i 603. 608 lå på `ordre-608` med én commit (M1).
- **Mens jeg målte,** kom commit 2 (`82fbc53`, M4) og commit 3 (`d8921bd`, rapport dag 91), og derefter blev 608 merget: `f3e0200`.
- Hele målingen er kørt igen på `f3e0200`. Tallene nedenfor er derfra.
- "Før" er `207d4ec` (601 alene).
- Siden 603 er kun `maal-billede/maal-billede.js` og de fire miniaturer i bænken og dødløftet ændret i dist.
- Yantras `docs/RAPPORT-dag-90.md` og `-91.md` er læst.

**Sitet:** `entropi-coaching-site-wt2`, grenen `vaerktoejer` @ `c9fc559`, hentet med `git archive`. Sitets `maal-billede/` er stadig 580-udgaven (`291f5bf`).

## Hvad jeg målte

`outputs/kritik-610/maal-610.mjs` giver **17/17 grønne tjek** (`maal-610.json`, `maal-610.log`, `M-*.png`).

- Siden er målt i sitets kopi med `dist/maal-billede/` lagt oven i, fra 601 (`/m601/`) og fra `main` (`/m608/`).
- Google Chrome 154 headless: 390 med touch, 1280 med mus. Alt net uden for den lokale server er afbrudt, og der var 0 netkald.
- Filerne er gemt med sidens egen Gem-knap og åbnet med den rigtige filvælger. Filvælgeren fik det navn og den type, en telefon kunne give.
- Mine egne PNG-læser og -skriver laver varianterne, ikke Yantras `maalGemt.js`.
- Billederne er syntetiske flader, klikket med modellens egne punkter.
- 0 JS-fejl i alle 36 åbninger.

## Dag 91: M1 og M4

### M1: miniaturerne (lukket)

- **Felterne er væk:** 0 af de mørke felter i alle otte miniaturer, mod 3 i hver af bænkens og dødløftets fire før. Squattens fire er byte for byte de samme.
- **Kun felterne er taget ud:** hver miniature er linje for linje 601's uden de tre felter.
  - Bænkens to er beskåret 3,19 enheder smallere i venstre side (ca. 1,2 px ved 150 px), fordi et felt stod ved kanten. Det sagde Yantra selv.
  - Tegnet i Chrome er 608's miniature pixel for pixel den samme som 601's med felterne fjernet af mig: **0 pixels forskel, altså 0 % dækket**. I 598 var det 5,8-14,2 %.
- **Yantras spørgsmål om stregerne for momentarmene:** de står uden tal som tynde lyseblå streger med små ender (`M-390-608-miniaturer.png`). De er langt tyndere end kroppen og ligger ikke over hånden eller stangen. De skader ikke. I "stangen glider frem" viser stregen ved stangen netop, hvor langt stangen er fra midtfoden.

### M4: en måling, siden ikke kan bruge (lukket)

Det er mine filer fra 603, lavet med rigtig CRC:

| Fil | 601 | `main` (608) |
|---|---|---|
| ødelagt CRC | stille som billede | billede uden klik + noten |
| afkortet inde i målingen | stille som billede | billede uden klik + noten |
| version 2 | stille som billede | billede uden klik + noten "fra en nyere udgave af siden" |
| ukendt fase | stille som billede | billede uden klik + noten |
| forkert størrelse | **7 klik på forkerte steder** | billede uden klik + noten |
| dato 2026-13-45 | "gemt 45.  2026" | "Gemt måling åbnet:" uden dato, 7 klik |
| afkortet i billedet (60 %) | halvt billede | halvt billede, ingen note (intet spor af målingen er tilbage, og det er rigtigt) |

Noten står over knapperne, med en guldstreg ved siden af (`M-390-608-m4-note.png`): "Filen har en gemt måling, som siden ikke kan læse; billedet er åbnet uden klik. Filen er måske ødelagt eller skrevet om af et andet program."

**Er noten klar nok? (Yantras spørgsmål):** ja. Træneren får at vide:
- at der var en måling
- at klikkene ikke er kommet med
- at filen er skyld i det, ikke træneren

Hvad der præcist er galt, kan træneren alligevel ikke bruge til noget.

**Noten om en nyere udgave:** den er rigtig at have. Den er den eneste, der fortæller træneren, at fejlen går væk af sig selv, når siden er opdateret. Siden viser en ældre udgave fra cachen, mens filen kommer fra en nyere. Én note ville sige "ødelagt" om en fil, der er i orden. To sætninger koster intet.

## Dag 90: Yantras tre punkter

### 1. Overlever målingen en rigtig telefon?

**En telefon har jeg ikke.** Jeg har lavet de ting, en telefon eller et program kan gøre ved filen, og åbnet dem på `main` på 390 med touch:

| Hvad der sker med filen | Åbnes som |
|---|---|
| urørt | målingen |
| ekstra metadata før billedet (eXIf, XMP, Apples iDOT, tEXt, tIME), som Fotos eller Arkiver kan lægge i | målingen |
| målingen flyttet foran billedets data | målingen |
| navnet `IMG_0412.PNG` uden type | målingen |
| navn uden endelse (`1000012345`) med typen `image/png` | målingen |
| kun billedets egne dele (et program, der "optimerer") | billede, ingen note |
| tegnet om og gemt som PNG (redigeret, beskåret) | billede, ingen note |
| som JPEG (chat-app, iPhone "Mest kompatibel") | billede, ingen note |
| **navn uden endelse og uden type** | **billede, ingen note** (M5) |
| **`application/octet-stream`, navnet `download`** | **billede, ingen note** (M5) |
| **PNG'ets bytes med navnet `.jpg` og typen `image/jpeg`** | **billede, ingen note** (M5) |

**Svaret er:**
- Så længe filens bytes er de samme, holder målingen, også med ekstra metadata og i en anden rækkefølge.
- Skriver noget billedet om, er målingen væk, og siden kan ikke se, at den var der. Det står på siden.
- **M5 (lav, nyt):** `laesFil` kigger kun efter en måling, når filens type er PNG eller navnet ender på `.png`. Den kigger ikke på filens første 8 bytes. Giver telefonens vælger den urørte fil uden de to, åbnes den stille som et foto: træneren ser sin gamle tabel som billede, uden klik og uden note.
  - Jeg ved ikke, om Android-billedvælgeren eller iPhones Filer gør det. Android giver ofte `content://`-navne uden endelse. Men det koster én linje at gøre det sikkert: `erPng(bytes)` i stedet for type og navn.

**Om iPhones Fotos beholder delen, og om Safari gemmer filen urørt, kan jeg ikke svare på.** Det kræver en rigtig iPhone, og det må Marc prøve én gang: Gem → Arkivér i Fotos → Vælg billede → Fotobibliotek. Står der "Gemt måling åbnet", holder det. Står der intet, har Fotos skrevet filen om, eller vælgeren har givet den som JPEG. Så skal trænere bruge "Arkivér i Arkiver" (Filer).

### 2. Er det tydeligt, at filen har billedet, højden og vægten i sig?

Ja, som i 603. Teksten er den samme, målt ord for ord:
- **Under Gem:** "Filen har også målingen i sig (billedet, klikkene, fasen, højden og vægten) … En chat-app, der komprimerer billedet, smider målingen væk; gem selve filen."
- **"Intet gemmes, og intet sendes":** "Send derfor kun filen til nogen, der må se de tal."
- Noten under Gem kan ses på 390, når der er et billede (358 px bred).
- Højden og vægten står også synligt i selve billedet ("180,0 cm og 90,0 kg"), så en træner, der sender det, ser, hvad der sendes.

### 3. Før og efter fra filer: kan en træner tage fejl af ugerne?

Uge 1 er gemt 3. aug. og uge 8 er gemt 28. sep. Begge er åbnet fra fil, på `main` 390 og 1280 og på 601 390:
- **Rigtig rækkefølge:** "Før: IMG_4411.jpg (gemt 3. aug. 2026)" og "Efter: IMG_5120.jpg (gemt 28. sep. 2026)". Datoen står ved begge. Det er tydeligt.
- **M6 (lav, nyt): omvendt rækkefølge.** Åbner træneren uge 8 under Før og uge 1 under Efter, står "Før: … (gemt 28. sep. 2026)" og "Efter: … (gemt 3. aug. 2026)" (`M-390-610-forkert-orden.png`).
  - Hver forskel vender fortegn: torsoen −12,9° i stedet for +12,9°.
  - Sætningen læser forskellen baglæns.
  - Siden siger intet, selv om den kender begge datoer.
  - Byt retter det præcist, men kun hvis træneren selv ser datoerne.
  - Et foto, der hedder `IMG_4411.jpg`, siger ikke hvilken uge.
- **Er Byt til at finde?** Ja:
  - Byt står på linje med Før og Efter, 8 px fra Efter, og er 44 px høj.
  - Den er ikke i skærmen, når tallene er. Man ruller op til den, men det er ét stykke op, og det er i orden.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M1 | lukket | 608: 0 felter, 0 % dækket | |
| M4 | lukket | 608: noten for 5 slags ubrugelige filer, datoen tjekkes, og forkert størrelse giver ikke længere klik forkerte steder | |
| M5 | lav | En urørt gemt fil, som vælgeren giver uden `.png` i navnet og uden typen `image/png` (eller som `.jpg`), åbnes stille som et foto uden klik og uden note | Yantra: i `laesFil`, læs altid bytes og brug `erPng(bytes)` i stedet for type og navn. Filer, der ikke er PNG, går videre som før. |
| M6 | lav | Før og efter fra to filer i omvendt rækkefølge: datoerne står baglæns, hver forskel har omvendt fortegn, og siden siger intet | Yantra: har begge billeder en gemt dato, og er Før's senere end Efter's, så skriv under billederne: "Før er gemt senere end Efter. Tryk Byt før og efter, hvis det er omvendt." |
| M2 | lav | Står fra 598: bænkens figurside siger 10,5 / 1,7 / 8,2 cm | Yantra (han fravalgte den i 608) |
| M3 | lav | Står fra 598: `deadlift-animation.js`, ikke på sitet | Yantra |

**Ingen af M2, M3, M5 og M6 stopper Setus kopi.** M5 og M6 kan komme i næste kopi.

## Ærlige grænser

- **Ingen telefon.** Det hele er headless Google Chrome 154 på Windows, og touch er Playwrights.
  - Hvad iPhones Fotos, Arkiver, Safari og Android-billedvælgeren gør ved filen, er ikke målt. Mine varianter er gæt på, hvad de kan gøre.
  - Om M5 rammer en rigtig telefon, ved jeg ikke.
- **Filvælgerens navn og type** er sat af mig med `setInputFiles`, ikke af en telefons vælger.
- **Billederne er syntetiske flader,** ikke fotos af en atlet. Mit "JPEG fra en chat-app" er Chromes eget JPEG (0,8).
- **Datoerne i punkt 3** er skrevet ind i filen af mig. Det er samme format, som siden skriver.
- **Hvad en træner forstår** (noterne, datoerne, Byt) er min vurdering, ikke prøvet på en træner.
- **Yantras tests er ikke kørt.** Kun mine egne scripts.
- **Grænserne:** ingen rigtige atleter eller klip. Løftmodellen og sitet er ikke rørt.
