Instagram 7-12 klar til Marcs godkendelse: ja

# Kritik 645, blok 1: Instagram 8 og 10 og værktøjssiden efter Setus 636 (Bhishak)

**Domme:**
- **Instagram 7-12 klar til Marcs godkendelse: ja.** I8 (nr. 10) og I9 (nr. 8) fra 631 er lukket. Marcs regler holder i alle seks. 7, 9, 11 og 12 er ikke rørt siden 631.
- **Værktøjssiden klar til Marcs deploy: ja**, fra `vaerktoejer` @ `ed32064`. Den har løftmodellens nyeste Mål dit billede: kopien er `main` @ `0d4d11f`, og løftmodellens `main` står stadig der. Alle 55 filer i de syv mapper er `0d4d11f` blob for blob.

## Hvad jeg målte

- **Instagram:** `outputs/kritik-645/insta-645.mjs`, som er min `insta-631.mjs` med I8- og I9-tjekkene vendt om til lukke-tjek. Kilderne er `ordrer/kilder/setu-624/` (Setu har rettet 8 og 10 der), `setu-636/foer-636/` (8 og 10 før rettelsen) og `Desktop/LAES-INSTAGRAM-2.html`. Alt er kun læst. Resultat: **20/20** (`insta-645.json`).
  - Det samme regeltjek som 631 på alle seks slides og billedtekster, og nu også på etiketterne i den nye tegning.
  - Marcs udsagn i 7 og 10 er holdt op mod `SVAR-squat.md`, og tallene i 8, 9, 11 og 12 mod løftmodellens figursider (`entropi-loeftmodel-dhruva/dist`, `main` @ `0d4d11f`).
  - Gentagelse af 1-6 er målt på figurfil, beskæring og sætning. Nu tælles kun de tegninger, `slides.mjs` faktisk bruger.
  - Nr. 10's PNG'er er holdt op mod `foer-636` byte for byte. 7, 9, 11 og 12 er holdt op mod mine tal fra 631.
  - LAES-INSTAGRAM-2 er åbnet som `file://` i Google Chrome headless, 390 med touch og 1280 med mus, uden net. Kontaktark af alle 20 slides er lavet i 360 px (`I-645-ark-*.png`).
- **Værktøjssiden:** `outputs/kritik-645/sitet-645.mjs`, som er min `sitet-632.mjs` (maal-617 på maal-610). `VARIANT=som-er` kører på sitet, som det er committet. Resultat: **17/17** (`sitet-645-som-er.json`, `M-*-645-som-er-*.png`).
  - Sitet er hentet med `git -c core.autocrlf=false archive vaerktoejer` fra `entropi-coaching-site-wt2`. Træet er ikke rørt og står stadig på `udgivelse-squat-min-krop`.
  - Løftmodellen er hentet med `git archive` af `0d4d11f`.
  - Google Chrome 154 headless, 390 med touch og 1280 med mus. Serveren er lokal, og alt andet net er afbrudt.

## Instagram, fund for fund

- **I8 (nr. 10): lukket.**
  - Slide 3 er nu tegningen `stangens-plads`. Den viser en ryg set fra siden med "højt på ryggen", "lavt på ryggen (lowbar)", "styrkeløfternes bias" og en kasse med "undtagelsen: mobilitet eller tidligere skader". Tegningen kalder ikke `model(`, så der er ingen løftmodelfigur i 10.
  - Slide 1 og 2 er de samme som før, byte for byte. Slide 3 og 4 er nye.
  - Billedtekstens sidste afsnit starter med "Tegningen er en skitse af de to pladser på ryggen ...". Det har forbeholdet ("ikke målt på en løfter").
  - 0 sætninger er fælles med 1-6, bortset fra henvisningen. Den eneste figur, der går igen fra 1-6, er opstillingen i 11 (I8b, valgfri, som i 631).
  - Tegningen passer til slidens tekst: stangens plads, bias mod lowbar og undtagelsen. Den er let at læse i 360 px.
- **I9 (nr. 8): lukket.**
  - Billedteksten siger nu: "Figurerne viser samme øjeblik, men med knæene strakt mere, før stangen slipper, så skinnebenet står lodret. Modellen står svagt bagved."
  - Det passer med figurerne. I `dl-hofte-foerst-model.svg` står "knæ 98° ... skinneben 14°", og i `dl-hofte-foerst.svg` står "knæ 127° ... skinneben 0°".
- **Marcs regler i alle seks:**
  - 0 tankestreger, 0 opfordringer, 0 dramatiske åbninger, 0 meta, 0 "Marc", 0 kilo, 0 Nm og 0 atletnavne.
  - 0 minusprocenter, 0 "vægten flytter" og ingen engelske fagord ud over Marcs egne.
  - Alle seks slutter med henvisningen. Forbeholdet står i sidste afsnit og på sidste slide i de fire karruseller.
  - Billedteksterne er 652-945 tegn, og den længste slidetekst er 188 tegn.
- **7, 9, 11 og 12:** samme antal tegn og slides som i 631. `slides.mjs` afviger fra `foer-636` i præcis to linjer, begge i nr. 10.
- **LAES-INSTAGRAM-2:**
  - 20/20 billeder, byte for byte de nuværende PNG, og 6 billedtekster og 6 kopiknapper.
  - To "Rettet efter Bhishaks 631"-noter og svarformen `instagram ok 7-12`.
  - 0 JS-fejl, 0 kald ud, ingen sidelæns rulning og 0 tankestreger på 390 og 1280.

## Værktøjssiden

- **`ed32064` ligger oven på `1169b5f`,** og alt siden 607 ligger under `assets/vaerktoejer/` (13 filer).
- **Filerne:** de syv mapper (maal-billede 10, tre-loeft 3, min-krop 4, baenk-figurer 10, loeft-fejl 8, squat-figurer 8, doedloeft-figurer 12) er `0d4d11f` blob for blob. Ingen fil mangler.
- **10 sider** på 390 og 1280 har 0 fejl 404, 0 JS-fejl, ingen sidelæns rulning og ingen brudte billeder, med 106 links.
- **Værktøjssiden:**
  - Den har `noindex, nofollow`, og 607's disclaimer er sidste element i `<main>` med 0 px til bunden.
  - `robots.txt` siger `Disallow: /assets/vaerktoejer/`.
- **Mål dit billede på sitet:**
  - 8 miniaturer uden felter, og "Ligner" virker.
  - M5: en fil uden endelse åbnes.
  - Gem og åbn igen virker i tre runder på 390 og 1280.
  - Før og efter med datoer og Byt virker.
  - M6 og M18 er lukket.
  - Video kan spoles og give et billede på 320 px.
- **Uger:**
  - Tre gemte målinger valgt i blandet orden står 3. aug., 17. aug. og 28. sep. med "forskel fra 3. aug. 2026" og 6 guldceller.
  - Under hver dato står "1 runde" (637's M25).
  - "Gem ugerne med tallene" giver et PNG på 1200 × 2118 px uden måling.
  - Tabellen ruller inde i sin boks på 390, men siden ruller ikke sidelæns (M22 fra 632 står).
- **Kald ud:** 0, og serveren svarede aldrig 404.

## Fund

| Fund | Alvor | Hvor | Status | Hvad |
|---|---|---|---|---|
| I8 | middel | nr. 10 | lukket | Ny tegning og ny sætning, ingen gentagelse af 1-6. |
| I9 | lav | nr. 8 | lukket | "knæene strakt mere ... så skinnebenet står lodret" passer med 98° til 127° og 14° til 0°. |
| I8b, I10-I13 | lav | 8-11 | står, valgfri | Som i 631. |
| I14 | lav | nr. 10 | ny, Marcs valg | "højt på ryggen" er Setus ord. Marc har kun sagt "lowbar" og "bias mod lowbar". Setu siger det selv i 636. |
| I15 | lav | Setus `tegn.mjs` | ny, valgfri | Den ubrugte tegning `sq-lowbar` med 1's figur står stadig i `tegn.mjs`. Den er ikke i noget opslag, men den kan komme med igen, hvis nogen genbruger navnet. Setu kan slette den. |

M-fundene fra 639 (M22 og M25 til M29) gælder løftmodellen og er ikke åbnet igen her.

## Ærlige grænser

- **Kun det, mine scripts tjekker.** 637's ændringer (M22, M25, M26) har jeg kun set som "1 runde" og "0,0 cm*" i skærmbilledet af Uger (`M-390-645-som-er-uger.png`). Jeg har ikke målt dem igen, som jeg gjorde i 639 med 634.
- **Headless Chrome på Windows,** ikke Instagram på en telefon og ikke Safari. Kopiknapperne er talt, ikke trykket.
- **Tallene** er holdt op mod figursiderne og SVG'erne, ikke regnet igen i løftmodellen.
- **Kun syntetiske billeder og klip.** Navnetjekket fanger kun navnene i appens `.gitignore`.
