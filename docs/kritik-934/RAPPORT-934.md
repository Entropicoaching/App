Marcs domme holdt: ja (ingen brudt). Ligner rigtige loeft: ja, med tre forbehold. De tre vigtigste ting Yantra retter naeste gang: (1) doedloeft sumo smal (stand 66): hoften staar 12 cm over knaeet og langt bag stangen, laaret naesten vandret, saa figuren ligner en dyb squat med lige arme, mens sumo bred (27 cm over knae) ser rigtig ud; springet er stort for en lille aendring i stand (`outputs/kritik-934/A934-1280-dl-sumo-smal-t0.png` mod `A934-390-dl-sumo-bred-t0.png`; hoftereglen i `src/embed/deadliftAnimation.js`; Marc vaelger reglen, Yantra maaler mod en sumofilm); (2) baenk stor bue, frontvinduet: kun to arme og en graa klump, intet hoved og ingen skulderlinje paa main, og fod/laar staar stadig langt ude (`A934-1280-baenk-stor-t3.png`, `A934-390-baenk-stor-t3.png`; `src/embed/bench-animation.js`; skulderlinjen findes kun paa grenen ordre-926, ikke paa main); (3) squat: figuren fylder kun ca. en tredjedel af bredden paa 1280, og haandcirklen (haand 3x) og frontvinduet fylder meget paa 390 (`A934-1280-squat-lowbar-t2.png`, `A934-390-squat-highbar-t2.png`; layout i `src/embed/squatAnimation.js`; at skjule haandcirklen kraever Marcs ja).

# Rapport: Ordre 934, loeftfigurerne som de staar nu (Bhishak)

## 1. Hvad jeg vurderede
Yantras nyeste rapport paa main: `docs/RAPPORT-ordre-917.md` (main 770d6e5, hentet med git archive). Min seneste figur-kritik: 928. `LAES-MODELLER-3.html` er laest, ikke aendret. Jeg koerte 928-scriptet igen som `docs/kritik-934/tur-934.mjs` (headless, kun 127.0.0.1, syntetisk krop, fremmede netkald blokeret) paa 390 touch og 1280: squat low bar/high bar (side og forfra, animation), baenk lille/middel/stor bue, doedloeft konventionel, semi (49), sumo smal (65,6), sumo bred (82). 105 skaermbilleder i `outputs/kritik-934/`. Jeg har set de vigtigste selv (sumo smal/bred, konventionel, baenk stor paa begge bredder, squat low/high, tre buer), ikke alle 105.

## 2. Marcs domme
- Baenk: stangen rammer buens top med staplede led, underarmen lodret (ja i alle tre buer). Toppen taettere paa halsen jo stoerre bue: kontakt 21,1 / 19,1 / 16,8 cm fra skulder, laend 7,3 / 9,0 / 10,6. Holder.
- Squat: albuen under og bag stangen, aldrig ved hovedet: low bar 12 cm bag / 20 cm under, high bar 8 cm bag / 25 cm under. Low bar kun lidt under high bar. Holder.
- Doedloeft: skinnebenet helt frem til stangen i start i alle stande. Fodbredden er et spektrum (32 til 82 cm). Holder.
- Intet er binaert: alle tre har glidere eller tre trin. Holder.

## 3. Hvad ser stadig unaturligt ud
- Sumo smal: hofte lav og langt bag stangen, laar naesten vandret, arme lige. Springet 12 cm (smal) mod 27 cm (bred) over knae er stort.
- Baenk stor bue: benet er kortere end foer (917), men foden staar stadig langt ude og laaret ligger naesten vandret. Mindre slemt end i 928.
- Baenks frontvindue: to arme og en graa klump, intet hoved.
- Squat 1280: lille figur i stor sort flade. Haandcirklen og frontvinduet spiser plads paa 390.
- Konventionel: naturlig (hofte 38 cm over knae). Ingen anmaerkning.

## 4. Er mine seneste fund (928) lukket
1. Sumo smal hofte: aabent. 917 forklarede hoften i panelet (modelvalg), men flyttede den ikke; billedet er uaendret (12 cm over knae).
2. Baenk frontvindue og squat-bredde: aabent paa main. Skulderlinjen blev lavet paa grenen ordre-926 og omtalt paa laesesiden, men main viser den ikke; laesesiden er foran main. Squat paa 1280 uaendret.
3. Baenk stor bue, benet: delvist lukket. Skinnebenet 36 til 32 grader og ankel bag knae 23,9 cm, men laar og fod ser stadig langt ud.

## 5. Graenser og Hara
Kun syntetisk krop; ingen atlet- eller klipdata; kun main-versionen (ikke ordre-926). "Ligner rigtige loeft" er en laesning af billeder, ikke en maaling. Ingen loeftmodel, site eller appkode aendret; ingen push, merge eller miljoevariabler roert. Har arbejdet betydning for Hara: nej. Aflevering med hoest.mjs blev afvist af tilladelsessystemet og er ikke koert.
