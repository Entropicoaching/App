Maal dit billede klar til Setus kopi: nej

**Nej, endnu ikke.** Det nye virker: "Gem billedet med tallene" (599), piletasterne (599), at den gemte fil kan åbnes igen, og før og efter fra en fil med Byt (601). Jeg har ingen fund i dem, der skal rettes før en kopi. Men mit **M1 fra 598 står uændret**: bænkens og dødløftets fire miniaturer i "Ligner" har stadig tre mørke striber tværs over kroppen, i "stangen glider frem" lige over hånden og stangen. `src/miniature.js` og `miniaturer/` er ikke rørt siden 598. Det er det første, en træner ser, når siden finder en fejl.

**Når Yantra har rettet M1, kopierer Setu i én kopi** fra løftmodellens `main` (i dag `207d4ec`, plus Yantras M1-commit):
- `dist/maal-billede/` hel, med `miniaturer/`. Mod sitet er det `index.html`, `maal-billede.js` og alle 8 miniaturer. Kopieres kun de to filer, er alle miniaturer brudte (målt i 598).
- `dist/tre-loeft/tre-loeft.js` og `dist/min-krop/min-krop.js` (W7, DA7 fra 595).
- `dist/baenk-figurer/index.html` (BA1 fra 593). Helst efter M2, men M2 stopper ikke kopien.
- Intet andet: fejlsiden, squat- og dødløftfigurerne er ens med sitet.

Indtil da står 580-udgaven på sitet (`291f5bf`, godkendt i 585), og den er stadig i orden.

# Kritik 603, blok 1: Mål dit billede efter Yantras 599 og 601

Bhishak, 28. sep 2026. Ordre 603.

**Løftmodellen:**
- `entropi-loeftmodel-dhruva` `main`, hentet med `git archive`. Træet er ikke rørt.
- Da jeg begyndte, stod `main` på `03c929e` (599 merget, den jeg målte i 598). 601 lå som tre commits på `ordre-601` (`d80f167`, `37bfac6`, og undervejs `ee5479f` med rapport dag 90).
- **Mens jeg målte, blev 601 merget: `207d4ec`.** Dist på `main` er blob for blob `ordre-601`. Jeg har kørt hele målingen igen på `207d4ec`.
- Siden 598 er kun `dist/maal-billede/index.html` og `maal-billede.js` ændret i dist.
- Yantras `docs/RAPPORT-dag-89.md` og `-90.md` er læst, og min egen `docs/kritik-598/MAAL.md`.

**Sitet:** `entropi-coaching-site-wt2`, grenen `vaerktoejer` @ `11c6169`, hentet med `git archive`. Sitets `maal-billede/` er stadig 580-udgaven.

## Hvad jeg målte

`outputs/kritik-603/maal-603.mjs` giver **25/25 grønne tjek** (`maal-603.json`, `maal-603.log`, `M-*.png`).

- Siden er målt i sitets kopi med `dist/maal-billede/` lagt oven i: 599 alene (`03c929e`) og `main` (`207d4ec`, 599 og 601).
- Google Chrome 154 headless: 390 med touch, 1280 med mus. Alt net uden for den lokale server er afbrudt: 0 netkald.
- **Knapperne er de rigtige:** jeg trykker Gem, Sammenlign og Byt, og filen tages fra browserens download. Filerne åbnes med den rigtige filvælger.
- **Min egen PNG-læser** (CRC, delene, JSON og JPEG'ets dele) læser de gemte filer, ikke Yantras `maalGemt.js`.
- **Billederne er syntetiske:** flader uden atlet, klikket med modellens egne punkter. Videoen er mit VFR-klip fra 582.

## Hvad Setu kopierer

| Mappe | Sitet (`11c6169`) mod `main` (`207d4ec`) | Fra ordre |
|---|---|---|
| `maal-billede/` | `index.html`, `maal-billede.js`, 8 miniaturer | 593, 599, 601 |
| `tre-loeft/` | `tre-loeft.js` | 595 (W7) |
| `min-krop/` | `min-krop.js` | 595 (W7) |
| `baenk-figurer/` | `index.html` | 593 (BA1) |
| fejlsiden, squat- og dødløftfigurerne | ens | |

**Rækkefølgen:** M1 først (Yantra), så kopien (Setu). M1-rettelsen ændrer `miniaturer/`, så en kopi før rettelsen skulle laves om.

## Yantras punkter

### 599: Gem billedet med tallene

**Filen er rigtig.** Trykket på Gem giver på 390 og 1280 en fil, `maal-dl-gulv-uge-1-doedloeft.png`, et PNG på 1200 × 1629 med rigtig CRC i alle dele. Med 599 alene er delene kun IHDR, IDAT og IEND. Med 601 kommer `enTr` til.

**Tabellen i billedet er sidens.** Alle 5 rækker og tal er de samme; kun et mellemrum efter ≈ er anderledes.

**Intet sendes:**
- 0 netkald.
- `localStorage` og `sessionStorage` er tomme før og efter Gem.
- 0 JS-fejl.

**"Siger det gemte billede mere, end siden ved?"** (Yantras spørgsmål): nej. Jeg har set på billedet (`M-601-gemt-fil-synlig-del.png`):
- Titlen, billedet med klik og modellen står side om side, så tabellen, noterne, tærsklen og modellens grænse nederst.
- Det er til at læse på 1200 px og kan sendes alene.
- Modellen fylder lidt i sin ramme, men den er tegnet i samme skala som billedet, så det er ærligt.

**"Ligner"-linjen skal ikke med.** Den kræver sine links og forbehold, og miniaturerne har M1.

### 599: piletasterne

Målt med mit VFR-klip fra 582 på 599 alene og på `main`, 1280 og 390:
- **Fem tryk →** og ét ← giver 0, 1, 2, 3, 4, 5, 4.
- **Med skyderen i fokus** er → ét billede, ikke 1 ms.
- **I højdefeltet,** på en knap uden for Mål dit billede (min "anden figur") og med Shift sker intet.
- **En holdt tast** (12 gentagelser) har højst 2 trin i kø, og hvert trin er ét billede.
- **Efter Luk videoen** er piletasterne sidens egne igen (`defaultPrevented` er falsk), og siden ruller.
- 0 JS-fejl.

Noten om tasterne er skjult på 390 med touch og står på 1280 med mus, som den skal.

**En artikel med flere figurer findes ikke på sitet endnu.** Knappen uden for siden er min erstatning.

### 601: den gemte fil åbnes igen

**Frem og tilbage:** filen åbnes med Vælg billede i en ny side på 390 og 1280. Klikkene er de samme til sidste decimal, og det samme gælder fasen, 180 cm, 90 kg, 200 kg og alle rækker i tabellen. Noten siger "Gemt måling åbnet (gemt 28. sep. 2026): dødløft, ved gulvet, 7 klik. ...". Lageret er tomt.

**Uge efter uge:** jeg har åbnet og gemt den samme fil 8 gange i træk, som en træner, der bruger uge 1-filen igen og igen. Billedet bliver ikke mærkbart dårligere, selv om det er et JPEG hver gang:

| Gang | 1 | 2 | 4 | 8 |
|---|---:|---:|---:|---:|
| Middel afvigelse fra første gang (af 255) | 0 | 0,007 | 0,015 | 0,021 |
| Største afvigelse i én pixel | 0 | 5 | 9 | 12 |

Klikkene står alle 8 gange.

**Et fotos EXIF følger ikke med.** Jeg lagde en syntetisk "GPS"-tekst i et JPEG's EXIF. Den gemte fil har den ikke, hverken i billedet eller i målingen, for billedet er tegnet om.

**Store fotos:**

| Foto | Gemt som | Fil | Gem |
|---|---|---:|---:|
| 4032 × 3024 (12 mio. pixels, med støj) | 4032 × 3024 | 6,9 MB | 0,4-1,1 s |
| 6000 × 4000 (24 mio.) | 4899 × 3266 | 7,7 MB | 0,7-1,0 s |

Tabellen er den samme efter åbning. 4899 × 3266 er 16.000.134 pixels, 134 over Yantras egen grænse, men et godt stykke under Safaris 16.777.216. Det betyder intet. Filen er stor (7 MB med et rigtigt foto), men den kan sendes med mail.

**"Er det rigtigt, at filen har billedet, højden og vægten i sig?"** (Yantras spørgsmål): ja, og det er ærligt sagt:
- Højden og vægten står allerede synligt i billedet: "Grå: modellen, gennemsnitlige proportioner for 180,0 cm og 90,0 kg".
- Det eneste, filen bærer skjult, er:
  - datoen
  - fotoets filnavn, som ofte også står i det gemte filnavn
  - fotoet uden klik, som man alligevel ser med klik
- Sidens note under knappen og afsnittet "Intet gemmes" siger det, og siger "send kun filen til nogen, der må se de tal". Det er tydeligt nok.

**Filer, siden ikke selv har lavet.** Jeg lavede 9 filer med rigtig CRC:

| Fil | Hvad siden gør |
|---|---|
| HTML og `onerror` i billedets navn | vises som tekst uden < > |
| `<svg onload>` i højden | højden afvises |
| `text/html` som billedtype | afvist |
| ødelagt CRC | åbnes som almindeligt billede uden klik |
| afkortet fil | åbnes som almindeligt billede uden klik |
| version 2 | åbnes som almindeligt billede uden klik |
| et 8000 × 8000-billede | åbnet på 1,4 s |

Ingen kode kører, intet HTML kommer ind på siden, og der er 0 JS-fejl.

To ting tjekkes ikke (M4, lav):
- Datoen "2026-13-45" bliver til "gemt 45.  2026".
- Et billede, hvis størrelse ikke passer med filens tal, åbnes med klikkene forkert placeret (`M-390-601-forkert-stoerrelse.png`).

Kun en fil lavet uden for siden kan det, og intet af det er farligt. Men **en fil med en måling, siden ikke kan bruge, åbnes stille som et almindeligt billede**: træneren ser sit gemte billede med tabel som "foto" og ingen besked om, at målingen ikke kunne læses. En chat-app, der smider delen væk, er beskrevet på siden. Men en fil fra en senere version eller en ødelagt fil er ikke.

### 601: før og efter fra en fil

Som en træner på 390 og 1280: uge 1 åbnes fra filen, Sammenlign trykkes, og uge 8 vælges under Efter med hoften 20 px højere.
- **Billedteksten** er "Før: Uge 1 dødløft.png (gemt 28. sep. 2026)" og "Efter: Uge 8 dødløft.png". Byt er slået til.
- **Byt** vender billedteksterne og fortegnet på hver forskel (torso +6,9° → −6,9°, hoften +6,6 cm → −6,6 cm). Byt igen giver præcis det samme som før.
- **Gem før og efter med tallene** giver én fil, `maal-dl-gulv-foer-efter.png`, med begge billeder og deres klik. Åbnet i en ny side står begge med samme tabel og "Gemt før og efter åbnet (gemt 28. sep. 2026)".
- **En dødløftfil under Efter, mens Før er squat,** afvises med "Fasen er fælles for de to, så målingen er ikke åbnet". Efter er urørt.

Se `M-390-601-foer-efter.png`.

**"Er noten og datoen nok til, at en træner ikke tager fejl af ugerne? Er Byt til at finde?"** (Yantras spørgsmål):
- Datoen står ved det gemte billede, og filnavnet ved begge. Det er nok, når træneren navngiver sine fotos med ugen.
- Et foto, der hedder `IMG_4411.jpg`, siger kun datoen. Den er den dag, der blev trykket Gem, ikke løftets dag. Det skriver Yantra selv.
- Byt står lige ved Før og Efter og kan ikke overses.

### M1-M3 fra 598

- **M1 (middel): står.** Stadig 3 felter i hver af `bp-albue-ud`, `bp-hoejt-bryst`, `dl-hofte-foerst` og `dl-stang-frem`, 0 i squattens fire. `src/miniature.js` er ikke rørt.
- **M2 (lav): står.** Bænkens figurside siger stadig "10,5", "1,7" og "8,2 cm".
- **M3 (lav): står.** `deadlift-animation` er ikke rørt og er ikke på sitet.

Yantra valgte 599 og 601 frem for M1-M3 (rapport 89 og 90 nævner dem ikke). 599 og 601 var det, han skulle vælge. Men M1 var min betingelse for Setus kopi.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M1 | middel | Står fra 598: de fire miniaturer i bænken og dødløftet har tekstens mørke baggrundsfelter tilbage, 5,8-14,2 % af figuren dækket, i "stangen glider frem" over hånden og stangen. | Yantra: fjern `rect` med `fill-opacity="0.78"` i `src/miniature.js`, som `<text>`, og test, at intet tegnet dækkes. Byg og skriv miniaturerne igen. Så kan Setu kopiere. |
| M2 | lav | Står fra 598: bænkens figurside siger "10,5", "1,7" og "albuens 8,2 cm kortere"; figurernes viste tal giver 10,4, 1,8 og 7,6 → 0,6 på den anden side. | Yantra: regn af de viste tal, som i DA7 og BA1. |
| M3 | lav | Står fra 598: `dist/deadlift-animation.js`, 18 af 108 sætninger afviger 0,1 fra parentesen. Ikke på sitet. | Yantra, når han er i nærheden. |
| M4 | lav | 601: en fil med en måling, siden ikke kan bruge (ødelagt, afkortet, version 2, forkert billedtype), åbnes stille som et almindeligt billede uden besked. Og datoen og billedets størrelse i filen tjekkes ikke ("gemt 45.  2026"; klik forkert placeret). Kun filer lavet uden for siden eller ødelagt undervejs. | Yantra: har filen en `enTr`-del, der ikke kan bruges, så sig "Filen har en gemt måling, som siden ikke kan læse; billedet er åbnet uden klik." Tjek datoen (måned 1-12, dag 1-31) og at billedets størrelse er filens `w` × `h`. |

**Lukket i 599 og 601:** intet af mine gamle, men heller intet nyt, der skal rettes før en kopi.

**Står:** W7 (tre-løft og min-krop er ikke på sitet), fordi Setu ikke har kopieret siden 591.

## Ærlige grænser

- **Ingen telefon:** headless Google Chrome 154 på Windows, ikke Safari og ikke Android. Touch er Playwrights.
  - Om Safari på iPhone gemmer filen, og om iPhones Fotos beholder `enTr`-delen, er ikke målt. Det var Yantras første spørgsmål, og det kan jeg ikke besvare herfra.
- **Downloaden** er Playwrights download-hændelse, ikke en rigtig mappe med Chromes egen oprydning.
- **"Ikke mærkbart dårligere"** er målt som pixelafvigelse i hver 97. farveværdi, ikke af en træner.
- **Billederne er syntetiske flader** klikket med modellens punkter, ikke fotos af en atlet. Mit store "foto" er støj, som giver et større JPEG end et almindeligt foto.
- **Piletasterne i en rigtig artikel** med flere figurer er ikke prøvet. Sitet har ingen endnu.
- **Hvad en træner forstår** (noten, datoen, Byt) er min vurdering, ikke prøvet på en træner.
- **Yantras tests er ikke kørt.** Kun mine egne scripts.
- **Grænserne:** ingen rigtige atleter eller klip. Løftmodellen og sitet er ikke rørt.
