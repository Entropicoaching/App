Marcs domme holdt: ja (ingen brudt; se forbeholdene). Ligner rigtige loeft: ja. De tre vigtigste ting Yantra retter naeste gang: (1) squat paa 390: figuren fylder stadig kun en tredjedel af bredden, mens frontvindue og haandcirkel fylder toppen (`A870-390-squat-lowbar-t0.png`, `A870-390-squat-highbar-t0.png`; `src/embed/squatAnimation.js`; fjerde kritik i traek, 836, 848, 864, 870: flyt eller skjul haandcirklen paa smal skaerm og goer figuren stor); (2) hovedet i squat og sumo: tung klods langt frem paa en lang hals, og i sumo ser blikket ud over gulvet (`A870-390-squat-lowbar-t0.png`, `A870-390-dl-sumo-bred-t0.png`; hovedet i `src/embed/squatAnimation.js` og `src/embed/deadliftAnimation.js`, samme fund som 848 og 864, ikke rettet); (3) doedloeft paa 390: den stiplede skygge-tekst "stiplet konv., op til: hofte ... ryg ..." er ca. 8 px og brydes, saa "op" og "til:" staar paa hver sin linje ved sumo (`A870-390-dl-sumo-smal-t0.png`, `A870-390-dl-sumo-bred-t0.png`; `src/embed/deadliftAnimation.js`, teksten under figuren: en kort linje pr. tal i stoerre skrift, eller udelad ordene "op til:").

# Ordre 870, Bhishak, 30. sep. 2026

## Gren

`kritik-870` (fra `main`). Filer kun under `docs/kritik-870/` (denne rapport og scripts: `server-870.mjs`, `tur-870.mjs`, `squat-stang-870.mjs`, `ark-870.mjs`) og `outputs/kritik-870/` (billeder, samleark `ARK-*.png` og `maaling-870.json`). Set paa Yantras `main` (b7959d1, ordre 855 merget; nyeste rapport `RAPPORT-ordre-855.md`), hentet med `git archive` (dist og demo) og serveret paa 127.0.0.1 i headless Chrome paa 390 (touch) og 1280 (mus). 0 netkald ud af huset, ingen JS-fejl (kun een 404, formentlig favicon). Min seneste figur-kritik er 864. `Til Marc\LAES-MODELLER-3.html` er ikke aabnet; den er en samlet laeseside, og jeg har set figurerne direkte i dist og demo i stedet. Ingen atletdata; kroppene er modellens egne syntetiske. Et uncommittet rest fra 869 (en aendring i `docs/kritik-869/laes-log-869.mjs`) laa i traeet; jeg gemte den som patch uden for repoet og satte filen tilbage for at faa et rent trae.

## Hvad aendret

Intet i appen eller loeftmodellen (jeg retter aldrig i det, jeg kritiserer). Nyt er kun kritikkens egne filer: rapporten, fire scripts (genbrugt fra 864) og skaermbilleder: `T870-` stille figurer (bund/sticking/lockout, bryst/midt/lockout, opstilling/knaehoejde/lockout), `A870-` animationer (squat low og high bar; baenk lille, middel, stor; doedloeft konventionel, mellemting 49 cm, sumo 65,6 og 82 cm), `S870-` squat bund/sticking/lockout, `ARK-` samleark.

## Testresultat

Ingen tests koert, for der er ingen kode aendret. Malingen er scripts: `tur-870.mjs` (390 og 1280, 0 netkald, ingen JS-fejl) og `squat-stang-870.mjs`. Resultat i `outputs/kritik-870/maaling-870.json`. Jeg har set samleark i stedet for hvert billede i fuld stoerrelse, saa smaa tekstfejl kan vaere overset. Jeg har set en enkelt 1280-doedloeftfigur i fuld stoerrelse, ikke hele 1280-serien af doedloeft og baenk.

## Holder figurerne Marcs domme?

- Squat: ja. Albuen er under og bag stangen i alle set billeder (low bar bunden: 17 cm bag, 19 cm under; high bar bunden 11 cm bag, 23 cm under; high bar lockout kun 1 til 4 cm bag, 26 cm under, men aldrig ved hovedet). Low bar staar 3,7 cm under skulderen og high bar 1,1 cm over: kun et par cm forskel, stangens sted er et spektrum. Set paa 390 og 1280, side og forfra.
- Baenk: ja. Stangen staar paa brystet i bunden og led er stablet over skulderen i lockout (`T870-390-baenk-lockout.png`); toppen ligger taettere paa halsen, jo stoerre bue (21,1 / 19,1 / 16,8 cm fra skulder, `A870-390-baenk-stor-t0.png`). Forbehold, uaendret siden 864: undervejs haelder underarmen (`A870-390-baenk-middel-t0.png`), Yantra har meldt det som banens form.
- Doedloeft: ja. Skinnebenet staar helt frem til stangen i opstilling (knae 0,8 cm fra stangen, `T870-1280-doedloeft-opstilling.png`) og i sumo; fodbredden er et spektrum (32 til 82 cm; konventionel, mellemting 49, sumo 65,6 og 82 set).
- "Intet er binaert": ja, glideren for fodbredde og de tre baenkbuer er et spektrum.

## Ligner de rigtige loeft?

Ja. Squat-bunden, baenkens brystkontakt og doedloeftets start ligner en erfaren loefter. Lukket siden 864: (1) de raa decimaler i doedloeftets stand-tekst er vaek, der staar nu "stand 49 cm . 25° ud" og "hofte 35 cm over knae" som hele tal, og teksten klippes ikke (ordre 855, set paa `A870-390-dl-semi-t0.png`); (2) momentarmens streger er kortere og staar ikke tvaers gennem kroppen i doedloeft. Ikke lukket: de tre ting i dommen, og desuden:
- Overskriften "De tre buer, samme skala" er stadig klippet i toppen paa 390 (`A870-390-baenk-tre-buer.png`).
- Squat, bund, har stadig momentstreger gennem laaret paa 1280 og 390 (`S870-390-lowbar-bund.png`, `S870-1280-highbar-bund.png`); 855 rettede kun doedloeft.
- I doedloeft er den stiplede konventionelle skygge svaer at laese paa 390 uden at kende den.
- Doedloeft-opstilling forfra: den lille figur i frontvinduet er meget lille i forhold til teksten paa 1280 (`T870-1280-doedloeft-opstilling.png`); en coach laeser benstillingen dårligt.

Har arbejdet betydning for Hara? Nej.
