vaerktoejssiden klar til Marcs deploy: nej

Dommen bliver **ja**, når to ting er gjort. Setu kan gøre begge uden Marc:
- **W0:** grenen er ikke længere den nyeste dist. Yantras 571 blev merget på dhruva main (`cc4dd7d`) kl. 03:52, midt i denne kritik. Den ændrer `maal-billede/index.html` og `maal-billede.js`, og Setu skal kopiere dem igen.
- **W1-W3:** teksten i sitets egen filmeguide skal rettes.

Værktøjerne holder, hvad jeg godkendte i 558 og 564:
- Mål dit billede, Min krop og De tre løft er blob for blob den dist, Setu kopierede (dhruva main `37c9a27`, main da kritikken begyndte).
- Videoen virker, og "Ligner"/"Ligner ikke"-linjen giver det, modellen tegnede, på alle tre bredder.
- Fejlfigurerne giver 0 fejl 404, og siden er stadig noindex.

Det, der ikke holder, er filmeguiden på selve værktøjssiden. Den er ældre end værktøjet og siger fire ting, som vejledningen i Mål dit billede, FILM-KLIP og karrusel 2 siger anderledes:
- telefonen på siden til bænkpres,
- "et par meter",
- skiven som målestok,
- "tag et skærmbillede".

Går siden ud sådan, peger karrusel 2 på en side, der siger noget andet end karrusellen.

# Kritik 576, blok 1: værktøjssiden efter Setus 570

## Hvad jeg målte

- **Kilderne:** grenen `vaerktoejer` (`ba44cb1`) i `entropi-coaching-site-wt2` og løftmodellens main (`37c9a27`) i `entropi-loeftmodel-dhruva`. Begge er hentet med `git archive` til en midlertidig mappe. Ingen gren er skiftet, og intet træ er rørt.
- **Script:** `outputs/kritik-576/vaerktoejer-576.mjs` med 26 af 26 tjek grønne. Tallene står i `vaerktoejer-576.json` og siderne i `V-*.png`.
- **Browseren:** headless Chromium på 360 og 390 px med touch (som en atlet på telefonen) og på 1280 px med mus (som en coach). Siden er serveret fra en lokal server, og alt andet net er afbrudt.
- **Stillingerne:** modellens egne tegnede stillinger, fotograferet med pinhole-kameraet fra main (183 cm og 120 kg, squat også med 140 kg på stangen).
- **Videoen:** mine syntetiske klip fra 564 (`klip-564.mjs`), hvor hvert billede har sit nummer i pixels. Intet klip ligger i repoet, og ingen atletdata er brugt.

## Den nyeste dist?

- **Da kritikken begyndte, ja. Nu nej.**
  - Alle 47 filer i de syv mapper har samme blob-hash som `dist/` på `37c9a27`. Det var main ved Setus kopi og ved kritikkens start.
  - De syv mapper er `maal-billede`, `loeft-fejl`, `squat-figurer`, `doedloeft-figurer`, `baenk-figurer`, `min-krop` og `tre-loeft`.
- **Main flyttede sig undervejs (W0).** Kl. 03:52 blev Yantras 571 merget, og main er nu `cc4dd7d`. To filer er nye på main og ikke på grenen:
  - `maal-billede/index.html` og `maal-billede.js`.
  - De indeholder 571's billedrater (29,97, 25, 60 og variabel), V3 (to buer i Hop til) og V6 (4K). Det er mine fund fra 564.
  - Resten af de syv mapper er uændret.
- **Hvad jeg har prøvet:** kun grenens kopi (`37c9a27`) og ikke 571-udgaven. W5 og W6 står også på den nye main.
- **Det, der ikke er kopieret:** `marcs-doedloeft` (Marcs eget, skal ikke ud) og de løse artikel-scripts i roden af `dist/`. Ingen side på værktøjssiden henter dem.

## Virker det

**Sider:**
- 11 sider på 3 bredder: `/vaerktoejer/`, Mål dit billede, Min krop med to kort, De tre løft og den indlejrede udgave, fejlsiden og figursiderne.
- Resultat: 0 px sidelæns rulning, 0 JS-fejl, 0 brudte billeder og 0 atletnavne.
- 45 lokale links og filer er fulgt, og der var 0 fejl 404.
- Siden prøvede ikke at hente noget udefra, heller ikke skrifttyper.

**"Ligner"/"Ligner ikke":** 14 tilfælde på 3 bredder, 42 i alt, og alle gav det forventede.

| Tilfælde (modellens egen tegning) | Linjen |
|---|---|
| squat bund og sticking point, modellens egen | Ligner ikke (47-48 ord) |
| squat "kun knæene" (bund, sticking point), "hoften tilbage" (bund) | Ligner |
| dødløft gulv og knæ, konventionel og sumo, modellens egen | Ligner ikke (35-39 ord) |
| "hoften stiger først", "stangen glider frem" (også sumo) | Ligner |
| bænk bryst, modellens egen | Ligner ikke (37 ord) |
| bænk "stangen for højt" | Ligner |
| bænk med 7,5 cm større bue | Billedet kan ikke tjekkes (stangen 10 cm højere over skulderen) |

- **"Ligner ikke":** hver linje navngiver det tjekkede. Alle har "Det udelukker ikke fejlen" og "Andre fejl tjekker siden ikke", er højst 50 ord og har ingen parentes. Min L6 og Yantras L10 holder altså stadig.
- **Andre ord:** ingen linje siger "korrekt", "god teknik" eller "uden fejl", ud over "betyder ikke uden fejl".
- **Fejlfigurerne:** hver "Ligner"-linje har et link til sin fejlfigur. Alle links giver 200, og ankrene findes.

**Seks punkter trykket med fingeren:**
- På 390 px med touch og på 1280 px med mus er de seks punkter for "kun knæene" i bunden trykket på billedet i rækkefølge.
- Alle seks sidder inden for 0,8 billedpixel af tegningen, og linjen siger "Ligner: kun knæene" (`V-390-tryk-seks-punkter.png`).

**Videoen** (sq30.mp4, H.264 1080 x 1920, 30 s, 57,5 MB):
- **Åbning:** klippet åbner på 87-96 ms på alle tre bredder, og ◀ er slået fra ved 0 s.
- **V4 er lukket:** første tryk på ▶ fra 0 s giver billede 1, tre tryk mere giver billede 4, og ét tilbage giver billede 3. Det gælder på alle bredder.
- **Brug dette billede:** ved 13,2 s viser videoen billede 396, og fotoet i klik-trinnet er billede 396. Det tager 137-153 ms.
- **V2 er lukket:**
  - et klip af tilfældige bytes giver "Videoen kunne ikke læses i denne browser" efter 31-42 ms,
  - HEVC i headless Chromium giver samme besked efter 14-16 ms,
  - i 564 kom beskeden først efter 15 s.
- **V1 og V5:** "Tjek derfor et par billeder til begge sider" står i vejledningen, og "brug skyderen" er væk fra både vejledning og bundt.
- **Net og fejl:** 0 kald ud af huset efter siden er hentet, 0 JS-fejl og 0 sidelæns rulning.

## Teksten over værktøjet

Setus tre sætninger (`#om-maal-billede`) er i orden:

> Mål dit billede måler ledvinklerne og stangens afstand til midtfoden i et billede fra siden og holder det op mod de fejl, modellen kender i den valgte fase. En video åbner kun i browseren og bliver på telefonen. Står der en fejl, er det kun det, modellen viser i billedet, og ikke en dom over løftet.

- Sætningerne er saglige og siger, hvad værktøjet gør. Der er ingen opfordring, ingen holdning og ingen tankestreg.
- "Fejl" bruges kun om det, modellen viser. I hele sidens `<main>` står "fejl" kun i disse to sætninger.
- Sidens `<main>` har 0 tankestreger, 0 udråbstegn, 0 opfordringer og 0 atletnavne. "Ansøg om coaching" står kun i sitets fælles menu.
- Formuleringen er Setus og ikke Marcs egen. Det skriver Setu også selv.

Men teksten lige under Setus afsnit, filmeguiden fra før videoen, siger noget andet end værktøjet. Den står på samme side, og karrusel 2 og FILM-KLIP bygger på vejledningen og ikke på den (se W1-W3).

## Stadig noindex

- **Ja.**
  - `/vaerktoejer/index.html` har `<meta name="robots" content="noindex, nofollow">`.
  - `robots.txt` har `Disallow: /assets/vaerktoejer/`.
  - `sitemap.xml` nævner ikke værktøjerne.
  - Ingen anden side på sitet linker til `/vaerktoejer/`.
- De syv værktøjssider under `/assets/vaerktoejer/` har ikke selv noindex. Kun robots.txt holder dem ude. Det er som i 570 og i orden, så længe ingen linker til dem udefra.

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| W0 | middel | Grenen er `37c9a27`-dist. Main er `cc4dd7d` (Yantra 571, merget under kritikken) med nye `maal-billede/index.html` og `maal-billede.js`. | Setu: kopierer `dist/maal-billede/` fra main igen. Bhishak prøver 571-udgaven på sitet. |
| W1 | middel | Filmeguiden på `/vaerktoejer/` siger "Til bænkpres lægges telefonen ned på siden." Vejledningen i Mål dit billede siger "hold telefonen lodret", FILM-KLIP siger "i bænkens højde, på højkant", og karrusel 2 siger "På højkant". | Setu: sletter sætningen, så bænken filmes på højkant som i vejledningen. |
| W2 | middel | Filmeguiden siger "Skiven er målestokken" og "Et par meter væk". Vejledningen siger, at kroppens længder er målestokken og skiven en kontrol, og "Fra 3-4 m". Dødløft skal filmes fra mindst 3 m, ellers stopper siden. | Setu: 03 og 04 følger vejledningen (3-4 m, dødløft mindst 3 m, kroppen er målestokken, skiven en kontrol). |
| W3 | middel | Filmeguiden siger "Stop videoen i den fase, du vil måle, og tag et skærmbillede", og kortet siger "Læg et stillbillede fra siden ind" og "Et stillbillede fra siden". Mål dit billede åbner nu selv videoen, og Setus nye sætning lige over siger det. | Setu: skærmbillede-sætningen skal sige, at videoen kan åbnes i Mål dit billede, og kortet skal sige "et billede eller en video". |
| W4 | lav | "Ligner"-linjerne har ingen længdegrænse. Squattens er 148-195 ord og fylder 1,0-1,2 skærm på 390 px, bænkens og "hoften stiger først" 0,8 skærm (`V-390-ligner-*.png`). Det første, man ser, er rigtigt, men forbeholdene om hæl og telefon i hånden står nederst. Fejlfigurens miniature har tekst på ca. 5 px. | Yantra, hvis Marc vil: samme grænse som L10 og forbeholdene bag et "Mere". |
| W5 | lav | Bænkens "Ligner"-link hedder "Se fejlfigurenerne og hvad modellen ikke kan sige om dem". Bundtet skriver `fejlfiguren` + `erne`. | Yantra: `fejlfigur` + `en`/`erne`, og Setu kopierer igen. |
| W6 | lav | Bænkens "Ligner"-linje siger "Klik skulderleddet, ikke knoglespidsen". Vejledningens klikliste siger skulderen er "knoglespidsen (acromion) ... ikke midt i leddet. Samme punkt som i Min krop". Længere nede siger vejledningen, at liggende er knoglespidsen et par cm fra leddet, som modellen regner i. Brugeren får to modsatte råd om samme punkt. | Yantra: kliklisten skal sige det samme for bænken, eller linjen skal sige hvorfor. |

- W0 er ingen fejl hos Setu. Main flyttede sig, efter han kopierede.
- W1-W3 er i sitets egen tekst og ikke i dist. De er ikke nye i 570, men de er ikke set før, og det er dem, der afgør dommen.
- W4-W6 er i dist og gør ingen tal forkerte.

## Ærlige grænser

- **Ingen rigtig telefon:** alt er headless Chromium på Windows med mobilemulering, ikke en rigtig telefon. Et rigtigt iPhone-klip (HEVC/MOV) i Safari er ikke prøvet. V2 er kun prøvet i Chromium, der ikke kan HEVC.
- **"Ligner" er ikke målt på rigtige løft:** tilfældene er modellens egne tegnede stillinger fotograferet vinkelret. Jeg har ikke gentaget 558's målinger af falsk alarm med skrå kameraer og klikfejl. Kilden er uændret siden 565, og de tal står i Yantras dokument.
- **Trykket med fingeren** er CDP-touch på et ensfarvet syntetisk billede. Det viser, at trykket rammer det rigtige punkt. Det viser ikke, hvor godt en finger rammer et led i et rigtigt foto.
- **Kun "virker det":** jeg har ikke regnet Min krop og De tre løft om. Jeg har tjekket, at de er dist og virker uden fejl.
- **Kilderne til W1-W3:** jeg har læst dem mod vejledningen i Mål dit billede og mod `FILM-KLIP.html` på skrivebordet (kun læst).
