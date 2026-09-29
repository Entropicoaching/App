Ordre 680: kritik af matematikspillet efter 671, 673 og 677 og af skakken efter 670, 674 og 678 (Bhishak)

Planet: school. Spor: spor-matematik-minispil-tr-n-kompetencerne-som-g-der-014dc3.

**Domme**
- MMORPG-foelelse: **ja**
- Matematikken mindre rodet: **nej**
- Hoved/Haand/Hjerte forstaaelig for en 11-aarig: **ja**
- Skakken stadig klar til Marcs klasse: **ja** (med tre ting, der stadig er rodede, og et hul i filen)

## Gren

`kritik-680`, lavet fra `main` med `git checkout -b kritik-680 main`. Ingen push, ingen merge, ingen sub-agenter. Kun filer under `docs/kritik-680/` og `outputs/kritik-680/`.

- commit 1 `9bd38a8`: blok 1, matematikken (`mat-680.mjs`, `mat-680.json`, `M680-*.png`, `docs/kritik-680/BLOK1-MATEMATIK-680.md`)
- commit 2: blok 2, skakken, og denne rapport (`skak-680.mjs`, `skak-flow-680.mjs`, `skak-lav-680.mjs`, jsonfiler, `S680-*.png`)

Det, der er vurderet:
- Matematik: `main` @ `ce21a16` (677 merget), hentet med `git archive`.
- Skak: Chaturangas 678 er **ikke merget**. `main` staar paa `0a207bc` (674 merget). Jeg har derfor vurderet `main` (670 + 674) og kun maalt det, 678 aendrer, paa grenen `ordre-678` @ `1503c1d` (ogsaa via `git archive`). Chaturangas ikke-committede aendring i hendes trae er ikke vurderet.
- Laest: Ganitas RAPPORT-671, -673, -677 og Chaturangas RAPPORT-674 og -678.

## Hvad blev aendret

Intet i appen, matematikken eller skakken (ordrens graenser). Der er kun lavet maaling, skaermbilleder og denne kritik.

### Blok 1: matematikken

**Foeles det som et MMORPG og ikke som Cookie Clicker? Ja.** Jeg spillede Moellen igennem som elev "Tulle" (syntetisk) paa 390 touch og 1280 mus, bevaegelse taendt.

- **Tallet vokser synligt.** Efter et rigtigt svar taeller "erfaring" fra 30 til 40 (31, 35, 38, 40 efter 120/400/700 ms), baren glider og faerdigheden ("Broeker 64 -> 70") stiger. Efter et mestret forloeb staar "Bonus i rygsaekken: +40 Broeker (nu 140)".
- **Helten bliver staerkere af aerligt arbejde.** "Niveau op!" viser nu selve helten med sit udstyr (staven, kappen; efter 60 aerlige opgaver ogsaa vimpel og guldbanner) og maerket skifter fra det gamle niveau til det nye. Det er det, der goer det til et spil og ikke til en taeller: tallet aendrer noget, man kan se paa figuren.
- **Det er ikke Cookie Clicker**, fordi erfaring alene ikke aabner noget. Niveau, stav og kappe kraever et mestret forloeb med mindst halvdelen rigtige i foerste forsoeg.
- **Kan gaetteren naa de flotteste trin foer den aerlige? Nej.** Samme start (helt ny elev), 60 opgaver hver, headless:

  | Efter | Aerlig: niveau / erfaring / mestrede forloeb | Gaetter: niveau / erfaring / mestrede forloeb |
  |---|---|---|
  | 10 opgaver | 3 / 100 / 2 | 1 / 45 / 0 |
  | 30 opgaver | 8 / 300 / 7 | 1 / 130 / 0 |
  | 60 opgaver | 15 / 600 / 14 | 1 / 310 / 0 |

  Gaetteren staar paa niveau 1 uden udstyr og faar at vide "Du kom igennem, og 1 af 3 var rigtige i foerste forsoeg. Moelleren vil se mindst 3, foer forloebet taeller som klaret ... spoerg din laerer eller sidemanden".
- **Forbehold 1: det synlige tal kan gaettes.** Gaetterens erfaring vokser med ca. halvdelen af den aerliges hastighed (310 mod 600 efter 60 opgaver). Kun niveauet og figuren kan ikke gaettes. En klassekammerat, der kigger paa "erfaring", kan altsaa ikke se forskel paa gaet og arbejde, foer der ikke kommer et niveau. Det er roligt, men det er en svaghed.
- **Forbehold 2: tempoet.** Aerlig elev naar niveau 15 efter 60 opgaver (14 forloeb a 4 opgaver, "Niveau op!" ca. hver fjerde opgave). Efter 10 opgaver er den aerlige paa niveau 3, efter 30 paa niveau 8 ("Mester"). Jeg har ikke maalt tid, men det er hurtigt: alle stave (niveau 2, 5, 8, 11) kan vaere set i een time, og bagefter er der kun tal tilbage. Om det stadig er roligt og motiverende i uge to ved ingen af os. Det er mit stoerste forbehold ved "ja".

**Er de tre mest brugte skaerme mindre rodede efter 643? Nej.** Jeg har ikke en maaling fra foer 643 i denne ordre; RAPPORT-673 og -677 siger selv, at kortet, opgaven og Min helt har uaendret ord/tal/knapper siden 671 (kortet 49 ord, 12 tal, 9 knapper paa foerste skaerm). Jeg fandt de samme tal (390: kortet 49/12/9, Min helt 115/16/3; 1280: 49/12/9 og 140/21/4). Og det, en bruger ser, er stadig rodet:

De tre vigtigste ting, der stadig er rodede:
1. **Min helt siger det samme tre gange, og maerkerne ligger oven paa teksten.** Efter et niveau staar der "Niveau 3 +1", "Siden sidst: Niveau 3 +1 - Hoved 3 +1 - 70 erfaring +40" og et "+40" og et "+1" som badges. Paa 390 ligger "+40" oven paa de to cirkler ved "Naeste niveau", og "+1" oven paa ordet "Hoved". Midt i taellingen staar der "66 erfaring" under "70 erfaring +40" (`M680-390-8-helt.png`). Den skal rydde en ting og sige det een gang.
2. **Toppen af kortet foer kortet.** Paa 390 er der 12 tal og 9 knapper, foer man naar kortet (foerste punkt i kortet ligger ca. 880 px nede): Niveau, to uforklarede cirkler ("o o"), erfaring, tre kasser, "?", Min helt, Journalen, Questbogen "1 ny", "Din opgave nu", "19 indbyggere" med otte prikker, "Lyd: fra". Paa 1280 (900 hoej) staar opgaven under kortet, uden for foerste skaerm, saa en klasse ser kun kortet, indtil der rulles.
3. **Fem slags tal paa en opgave.** Niveau, erfaring, Hoved/Haand/Hjerte, faerdigheden ("Broeker 64", en pille der paa 390 presser opgaveteksten ind i en smal spalte og bryder linjen midt i saetningen) og "Bonus +40 Broeker (nu 140)" i en skala, der ikke ligner niveauets. En 11-aarig kan ikke se, hvilket tal der er "mit".

**Forstaar en 11-aarig Hoved, Haand og Hjerte af forklaringen? Ja.** Forklaringen (`hhh-forklaring.js`) bruger ord som "regne", "bruge matematikken", "hjaelpe andre" med stederne som eksempler (Moellen, Grusgraven, Landsbygaden), og den staar aaben foerste gang. Svagheder: Hjerte siger hvad, men ikke hvordan ("du hjaelper" hvem? svaret ligger i Questbogen); og "Naar det vokser, stiger din helt ogsaa et niveau" staar to gange. For en helt ny elev fylder forklaringen hele foerste skaerm paa 390 (113 ord), og kortet ligger under den.

**Ville Marc skamme sig paa 1280?** Delvis. Spillet er en 520 px bred spalte midt paa en 1280-skaerm med tom baggrund og smaa bogstaver (ca. 13 px). Fra bagerste raekke i en klasse kan tallene og opgaverne ikke laeses. Det er roligt og pænt, men det er ikke bygget til at blive vist paa en tavle.

### Blok 2: skakken

Maalt paa 360 x 740 og 390 x 844 touch (12-aarig) og 1280 x 800 mus (Marc), file://, 0 net, 0 JS-fejl. Alle seks faner, et parti mod computeren (e4, Sf3, Lc4) og foerste gaade.

**Skakken stadig klar til Marcs klasse: ja.**
- Spil er roligt og tydeligt: "Hvem vil du spille mod?", to store knapper, brættet (344 px paa 360, 374 paa 390), og bagefter "Computeren spillede e7-e5. Din tur." Brikkerne er store, intet vandret rul, trykfladerne paa fanerne er 45 px. Efter 674 og 678 staar brættet paa skaermen, ogsaa paa en telefon med adresselinje.
- Taktik er det tydeligste: en overskrift, en saetning, en pil paa brættet ("Slaa den ubeskyttede brik"). Den kunne en 12-aarig bruge uden hjaelp.
- 1280 er rigtig til en klasse: "Dagens storm (29/9) ... hele klassen faar de samme gaader. Start, naar laereren siger til." brættet er 537 px.
- **678 (kun grenen, ikke merget):** paa 360 x 560 staar brættets bund paa 548 px (main 624 px, altsaa under kanten), knapperne staar paa een linje, og brættet er 296 px. Jeg bekraefter tallene; det ser roligt ud (`S680-o678-360x560-spil.png`, `S680-main-360x560-spil.png`).

Det, der stadig er rodet:
1. **Gaader-fanen er forsiden og er den mest rodede.** Paa 360 er den 3,4 skaermhoejder lang. "Sort traekker" staar to gange (overskriften og statuskortet), "Vi finder dit niveau: 0 af 10" og "Storm" er ikke forklaret, og laengere nede staar "gaade-rating (start 800)", lichess og "CC0" (`S680-main-360-1-gaader-hel.png`). Fanerne staar i to raekker a tre paa 360. Brættet er vendt, naar sort traekker (rank 1 foroven, fil h til a), uden at der staar hvorfor.
2. **Gaaden forsvinder, naar man kommer tilbage.** Start paa Gaader viser en rigtig gaade. Gaa til Spil og tilbage, og der staar udgangsstillingen med "Hvid traekker." og ingen opgave; en ny gaade kraever "Dagens gaade" laengere nede paa siden (mere end en skaerm rulning paa 360). En elev, der har rykket rundt, staar med et tomt bræt.
3. **1280: hoejre panel er en mur.** Spil-fanens panel har fire hoved-valg og syv knapper i samme blok ("Lyd", "Forhaandstraek", "Klassens turnering", "Skakur", "Fortryd", "Vis et hint", "Start forfra", "Giv op"), og gaadepanelets tekst er lang. Det er ikke fejl, men Marc maa rulle og forklare det, mens klassen venter.

**Hul i filen (ikke roderi):** `skak.html` har **ingen** `<meta charset>` (matematikkens `spil.html` har). Filen skal kunne aabnes fra en USB-noegle eller en mail. Ved en maaling paa file:// blev en side i 390-konteksten vist med tegnfejl ("LÃ¦r skak") og en JS-fejl ("Range out of order in character class"); en ny koersel var ren. Det er tilfaeldigt (een ud af ca. seks sideindlaesninger), men en linje loeser det (Chaturangas at goere).

## Testresultat

- `node outputs/kritik-680/mat-680.mjs <mappe>`: 0 net, 0 JS-fejl paa 390 og 1280, "Niveau op!" naaet paa begge, gaetter/aerlig-forloebet koert til 60 opgaver.
- `node outputs/kritik-680/skak-680.mjs <mappe> main`: 0 net, 0 JS-fejl, ingen vandret rulning paa noget skaerm og ingen knap under 40 px paa 360/390 (bibliotekets emnepiller er 36 px hoeje).
- `node outputs/kritik-680/skak-flow-680.mjs <mappe> main`: parti mod computeren spillet paa 360 og 1280, 0 net, 0 fejl.
- `skak-680.mjs ... o678` gav een gang en JS-fejl paa 390 (tegnfejlen ovenfor); en ny koersel gav 0.
- Ingen `npm run lint` eller verify:*-scripts: der er ikke aendret appkode. Jeg har kun tilfoejet filer under `docs/` og `outputs/`.

## Hvad er naeste

Til Ganita (matematik):
1. Ryd Min helt: siger "Niveau 3 +1" en gang, og fjern badge-overlappet paa "Hoved" og cirklerne.
2. Ryd toppen af kortet: forklar eller fjern de to cirkler, og skub "Din opgave nu" og kortet op i foerste skaerm paa 1280.
3. Faerdighedspillen ("Broeker 64") ud af opgaveteksten paa 390, og et tal til bonussen, der passer med niveauet.
4. Overvej en tavletilstand paa 1280 (stoerre skrift), hvis Marc viser den foran klassen.
5. Spoerg Marc, om erfaringstallet ogsaa skal kraeve noget, saa det ikke kan gaettes.

Til Chaturanga (skak):
1. `<meta charset="utf-8">` i `skak.html`.
2. Gaader: et "Sort traekker" ikke to gange, forklar "Vi finder dit niveau", og indlaes en gaade igen, naar man kommer tilbage til fanen.
3. Merge 678 (jeg kan kun se, at det er bedre).

Har arbejdet betydning for Hara? Nej (Skole-planeten, ikke Coaching, ingen aendring i entropi-appen).

## Aerlige graenser

- **Ingen rigtig elev har set det.** "Foelelsen" er mit skoen; tal, tider og pixel er malt i headless Chromium paa Windows (Math.random og uret laast i matematik), touch og mus emuleret. Ingen rigtig telefon, ingen projektor.
- **Ingen foer-maaling af 643 i denne ordre.** "Ikke mindre rodet" bygger paa 673/677's tal (uaendret siden 671) og paa, hvad jeg ser paa skaermene nu.
- **Gaetter-simulering:** en gaetter, der trykker paa svarmulighederne i raekkefoelge, er ikke det samme som en rigtig elev, der gaetter tilfaeldigt. Tallene viser, at gating virker, ikke hvor hurtigt en rigtig elev opgiver.
- **Skak: 678 er kun maalt paa 360 x 560** (og en gang paa 390), ikke gennemspillet. Chaturangas ikke-committede aendring i hendes trae er ikke set.
- **Ingen matematik- eller skak-tests koert** (ordren siger kun kritik). Jeg roerte ikke matematik- eller skak-traeerne (kun `git archive` til en midlertidig mappe).
- **Syntetiske data:** eleven hedder "Tulle", ingen rigtige elever eller atleter.
- **PNG'er:** jeg har fjernet en del skaermbilleder for at holde mappen under 20 MB; de resterende viser hver skaerm paa hver bredde, jeg har vurderet.
