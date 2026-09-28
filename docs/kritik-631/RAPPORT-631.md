Ordre 631

# Kritik 631: Instagram 7-12 (Setu 624) og matematikspillet efter Ganitas 626 (Bhishak)

**Domme:**
- Instagram 7-12 klar til Marcs godkendelse: nej. Ret nr. 10 (I8, figuren og en sætning er 1's) og nr. 8 (I9, "knæene er strakt"). 7, 9, 11 og 12 er klar.
- Matematikken stadig klar til Marcs klasse: ja. Det gælder `main` `edd01b5`, som er uændret siden 617. `ordre-626` (`e5e0573`) må ikke merges alene (M18).
- Det betaler sig altid at hjælpe, også for den svage ærlige: ja med 626 blok 1. På `main` er det stadig nej (M15).

## Gren

- `kritik-631` fra `main` (`fc1f390`) i `entropi-app-kritik`.
- Commit 1 (blok 1, Instagram): `6c0aca5`. Commit 2 (blok 2, matematikken og denne rapport): se `git log`.
- Filer kun under `docs/kritik-631/` og `outputs/kritik-631/`.
- Intet pushet, intet merget og intet postet.
- Setus mappe, sitet, løftmodellen og matematik-træet er kun læst. Spillet er hentet med `git archive`.

## Hvad ændret

**Blok 1, `docs/kritik-631/INSTAGRAM.md`.**
- Tværs af alle seks: 0 regelbrud. Henvisningen og forbeholdet står nederst i alle seks, og alle tal står på løftmodellens figursider.
- **I8 (middel), nr. 10:** slide 3 er `k7-reference-bund.svg` med samme beskæring som 1's slide 1-3. Billedtekstens sidste afsnit starter med 1's sætning ordret. Det bryder "ingen gentagelse af 1-6", og PLAN siger ellers "andre figurer".
- **I8b (lav), nr. 11:** opstillingen og 61° er 6's figur. Knæhøjde og lockout er nye.
- **I9 (lav), nr. 8:** billedteksten siger "hvor knæene er strakt", men knæet er 127° i figuren.
- **I10-I13 (lav, valgfri):**
  - "I modellen" i 8.
  - 9's første slide er bygget som 3's.
  - Setus to overgange i 7 skal læses som Marcs egen tekst.
  - "bias" står i to betydninger i 10.
- **Setus tre spørgsmål:**
  - 7 slide 2 er Marcs sætning og i orden.
  - "knæet skifter retning" i 8 er rigtig fysik: momentarmen går fra 0,8 cm bag til 10,0 cm foran.
  - Vinduerne i 9 er ca. 150 px brede i 360 px. Armenes hældning kan ses.

**Blok 2, matematikken:**
- **Ganitas 626:** `ordre-626` har kun blok 1 committet: `e5e0573` "den svage ærlige hjælper bliver ven (M15)".
  - Der er intet committet til M17, og `outputs/RAPPORT-626.md` findes ikke (ikke på grenen, ikke i træet).
  - I træet ligger ucommittede ændringer, bl.a. `LOEFT_ANDEL = 1 / 2` i `src/faerdigheder.js`. Dem har jeg set med `git diff` men ikke målt, for de er ikke afleveret.
  - Jeg har vurderet det committede, som ordren siger.
- **Min elev:** `outputs/kritik-631/elev-631.mjs` er min `elev-617.mjs`, kun ændret i filnavne og i, at `venner` og `tilbage` logges i 20-minutterssnap og slut.
  - Hun læser 626's ven-linje, fordi den står i `.bog-hvile`, som hun læser i forvejen.
  - `koer-elever-631.sh` kører 8 kørsler (16 elevforløb) i headless Chromium, 390 touch uden net, 40 minutter på elevens ur med snap ved 20.
  - Eleverne er gætteren (1 s pr. tryk), den svage ærlige (40 %) og den dygtige (90 %), hver som travl og hjælper, på `main` `edd01b5` og `ordre-626` `e5e0573`.
  - Terningen er 525. Gætteren er også kørt med 731.
  - `opsummer-elev-631.mjs` laver `elev-631-tabel.json`, og `elev-tjek-631.mjs` skriver påstandene i `elev-631.json`.

### Niveau efter 20 / 40 minutter (terning 525, 390)

| Elev | Travl main | Hjælper main | Travl 626 | Hjælper 626 | Hjælper 626: Hjerte, venner, "kommer forbi" |
|---|---|---|---|---|---|
| gætter | 2 / 6 | 7½ / 9 | 2 / 6½ | **8 / 14** | 11, 10, 9 |
| svag ærlig (40 %) | 1 / 2 | 2 / 4 | 1 / 2 | **2½ / 5** | 3, 2, 2 |
| dygtig (90 %) | 7 / 12½ | 7½ / 15½ | 7 / 12½ | 7½ / 15½ | 5, 4, 4 |
| gætter, terning 731 | 1 / 1 | 1 / 3½ | 1 / 1 | 1½ / 4½ | 4, 3, 3 |

**M15, den svage ærlige: lukket med 626.**
- På `main` hjælper hun 5 gange, alle hviler, og hun ender med Hjerte 1, 0 venner og 0 "kommer forbi", som i 617.
- På 626 står "Ane: 'Tak, fordi du blev ved, til alle var løst.' Hjerte er nu 2 ..." under hvilen kl. 8:23. Niels følger kl. 28:50.
- Ane kommer forbi kl. 18:42 med "Du blev ved med »Mel til bageren« ...", og Niels kl. 40:00.
- Hun ender på niveau 5 og Hjerte 3 mod den travles 2 og 1. Efter 20 minutter er hun på 2½ mod 1. Hjælpen giver nu noget, der kan ses.
- Hjælperen ligger ikke under den travle for nogen af de tre elever, hverken efter 20 eller 40 minutter.

**M17, gætteren: ikke lukket, og 626 gør det værre (M18, ny, høj).**
- Venskabet kræver kun, at alle personens opgaver er løst, og gætteren løser dem altid til sidst.
- Én gang pr. person holder ikke, for der er mange personer. Han trykker "Hjælp" 27 gange (17 på `main`) og får 10 venner og 9 "kommer forbi" på 40 minutter.
- Han ender på niveau 14 mod 9 på `main`, næsten den dygtiges 15½ og næsten tre gange den svage ærliges 5. Efter 20 minutter er han Mester (8).
- Med terning 731 går han fra 3½ til 4½.
- Sidens eget "Rigtigt!" i første forsøg: gætteren 36-39 %, den svage ærlige 44-46 % og den dygtige 86 %.
- Den dygtige er den samme på begge udgaver (niveau, Hjerte og Brøker). 626 rører kun dem, der bliver ved uden at klare.

**M14, grænsen: urørt.**
- `HEL_VAERDI_ANDEL = 1 / 3` står på både `main` og `e5e0573`, og `src/faerdigheder.js` er ikke ændret mellem dem.
- "Halv værdi" ses 0 gange hos alle 16 elever.

**Dommene:**
- Matematikken på `main` er det samme spil, som jeg sagde ja til i 617. M17 er stadig åben der, men ikke værre.
- Blok 1 fra 626 løser Marcs ønske for den svage ærlige ("Det betaler sig altid at være et godt menneske"). Men den giver gætteren en ny kilde, som han bruger mere end nogen anden. Den bør derfor ikke merges uden en M17-rettelse, der også dækker venskaberne.
- Den fri vilje er urørt: den travle er den samme på begge udgaver, bortset fra gætterens venner fra de "!", han rammer mellem opgaverne.

| Fund | Vægt | Status | Hvad |
|---|---|---|---|
| M14 | | urørt | En tredjedel på begge udgaver. |
| M15 | middel | lukket på `ordre-626`, åben på `main` | Den svage ærlige får venner, Hjerte 3 og niveau 5 mod 4. |
| M17 | middel | åben, intet committet | Gætteren, der hjælper, er blandt de bedste. |
| M18 | høj | ny | 626's venner uden klaret giver gætteren 10 venner, 9 halve niveauer og niveau 14 på 40 min (9 før). |

## Testresultat

- `node outputs/kritik-631/insta-631.mjs`: 15/15.
- `bash outputs/kritik-631/koer-elever-631.sh a` og `b`: 8 kørsler, exit 0, 0 JS-fejl, 0 net.
- `node outputs/kritik-631/opsummer-elev-631.mjs` og `node outputs/kritik-631/elev-tjek-631.mjs`: 11/11.
- `node outputs/kritik-631/verify-kritik-631.mjs --blok 2`: grøn.
- `npm run lint`: grøn.

## Hvad er næste

- **Setu:**
  - Ret nr. 10 (I8): en anden figur end 1's, fx `k7-reference-sticking.svg` eller en tegning af stangens plads, og et sidste afsnit, der ikke starter med 1's sætning.
  - Ret nr. 8 (I9): "hvor knæene er strakt mere" eller "hvor skinnebenet er rejst".
  - Kør så `node lav.mjs 10`, `node lav.mjs 8` og `node laeseside.mjs`.
  - I8b og I10-I13 er valgfri. Derefter kan Marc svare `instagram ok 7-12`.
- **Ganita:**
  - Merg ikke 626 blok 1 alene. M17-rettelsen skal også dække venskaberne (M18).
  - Mit forslag: en ven, man er blevet ved med, giver Hjerte og følger på kortet, men ikke det halve niveau fra "kommer forbi". Eller det halve niveau kommer kun én gang pr. sted. Så beholder den svage ærlige det synlige (Hjerte 3, Ane og Niels på kortet), og gætterens niveauer fra venskaber forsvinder.
  - Grænsen mellem gætteren og den svage ærlige i første forsøg er smal (36-39 % mod 44-46 %). En tærskel på 1/2 (som i det ucommittede `LOEFT_ANDEL`) ligger over begge. Kør min `elev-631.mjs` (gætter 525 og 731, svag 525) på den afleverede 626, og skriv `RAPPORT-626.md`.
- **Marc:** vælger, om det halve niveau for et venskab uden klaret skal blive (M18 mod M15).
- **Hara (Coaching-planeten):** Instagram 7-12 er to rettelser fra Marcs godkendelse og kan så udgives i uge 43-44.

## Ærlige grænser

- **626 er ikke færdig:** kun blok 1 er committet, M17 er ikke, og der er ingen `RAPPORT-626.md`. Dommen om M17 gælder `e5e0573`, ikke Ganitas ucommittede arbejde.
- **Kun min model-elev.**
  - Gætteren trykker hvert sekund i 40 minutter, og det gør et barn næppe.
  - "Dygtig" er 90 % (617 brugte 70 % som den ærlige, og den er ikke kørt igen).
  - Kun terning 525 for de ærlige, og kun 390.
- **Headless Chromium** på Windows, ikke en telefon eller skole-pc.
- **Instagram:** headless Chrome og kontaktark i 360 px, ikke Instagram på en rigtig telefon. Tallene er holdt op mod figursiderne, ikke regnet igen i løftmodellen.
- **Syntetiske data:** kun syntetiske elever ("Tulle") og ingen rigtige atleter, elever eller klip. Navnetjekket fanger kun navnene i appens `.gitignore`.
