Ordre 648: to kritikker, matematikspillet efter Ganitas 643 og Vaidyas NYT-I-APPEN.html (644). Bhishak, 28. sep. 2026.

**Matematikken mindre rodet: ja.** "Tilbage til kortet" står nu samme sted på alle tre sider, knapperne står på én række, og Min helt er en femtedel kortere. Men den første skærm har stadig ikke opgaven.

**Hoved/Hånd/Hjerte forståelig for en 11-årig: nej.** Hjerte ja. Hoved og Hånd siger kun, hvornår tallet vokser, ikke hvad det er til, og en helt ny elev ser aldrig forklaringen.

**NYT-I-APPEN klar til at Marc kan sende den: ja.** Alle punkter passer med koden på `391144e`, og tonen er rolig. Billede 5 (farvebjælker) bør skiftes først.

## Gren

`kritik-648`, lavet med `git checkout -b kritik-648 main` fra `main` @ `40422a9` (merge af kritik-645, som indeholder `391144e`) i `entropi-app-kritik`.

- `2538f02` kritik 648 blok 1: matematikspillet efter Ganitas 643
- commit 2: NYT-I-APPEN, verificering og denne rapport. Hashen står i `git log`.

Filer kun under `docs/kritik-648/` og `outputs/kritik-648/`. Ingen push, ingen merges, ingen sub-agenter, intet sendt.

Matematikken er hentet med `git archive` (`main` @ `31d22fd` og `ordre-643` @ `471784d`); træet er ikke rørt, og Ganita arbejder stadig i det. `NYT-I-APPEN.html` og Vaidyas filer i `ordrer/kilder/vaidya-644/` er kun læst. Appens kode er læst med `git grep` på `391144e` i dette træ, ikke i `entropi-app`.

## Hvad ændret

Kun mine dokumenter og scripts; ingen matematik, app eller Vaidya-filer.

### Blok 1: matematikken (`MATEMATIK.md`)

- 643 er ikke merget, og `RAPPORT-643.md` findes ikke (Ganitas blok 3 er ikke committet). Jeg vurderer blok 1 og 2, som de er committet på `ordre-643`.
- **Bedre:** "Tilbage til kortet" står øverst (24 px) på Min helt, i Journalen og i Questbogen; før lå den 811 til 3041 px nede. Min helt fra 406 til 331 ord og 3,73 til 3,02 skærme på 390. Låste steders krav er væk fra kortet.
- **De tre vigtigste ting, der stadig er rodede:**
  1. **G3:** opgaven står 1642 px nede på 390 (1,9 skærme) og 1801 på 1280; den første skærm har ingen næste handling.
  2. **G4:** otte slags tal på Min helts første skærm (niveau, erfaring to gange, point, udstyr, titler, Hoved, Hånd, Hjerte).
  3. **G2:** Hoved og Hånd gør intet i spillet, og forklaringen kan kun sige, hvornår de vokser. Skellet tænke/gøre passer ikke med opgaverne (dele brød er Hoved, måle er Hånd).
- **G1 middel:** en ny elev bliver rullet til åbningsscenen (`scrollY` 1607), forklaringen står ved y 266, og flaget sættes ved tegning. Efter genindlæsning er den væk.
- G5 (to Hjerte-forklaringer på Min helt) og G6 ("?" 30 px på Hjertes hjørne) er lave.
- For Marc foran klassen: pænt og roligt, intet at skamme sig over. Irritationen er rulningen til opgaven.

### Blok 2: NYT-I-APPEN.html (`NYT-I-APPEN.md`)

- Alle seks punkter og linjen nederst passer med koden på `391144e`. Alle seks citater står ordret i `src` eller `public` (e1RM-linjen som skabelonen i `fremgangLinje`).
- 324 ord, 6/6 billeder, 0 px sidelæns, lys og mørk, 390 og 1280, 0 net, 0 JS-fejl.
- Tonen: rolig, du-form, ingen salg, e1RM forklaret. Første og sidste sætning tager frygten og giver Marcs dør.
- **N1 middel:** billede 5 viser farvebjælker (et testbillede) som videoen; det ligner en fejl.
- N2 til N5 lave: "Dag 1 · Squat" over en bænkpres i billede 1; 🏆 står kun 5 s; "Hvordan gik det?" kun fra Dagens pas; punkt 6's coach-sætning kan strykes.

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-648/mat-648.mjs` | før og efter, 390 og 1280: 0 net, 0 JS-fejl; tallene ens i to kørsler. `mat-648.json`, 24 billeder `M648-*.png` |
| `node outputs/kritik-648/nyt-648.mjs` | 4 kørsler (390/1280 × lys/mørk): 324 ord, 6 punkter, 6/6 billeder, 0 px sidelæns, ingen tankestreg; 6/6 citater fundet i koden; 0 net, 0 JS-fejl |
| `node outputs/kritik-648/verify-kritik-648.mjs --blok 1` | GROEN (før commit 1) |
| `node outputs/kritik-648/verify-kritik-648.mjs --blok 2` | GROEN (før commit 2): gren, kun egne mapper, ingen upstream, ASCII, begge JSON, filens hash, dokumenterne og rapporten |
| `npm run lint` | grøn |

Ingen andre `verify:*` er kørt: ingen appkode er rørt.

## Hvad er næste

**Ganita** (matematik, Marcs valg hvor det rører spillet):
1. G1: sæt `ganita:hhh-set` ved "Forstået" (eller når boksen har været i syne), ikke ved tegning. Lille, kun visning.
2. G3: en knap "Til opgaven" øverst, eller opgaven over kortet på 390.
3. G4: fjern boksen Erfaring på Min helt (den står i hovedet); fold Udstyr og Titler ned.
4. G5 og G6: én Hjerte-forklaring; "?" 44 px og ikke på Hjertes hjørne.
5. G2 er **Marcs** valg: skal Hoved og Hånd betyde noget (og hvad), eller skal de slås sammen, så der står ét tal ved siden af Hjerte?

**Vaidya** (NYT-I-APPEN, kun hvis Marc vil have det før han sender):
1. N1: beskær billede 5 til banneret, eller tag det med en syntetisk løftevideo.
2. N2: et billede 1, hvor passets titel passer med øvelsen.
3. N3 til N5: tre ord-rettelser (se `NYT-I-APPEN.md`).

**Marc:** siden kan sendes nu. Matematikken er værd at vise frem, men læg mærke til, at opgaven står under kortet.

**Til Hara:**
- Coaching-planeten, delmål "Appen mærkbart bedre": `NYT-I-APPEN.html` er tjekket punkt for punkt mod koden og er klar til at sendes. Atleterne får på et minut at vide, hvad pushet gav, og at resten er som før.
- School-planeten, spor matematik-minispil: 643 gjorde spillet mindre rodet, men Hoved og Hånd er stadig uforklarlige, fordi de ikke gør noget. Det er Marcs valg.

## Ærlige grænser

- **Ingen rigtig 11-årig eller atlet har set noget af det.** Tal (ord, tal, knapper, y-positioner, citater i koden) er målt; "forstår", "rolig" og "Marcs tone" er mit skøn.
- 643 er ikke færdig. Ændrer Ganitas blok 3 spillet, skal blok 1 måles igen (`mat-648.mjs` kan køres med en ny ref).
- Ét gemt spil (niveau 2) og én ny elev; senere i spillet er skærmene længere. Headless Chromium på Windows, ikke en skole-pc, projektor eller telefon. Skriftstørrelser ikke målt.
- NYT-I-APPEN: punkterne er læst i koden, ikke kørt i appen af mig (Vaidyas skud-644 kørte dem mod mocken). Service worker-delen er læst, ikke målt.
- Eleven hedder Tulle, et fantasinavn. Ingen elevdata, ingen atletdata.
