Marcs domme holdt: ja (ingen brudt; se forbeholdene). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft, stand-linjen i det lille frontvindue viser raa decimaler ("24.7093023255814° ud", "39.90853658536584° ud") og klippes i venstre kant, naar fodbredden staar paa en mellemting (`A864-390-dl-semi-t0.png`, `A864-390-dl-sumo-smal-t0.png`, `A864-1280-dl-semi-t2.png`; `src/embed/deadloftAnimation.js`, teksten "stand X cm · Y° ud": afrund til hele cm og hele grader, og goer den kortere); (2) squat-animationen paa 390: figuren fylder stadig kun en fjerdedel til en tredjedel af bredden, mens frontvindue og haandcirkel fylder toppen (`A864-390-squat-lowbar-t2.png`, `A864-390-squat-highbar-t0.png`; `src/embed/squatAnimation.js`, samme fund som 836 og 848, ikke lukket; kraever at vinduet forfra og haandcirklen flytter eller skjules); (3) hovedet i squat og sumo: tung klods langt frem paa en lang hals, og i sumo ser blikket ud over gulvet (`A864-390-dl-sumo-bred-t1.png`, `A864-390-squat-lowbar-t4.png`; hovedet i `src/embed/deadliftAnimation.js` og `squatAnimation.js`, samme fund som 848, ikke rettet).

# Ordre 864, Bhishak, 30. sep. 2026

## Gren

`kritik-864` (fra `main`). Filer kun under `docs/kritik-864/` (denne rapport og scripts: `server-864.mjs`, `tur-864.mjs`, `squat-stang-864.mjs`, `baenk-taet-864.mjs`, `ark-864.mjs`) og `outputs/kritik-864/` (billeder og `maaling-864.json`). Set paa Yantras `main` (c28c93a, ordre 847 merget; nyeste rapport `RAPPORT-ordre-847.md`), hentet med `git archive` (dist og demo) og serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280 (mus). 0 netkald ud af huset, ingen JS-fejl (kun een 404, formentlig favicon). Min seneste figur-kritik er 848. `Til Marc\LAES-MODELLER-3.html` er ikke aabnet i browser; den er en samlet laeseside, og jeg har set figurerne direkte i dist og demo i stedet (jeg roerte den ikke). Ingen atletdata; kroppene er modellens egne syntetiske.

## Hvad aendret

Intet i appen eller loeftmodellen (jeg retter aldrig i det, jeg kritiserer). Nyt er kun kritikkens egne filer: rapporten, fem scripts og skaermbilleder: `T864-` stille figurer (bund/sticking/lockout, bryst/midt/lockout, opstilling/knaehoejde/lockout), `A864-` animationer (squat low og high bar; baenk lille, middel, stor; doedloeft konventionel, mellemting 49 cm, sumo 65,6 og 82 cm), `S864-` squat bund/sticking/lockout, `B864-` tætte baenkbilleder, `ARK864-` samleark (kontaktark) af dem.

## Testresultat

Ingen tests koert, for der er ingen kode aendret. Malingen er scripts: `tur-864.mjs` (390 og 1280, 0 netkald, ingen JS-fejl) og `squat-stang-864.mjs` (squat bund, sticking og lockout). Resultat i `outputs/kritik-864/maaling-864.json`. Jeg har set samleark i stedet for hvert billede i fuld stoerrelse, saa smaa tekstfejl kan vaere overset.

## Holder figurerne Marcs domme?

- Squat: ja. Albuen er under og bag stangen i alle set billeder (low bar bunden: 10 til 15 cm bag, 18 til 21 cm under; high bar i lockout kun 1 cm bag, 26 cm under, men aldrig ved hovedet). Low bar staar lavere end high bar, stangens sted er et spektrum. Set paa 390 og 1280, side og forfra.
- Baenk: ja. Lukket siden 848: i bunden af animationen staar stangen paa den orange kontaktprik (`B864-Stor-05.png`) og i lockout er led stablet over skulderen (`A864-390-baenk-stor-t1.png`); toppen ligger taettere paa halsen, jo stoerre bue (21,1 / 19,1 / 16,8 cm fra skulder, `A864-390-baenk-tre-buer.png`). Forbehold: undervejs op og ned haelder underarmen (`A864-390-baenk-lille-t3.png`, `A864-390-baenk-middel-t2.png`), Yantra har meldt det som banens form; en coach bemaerker det kun, hvis han ser loeftet i slowmotion.
- Doedloeft: ja. Skinnebenet staar helt frem til stangen i opstilling og i sumo; fodbredden er et spektrum (32 til 82 cm; konventionel, mellemting 49, sumo 65,6 og 82 set).
- "Intet er binaert": ja, glideren for fodbredde og de tre baenkbuer er et spektrum. Stangens sted i squat er det i demoen.

## Ligner de rigtige loeft?

Ja. Squat-bunden, baenkens brystkontakt og doedloeftets start ligner en erfaren loefter. Mine fund fra 848: (1) baenk-animationen rammer nu brystet, lukket; (2) squat paa 390 stadig lille, aaben; (3) sumo-teksten er nu een kort linje pr. tal, men skriften er ca. 8 px paa 390 og "op til:" brydes stadig paa en linje for sig selv (`A864-390-dl-semi-t0.png`), halvt lukket. Det der stadig er unaturligt eller nyt:
- Raa decimaler i doedloeftets stand-tekst ved mellemting (top 1 ovenfor); det er nyt, fordi glideren giver mellemvaerdier.
- Hovedet paa en lang hals og sumoblikket (top 3).
- Overskriften "De tre buer, samme skala" er stadig klippet i toppen paa 390 (`A864-390-baenk-tre-buer.png`).
- I doedloeft er den stiplede konventionelle skygge svaer at laese paa 390 uden at kende den.

Har arbejdet betydning for Hara? Nej.
