vaerktoejssiden klar til Marcs deploy: ja

W0-W3 fra 576 er lukket på grenen `vaerktoejer` (`eb7bf79`, Setu 579 og 584):
- **W0:** Mål dit billede på sitet er blob for blob dhruva main `291f5bf` (Yantras 571 og 580). Main har ikke flyttet sig siden.
- **W1-W3:** filmeguiden følger nu vejledningen i Mål dit billede. Syv af dens påstande står ordret eller næsten ordret dér, og den gamle tekst (bænken på siden, "et par meter", skiven som målestok, "tag et skærmbillede", "stillbillede" på kortet) er væk.
- **W4-W6** fra Yantras 580 er også lukket i sitets kopi.

Det, der står tilbage, er to lave fund (W7, W8). Ingen af dem gør noget forkert på siden, og ingen af dem skal rettes før deploy. Marc bør læse filmeguiden én gang, for teksten er Setus og ikke hans egen stemme.

# Kritik 585, blok 1: værktøjssiden efter Setus 579 og 584

## Hvad jeg målte

- **Kilderne:** grenen `vaerktoejer` (`eb7bf79`, nyeste commit) i `entropi-coaching-site-wt2` og løftmodellens main (`291f5bf`) i `entropi-loeftmodel-dhruva`. Begge er hentet med `git archive` til en midlertidig mappe. Ingen gren er skiftet, og intet træ er rørt.
- **Setus rapporter:** `setu-579\RAPPORT-579.md` og `setu-584\RAPPORT-584.md`, kun læst.
- **Script:** `outputs/kritik-585/vaerktoejer-585.mjs` med 33 af 33 tjek grønne. Tallene står i `vaerktoejer-585.json` og siderne i `V-*.png`.
- **Browseren:** Google Chrome 154 headless (den installerede, som en coach har den) på 360 og 390 px med touch og på 1280 px med mus. Siden er serveret fra en lokal server, og alt andet net er afbrudt.
- **Stillingerne:** modellens egne tegnede stillinger, fotograferet med pinhole-kameraet fra main (183 cm og 120 kg).
- **Videoen:** mine syntetiske klip fra 582 (`klip-582.mjs`, i `%TEMP%`, intet klip i repoet). Hvert billede har sit nummer i pixels, og ffmpeg giver facit for hvert billedes tid.

## W0: den nyeste Mål dit billede

- **Lukket.** `assets/vaerktoejer/maal-billede/index.html` og `maal-billede.js` har samme blob som `dist/maal-billede/` på dhruva main `291f5bf`. Det er main nu, og der er intet nyere.
- Fejlsiden og de tre figurmapper er også blob for blob main.
- **W7 (lav):** `min-krop/min-krop.js` og `tre-loeft/tre-loeft.js` er stadig 37c9a27-udgaven. Setu skriver det selv i 584. På main er den eneste forskel, at bundterne har fået bænkens skulder-hjælp fra 580 (`hjaelpBaenk`) med, fordi kliklisten ligger i et fælles modul. Den læses ikke i Min krop eller De tre løft (ordet står én gang, i definitionen). Siderne opfører sig altså ens. Min 582 kaldte forskellen "kun minificerede navne". Det var ikke helt rigtigt, men konklusionen holder.

## W1-W3: filmeguiden følger vejledningen

Hver påstand i filmeguiden er holdt op mod vejledningen i Mål dit billede (main `291f5bf`) og `FILM-KLIP.html` på skrivebordet (kun læst).

| Filmeguiden på siden | Kilden | Den gamle tekst |
|---|---|---|
| 01 "hold telefonen lodret, også til bænkpres" | vejledningen "hold telefonen lodret", FILM-KLIP "i bænkens højde, på højkant" | "lægges telefonen ned på siden" er væk (W1) |
| 02 linsen i højde med hoften, bænkpres i højde med bænken | vejledningen "i hoftehøjde", FILM-KLIP "bænkens højde" | uændret |
| 03 "Jo tættere kameraet står ... Fra 3-4 m og zoomet ind er det fint." | ordret i vejledningen | "Et par meter væk" er væk (W2) |
| 03 "Dødløft filmes fra mindst 3 m: tættere på ser stangen lavere ud ..." | ordret i vejledningen ("Film dødløftet fra mindst 3 m ...") | ny |
| 04 kroppens længder er målestokken, skiven en kontrol eller målestokken uden højden | næsten ordret i vejledningen | "Skiven er målestokken" er væk (W2) |
| "Videoen kan åbnes direkte i Mål dit billede: tryk Vælg video ... Brug dette billede." | vejledningen "Har du en video, så tryk Vælg video ... tryk Brug dette billede" | "tag et skærmbillede" er væk (W3) |
| faserne: squattens bund eller sticking point ... bænkpresset på brystet eller midt i pressen | vejledningens faser | ny |
| kortet: "Læg et billede eller en video fra siden ind" og "Et billede eller en video fra siden" | | "stillbillede" på kortet er væk (W3) |
| Før og efter: stativ, tape, samme afstand ... | ordret i vejledningen | uændret |

- **Ét "stillbillede" står tilbage,** i forbeholdet: "Et stillbillede viser heller ikke stangens bane eller farten." Det er sandt, for siden måler ét billede ad gangen, også fra en video.
- **Sidens `<main>`:** 0 tankestreger, 0 udråbstegn, 0 opfordringer, 0 holdningsord og 0 atletnavne. "Fejl" står kun om det, modellen viser.
- **W8 (lav):** filmeguiden nævner ikke sumo (vejledningen: "stativ ud for stangen (højst ca. 20 cm til siden)") og ikke telefonen i hånden (ca. 3° skinneben). Karrusel 2 nævner begge. Filmeguiden siger ikke noget andet end karrusellen. Den siger bare mindre, og linket til Mål dit billede fører til vejledningen, hvor det står. "Sticking point" er heller ikke forklaret i filmeguiden (vejledningen: en tredjedel af vejen op), men det står over videoen i værktøjet.
- **Stemmen:** filmeguiden er Setus omskrivning og ikke Marcs egen formulering. Den er saglig og i beskrivende form. Setu skriver det selv, og Marc bør læse den før deploy.

## Virker det

**Sider:**
- 11 sider på 3 bredder: `/vaerktoejer/`, Mål dit billede, Min krop med to kort, De tre løft og den indlejrede udgave, fejlsiden og figursiderne.
- 0 px sidelæns rulning, 0 JS-fejl, 0 brudte billeder og 0 atletnavne.
- 45 lokale links og filer er fulgt, og der var 0 fejl 404. Siden prøvede ikke at hente noget udefra.
- Skærmbilleder: `V-360-vaerktoejer.png`, `V-390-vaerktoejer.png`, `V-1280-vaerktoejer.png` og `V-390-filmeguide.png`.

**"Ligner"/"Ligner ikke":** 14 tilfælde på 3 bredder, 42 i alt. Alle gav det, modellen tegnede.
- **"Ligner ikke":** navngiver det tjekkede, "Det udelukker ikke fejlen" og "Andre fejl tjekker siden ikke" står, 35-48 ord og ingen parentes.
- **W4 lukket:** på 390 px står "Ligner"-linjen med overskrift, sætning, fejlfigur og link på 0,36-0,53 skærm (42-54 synlige ord, linktekst og "Mere" medregnet). Resten står bag "Mere". I 576 fyldte squattens linje 1,0-1,2 skærm (`V-390-ligner-sq-bund-kun-knae.png`).
- **W5 lukket:** ingen "fejlfigurenerne". Bænken siger "Se fejlfigurerne og hvad modellen ikke kan sige om dem" og dødløftet "Se fejlfiguren og hvad modellen ikke kan sige om den".
- **W6 lukket:** på bænken siger vejledningen over billedet "På bænken: midt i skulderleddet, hvor overarmen går ind i kroppen, ikke knoglespidsen." Ingen bænk-linje siger acromion.
- Alle fejlfigur-links giver 200, og ankrene findes. Ingen linje siger "korrekt", "god teknik" eller "uden fejl", ud over "betyder ikke uden fejl".

**Seks punkter trykket med fingeren:** på 390 px med touch og 1280 px med mus sidder alle seks punkter for "kun knæene" i bunden inden for 0,8 billedpixel af tegningen, og linjen siger "Ligner: kun knæene" (`V-390-tryk-seks-punkter.png`).

**Videoen i sitets kopi:**

| | 390 touch, MP4 29,97 | 390 touch, MOV variabel | 1280 mus, MP4 29,97 | 1280 mus, MOV variabel |
|---|---|---|---|---|
| åbner | 74 ms | 56 ms | 71 ms | 56 ms |
| 4 tryk frem, 1 tilbage | 0,1,2,3,4,3 | 0,1,2,3,4,3 | 0,1,2,3,4,3 | 0,1,2,3,4,3 |
| ved 13,2 s: vist / foto / facit | 395 / 395 / 395 | 337 / 337 / 337 | 395 / 395 / 395 | 337 / 337 / 337 |
| Brug dette billede | 135 ms | 111 ms | 97 ms | 97 ms |

- Et klip af tilfældige bytes giver "kunne ikke læses" efter 25-37 ms. En HEVC-MOV (iPhones standard) åbner i Chrome.
- 0 kald ud af huset, 0 JS-fejl og 0 sidelæns rulning (`V-390-video.png`).

## Stadig noindex

- **Ja.** `/vaerktoejer/index.html` har `<meta name="robots" content="noindex, nofollow">`, `robots.txt` har `Disallow: /assets/vaerktoejer/`, `sitemap.xml` nævner ikke værktøjerne, og ingen anden side på grenen linker til `/vaerktoejer/`.
- Alle links fra `/vaerktoejer/` til værktøjerne har `rel="nofollow"`.
- Skal siden kunne findes efter deploy, er det Marcs valg (se RAPPORT-585, "Hvad er næste").

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| W0 | lukket | Mål dit billede = dhruva main `291f5bf`, blob for blob. | |
| W1 | lukket | Bænken filmes lodret, "også til bænkpres". | |
| W2 | lukket | 3-4 m, dødløft mindst 3 m, kroppen er målestokken og skiven en kontrol. Ordret fra vejledningen. | |
| W3 | lukket | Videoen åbnes i Mål dit billede. Kortet siger "et billede eller en video". | |
| W4 | lukket | "Ligner"-linjen fylder under en halv skærm på 390. Resten står bag "Mere". | |
| W5 | lukket | "fejlfigurerne" / "fejlfiguren". | |
| W6 | lukket | Bænkens skulderpunkt: midt i leddet, både over billedet og i linjen. | |
| W7 | lav | Min krop og De tre løft er 37c9a27-udgaven. Main har kun fået en ulæst tekst med i bundtet, så siderne opfører sig ens. | Setu, næste gang han kopierer: `dist/min-krop/` og `dist/tre-loeft/` fra main i samme greb. Ikke før deploy. |
| W8 | lav | Filmeguiden nævner ikke sumo (stativ, højst ca. 20 cm til siden) og telefonen i hånden. Karrusel 2 gør. Ikke i strid. | Hvis Marc vil: én linje i 01 om sumo. Ikke før deploy. |

## Ærlige grænser

- **Ingen rigtig telefon:** alt er headless Chrome på Windows med mobilemulering. En rigtig iPhone i Safari er ikke prøvet. HEVC er kun prøvet i Chrome, som kan den.
- **"Ligner" er ikke målt på rigtige løft:** tilfældene er modellens egne tegnede stillinger fotograferet vinkelret. Falsk alarm med skrå kameraer og klikfejl står i Yantras dokument og er ikke gentaget her.
- **Trykket med fingeren** er CDP-touch på et ensfarvet syntetisk billede. Det viser, at trykket rammer det rigtige punkt, ikke hvor godt en finger rammer et led i et rigtigt foto.
- **Videoen** er prøvet med 29,97 og variabel billedrate på sitets kopi. 4K, 24/s-stykket og Hop til er ikke gentaget. Filerne er byte for byte dem, jeg målte på main i 582, så de tal gælder.
- **Min krop og De tre løft** er ikke regnet om. Jeg har tjekket, at de åbner uden fejl, og at forskellen til main ikke læses.
- **Filmeguiden** er holdt op mod vejledningen og FILM-KLIP, ikke mod målinger. Tallene deri er Yantras.
