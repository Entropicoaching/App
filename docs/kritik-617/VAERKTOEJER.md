Vaerktoejssiden klar til Marcs deploy: ja

**Ja.** Sitets `vaerktoejer` står på **`1169b5f`** (Setus 620). Den kopi kom, mens jeg målte, og den er nyere end 600's `1bd6672`, som ordren nævner. Den er løftmodellens `4ca0c63` blob for blob. Alt, ordren beder om, er grønt i sitets egen kopi:
- miniaturerne uden mørke felter
- gem og åbn igen
- video
- 0 fejl 404
- disclaimeren nederst
- noindex

Mine M5 og M6 fra 610 er lukket på sitet. Et nyt, lavt fund (M18) stopper ikke noget: noten "Gemt måling åbnet" siger stadig "tryk Byt", efter man har trykket Byt.

# Kritik 617, blok 2: værktøjssidens kopi af Mål dit billede (Setu 600 og 620)

Bhishak, 28. sep 2026. Ordre 617.

**Målt på:**

| | Hash | Bemærkning |
|---|---|---|
| Sitet `vaerktoejer` | `1169b5f` | Setus 620 oven på 600 (`1bd6672`). Målt først på `1bd6672` (14/14 grønne), så igen på `1169b5f` |
| Løftmodellen, det Setu kopierede | `4ca0c63` | Yantras 611 og 616 (M2, M3, M5, M6) |
| Løftmodellens `main` nu | `287210d` | Yantras 621 kom undervejs ("Uger", `maal-billede.js` og `index.html`); ikke på sitet, og ikke en del af denne dom |

Alt er hentet med `git archive`. Hverken sitets træ (`entropi-coaching-site-wt2`) eller løftmodellen er rørt. Setus `RAPPORT-600.md` og `RAPPORT-620.md` (`ordrer\kilder\setu-600` og `setu-620`) er læst, og det samme er afsnit 1 på `LAES-VAERKTOEJER.html`.

## Hvad jeg målte

`outputs/kritik-617/maal-617.mjs` er mine egne tjek fra `maal-610.mjs`, nu på **sitets kopi** i stedet for løftmodellens dist. Siden serveres af en lokal server fra sitets arkiv og køres i Google Chrome 154 headless, 390 touch og 1280 mus. Alt net uden for serveren er afbrudt. Resultatet er **16/16 grønne** (`maal-617.json`).

| Tjek | Resultat |
|---|---|
| Kopien | De 13 filer, der er ændret siden 607 (`c9fc559`), ligger alle under `assets/vaerktoejer/` og er `4ca0c63`'s blob for blob. Det samme gælder alle andre filer i de syv mapper. Ingen fil mangler. |
| Sider | 10 sider (værktøjssiden og alle `.html` under `assets/vaerktoejer/`) på 390 og 1280: 0 fejl 404, heller ikke blandt de 106 lokale links og kilder, som jeg har slået op én for én. 0 JS-fejl, ingen sidelæns rulning og ingen brudte billeder. Kun skrifttypen prøvede at hente udefra. |
| noindex | Værktøjssiden har `noindex, nofollow`. Selve værktøjerne har ingen robots-meta, men sitets `robots.txt` siger `Disallow: /assets/vaerktoejer/`, og værktøjssidens links har `rel="nofollow"`. |
| Disclaimeren | 607's tekst er det sidste element i `<main>`, og intet står under den (`M-390-617-disclaimer.png`). |
| Miniaturerne | 8 filer med 0 `fill-opacity="0.78"`. Det er de samme blobs, som jeg i 610 målte pixel for pixel uden felter. Alle 8 id'er, som "Ligner" kan vise (bp, dl og k7 bund/sticking), har en fil i sitets `miniaturer/`, og alle 8 indlæses fra sitets sti (`M-390-617-miniaturer.png`). |
| "Ligner" | Stangen 12 cm frem ved knæet giver "Ligner: stangen glider frem" med miniaturen indlæst fra `miniaturer/dl-stang-frem.svg` på 390 og 1280 (`M-390-617-ligner-dl-knae.png`). |
| Gem og åbn igen | Tre runder i træk, hver i en frisk side, på 390 og 1280: dl-gulv, 7 klik, 180 cm, 1000 px og "Gemt måling åbnet" hver gang (`M-390-617-aabnet-igen.png`). |
| Før og efter | To filer med hver sin dato: datoen står ved begge, hoften har en forskel, og Byt vender en forkert rækkefølge til den rigtige tabel (`M-390-617-foer-efter.png`). |
| M5 (610) | En urørt fil uden `.png` og uden type, som `application/octet-stream` med navnet `download` og som `.jpg` med typen `image/jpeg`: alle tre åbnes som målingen med 7 klik og noten. **Lukket.** |
| M6 (610) | Forkert rækkefølge giver advarslen over tabellen: "Før er gemt 28. sep. 2026 og efter 3. aug. 2026, så før er det nyeste billede ... Tryk Byt før og efter ...". Rigtig rækkefølge giver den ikke, og efter Byt er den væk. **Lukket.** |
| Video | Et webm-klip, lavet i browseren, åbnes, kan spoles, og "Brug dette billede" giver et billede på 320 px at måle på, på 390 og 1280 (`M-390-617-video.png`). |

**Rødt undervejs, alt i mine egne tjek:**
- Et regex, der mistede sin backslash, da jeg rettede scriptet. Det fjernede alle "s" i en tekst.
- Mit M6-tjek ledte efter noten, ikke advarslen over tabellen. Det førte til M18.
- Løftmodellens `main` flyttede to gange (`4ca0c63` og så `287210d`), så kilden er nu låst til det, Setu kopierede.

## Setus punkter

Fra RAPPORT-600, "Bhishak bør tjekke":
1. **"De 13 filer er `f3e0200`'s blob for blob, og intet andet er ændret."** Ja for 600. På 620 er de `4ca0c63`'s, og intet uden for `assets/vaerktoejer/` er ændret siden 607.
2. **"Alle 8 miniaturer indlæses fra sitets stier under 'Ligner'."** Alle 8 filer findes og indlæses fra `miniaturer/`, og alle 8 id'er, "Ligner" bygger stien af, har en fil. Selve "Ligner" har jeg ligesom Setu kun fremkaldt for stangen frem. Hoften 36 px højere ved gulvet gav "Ligner ikke 'hoften stiger først' over målefejlen".
3. **"Gem og åbn igen, før og efter fra to filer og Byt i sitets kopi."** Ja (tabellen). Det gælder også M5 og M6, som kom med 620.
4. **"Bænkens figurside, Min krop og De tre løft som i 610."** De åbner uden fejl, uden 404 og uden sidelæns rulning på 390 og 1280, og de er løftmodellens filer blob for blob. Deres regning (611's M2 og M3) har jeg ikke målt igen på sitet.
5. **"Disclaimeren og 'Nyt i Mål dit billede' på læsesiden."** Disclaimeren er rigtig. Afsnittet "Nyt i Mål dit billede" siger ikke mere, end siden gør, med én undtagelse: "Efter Byt er advarslen væk" gælder advarslen over tabellen. Noten over billedet siger det stadig (M18).

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M18 | lav | Efter Byt står noten "Gemt måling åbnet (gemt 3. aug. 2026) ... Før er gemt senere end efter; tryk Byt før og efter ..." stadig over billedet, selv om før nu er det ældste (`M-390-617-efter-byt-note.png`, 390 og 1280). Advarslen over tabellen er væk, som den skal. | Yantra: skriv noten om ved Byt, eller tag sætningen ud af noten, for advarslen over tabellen siger det allerede. Setu: kopiér, når det er rettet. Det stopper ikke deploy. |

**Lukket på sitet:** M1 (600), M5 og M6 (620). Mine M2 og M3 fra 598 er lukket i løftmodellen (611) og ligger på sitet med 620, men jeg har ikke målt dem igen der.

## Ærlige grænser

- **Ingen telefon.** Headless Google Chrome på Windows, ikke Safari eller Android. Om iPhones Fotos beholder målingen, er ikke prøvet (Setus og min grænse fra 610).
- **Videoen er et webm-klip lavet i browseren,** ikke et klip fra en telefon (MP4, MOV, HEVC).
- **Sitet serveres af min egen lokale server,** ikke GitHub Pages. Sti-store bogstaver og cache er ikke prøvet.
- **"Ligner"** er kun fremkaldt for én af de otte fejl. De andre syv miniaturer er indlæst direkte.
- **Min krop, De tre løft og bænkens figurside** er kun åbnet og sammenlignet blob for blob, ikke regnet igen.
- **Løftmodellens 621** er ikke på sitet og er ikke en del af dommen.
- **Kun syntetiske billeder** (ensfarvede flader og modellens egne punkter). Ingen atleter, ingen atletdata, og sitets træ er ikke rørt. Intet er pushet eller deployet.
