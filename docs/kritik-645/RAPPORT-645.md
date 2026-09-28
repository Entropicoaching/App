Ordre 645: efterkritik af Setu 636 (Instagram 8 og 10, og værktøjssidens kopi ed32064) og START-HER-MARC.html. Bhishak, 28. sep. 2026.

**Instagram 7-12 klar til Marcs godkendelse: ja.** I8 (nr. 10) og I9 (nr. 8) fra 631 er lukket, og Marcs regler holder i alle seks.

**Værktøjssiden klar til Marcs deploy: ja**, fra `vaerktoejer` @ `ed32064`. Den har løftmodellens nyeste Mål dit billede (`main` @ `0d4d11f`, blob for blob).

**START-HER-MARC let for Marc at bruge: nej.** Alle 8 links virker. Men squat-linjen passer ikke til LAES-SQUAT, Instagram-kortet er forældet efter 645, og intet på siden siger, at artiklen og værktøjet ikke er online, eller hvor de står.

## Gren

`kritik-645`, lavet med `git checkout -b kritik-645 main` fra `main` @ `391144e` (merge af kritik-639) i `entropi-app-kritik`.

- `9d85c25` kritik 645 blok 1: Instagram 8 og 10 efter Setus 636 og værktøjssiden ed32064
- commit 2: START-HER-MARC, verificering og denne rapport. Hashen står i `git log`.

Filer kun under `docs/kritik-645/` og `outputs/kritik-645/`. Ingen push, ingen merges, intet postet og ingen sub-agenter.

Sitet (`entropi-coaching-site-wt2`, `vaerktoejer` @ `ed32064`) og løftmodellen (`0d4d11f`) er hentet med `git archive`. Træerne er ikke rørt; wt2 står stadig på `udgivelse-squat-min-krop`. Setus filer og START-HER-MARC er kun læst.

## Hvad ændret

Kun dokumenter og mine egne scripts, ingen app, site, løftmodel eller Setu-filer. Nedenfor står, hvad jeg fandt i de to blokke.

### Blok 1: Instagram og værktøjssiden (`INSTAGRAM-OG-SITET.md`)

- **I8 lukket.**
  - Nr. 10's slide 3 er nu tegningen `stangens-plads` (ryggen set fra siden, højt og lavt, styrkeløfternes bias, undtagelsen) uden løftmodelfigur.
  - Det sidste afsnit starter med "Tegningen er en skitse ...".
  - 0 sætninger er fælles med 1-6, og slide 1 og 2 er de samme byte for byte.
- **I9 lukket.** "med knæene strakt mere ..., så skinnebenet står lodret" passer med figurerne: knæ 98° til 127° og skinneben 14° til 0°.
- **Marcs regler i alle seks:** 0 brud, henvisningen og forbeholdet står, og tallene passer med figursiderne. 7, 9, 11 og 12 er ikke rørt siden 631. LAES-INSTAGRAM-2 viser de nuværende 20 PNG og Setus to rettelsesnoter.
- **Værktøjssiden:**
  - De 55 filer i de syv mapper er `0d4d11f` blob for blob, og det er løftmodellens nuværende `main`.
  - 10 sider på 390 og 1280 har 0 fejl 404 og 0 JS-fejl.
  - `noindex, nofollow` står, og disclaimeren er sidste element i `<main>`.
  - Uger virker med tre uger i datoorden, guld og "1 runde", og "Gem ugerne" giver 1200 × 2118 px uden måling. M18 er lukket.
- **Nye lave fund:**
  - I14: "højt på ryggen" er Setus ord, og det er Marcs valg.
  - I15: den ubrugte `sq-lowbar` med 1's figur står stadig i Setus `tegn.mjs`.

### Blok 2: START-HER-MARC (`START-HER.md`)

- **Linkene:** alle 8 er relative, findes og åbner på 390 og 1280 med 0 JS-fejl. Siden er 6,9 skærme lang på 390.
- **Svar-sætningerne:** dommene er rigtige for 28. sep. før 645. Men:
  - H2 (middel): `squat udgiv 28. sep 2026` er ikke en form på LAES-SQUAT. Den har `squat udgiv forslag` / `udgiv, men <nr>: ...` / `vent:`, og datoen er valg 3.
  - H4 (middel): kort 4 siger stadig "7-12: ikke ja endnu".
  - H3 (lav): `klar til app`, `film klip lagt` og `M14 halvdelen` står kun på START-HER.
  - H5 (lav): kort 7 linker til en side, der beder om M2/N1-svar og ikke nævner M14.
- **Hvorfor Marc ikke fandt artiklen, værktøjet og Instagram (H1, middel; H6 og H7 lav):**
  - Ingen af de tre er online. Artiklen og værktøjet ligger på sitets grene, og Instagram er ikke postet. START-HER siger det kun om Instagram.
  - Linkene hedder filnavne ("Åbn LAES-SQUAT.html").
  - Artiklen står 33 skærme nede i LAES-SQUAT på 390, efter de ni valg. Genvejen `#s5` bruges ikke fra START-HER.
  - Værktøjet kan ikke åbnes nogen steder fra: LAES-VAERKTOEJER har 0 links og kun skærmbilleder.
  - Der er ingen oversigt øverst. På 390 er første skærm kort 1 (appen), og squat, værktøjer og Instagram står 1,2, 2,3 og 3,1 skærme nede.

## Testresultat

- `node outputs/kritik-645/insta-645.mjs`: **20/20**.
- `VARIANT=som-er node outputs/kritik-645/sitet-645.mjs`: **17/17** (Google Chrome 154.0.8037.57 headless).
- `node outputs/kritik-645/start-645.mjs`: **10/10**. Tjekkene for H2 til H5 er skrevet, så de er grønne, når fundet står. De bliver røde, når Setu retter.
- `node outputs/kritik-645/verify-kritik-645.mjs --blok 2`: grøn.
- `npm run lint`: grøn.
- Undervejs var fire røde fejl i mine egne scripts, ikke i det målte:
  - Forbeholdsregexen kendte ikke "ikke målt".
  - Figurtjekket læste også ubrugte tegninger.
  - To regex-escapes blev spist, da jeg skrev scriptet.
  - Alt er rettet i scriptet og kørt igen.

## Hvad er næste

- **Setu** retter START-HER-MARC:
  - H1: skriv på kort 2, 3 og 4, hvor tingen er i dag ("kun her, ikke på entropicoaching.dk endnu" / "kan først prøves efter vaerktoejer udgiv" / "intet postet"). Giv linkene navne efter tingen, og lad artikel-linket gå til `LAES-SQUAT.html#s5`.
  - H2: brug LAES-SQUAT's former (`squat udgiv forslag` eller `squat udgiv, men 3: <dato>`) og ingen fast dato (H7).
  - H4: Instagram 7-12 ja og værktøjssiden ja fra `ed32064` (645).
  - H5: fjern matematik-linket, eller giv M14 sin egen side.
  - H6: en oversigt med syv genveje øverst.
  - H3: skriv ved `klar til app`, `film klip lagt` og `M14 halvdelen`, at det er Dhruvas linjer.
  - I15 (valgfri): slet `sq-lowbar` i `tegn.mjs`.
- **Marc:** `instagram ok 7-12` (eller `instagram ret N: ...`), og `vaerktoejer udgiv`, når han vil.
- **Dhruva:** kender de tre linjer, der kun står på START-HER (H3), og skal læse `squat udgiv 28. sep 2026` som `squat udgiv forslag` med den dato, indtil H2 er rettet.
- **Hara (Coaching-planeten):** Instagram 7-12 og værktøjssiden er begge klar og venter kun på Marcs svar. Det, der står i vejen, er START-HER, ikke indholdet.

## Ærlige grænser

- **Identitet:** `CLAUDE.local.md` i dette træ siger Vaidya, men ordren siger Bhishak (kritikerens hjem). Jeg har fulgt ordren, som Marc bad om.
- **Headless Chrome på Windows,** ikke Instagram på en telefon, ikke Safari og ikke Marcs egen browser. Kopiknapperne er talt, ikke trykket.
- **637's ændringer i Mål dit billede** (M22, M25, M26) har jeg kun set i skærmbilledet af Uger, ikke målt igen.
- **Hvor Marc faktisk ledte, ved jeg ikke.** Afsnittet om det er det, siderne og skrivebordet viser.
- **Sitets online-stand** er set i den lokale kopi af GitHubs `main` uden fetch.
- **Kun syntetiske data.** Ingen atletnavne og ingen atletdata. Navnetjekket fanger kun navnene i appens `.gitignore`.
