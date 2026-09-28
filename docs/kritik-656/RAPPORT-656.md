Ordre 656: to kritikker, matematikspillet efter Ganitas 651 og skakken efter Chaturangas 649. Bhishak, 28. sep. 2026.

**Matematikken mindre rodet: ja.** Den første skærm siger nu, hvad man skal gøre: én brun knap "Din opgave nu · »Del ligeligt« hos Mølleren", og ét tryk bringer svarknapperne frem. Min helt er uændret og stadig fuld af tal.

**Hoved/Hånd/Hjerte forståelig for en 11-årig: ja.** Hver siger nu, hvad den er, med de steder barnet kan se på kortet, og en helt ny elev ser forklaringen. Men Hoved og Hånd gør stadig intet ud over at følge niveauet.

**Skakken stadig klar til Marcs klasse: ja.** "Alle:", "Ny Gafler-rekord!" og søjlerne på 44 px virker på 360, 390 og 1280. Slutkortet har stadig fire linjer rekorder under hinanden.

## Gren

`kritik-656`, lavet med `git checkout -b kritik-656 main` fra `main` @ `bbdd878` i `entropi-app-kritik`.

- `d9c88bc` kritik 656 blok 1: matematikspillet efter Ganitas 651
- commit 2: skakken, verificering og denne rapport. Hashen står i `git log`.

Filer kun under `docs/kritik-656/` og `outputs/kritik-656/`. Ingen push, ingen merges, ingen sub-agenter. Matematik (`de17445` og `6e83254`) og skak (`ea0e6f1`) er hentet med `git archive`; begge træer er ikke rørt. Ganitas `outputs/RAPPORT-651.md` og Chaturangas `outputs/RAPPORT-649.md` er læst fra `main`.

## Hvad ændret

Kun mine dokumenter og scripts; ingen matematik, app eller skak.

### Blok 1: matematikken (`MATEMATIK.md`)

- **Bedre, og mærkbart for et barn:** "Din opgave nu" står på første skærm (y 347 på 390, 323 på 1280). Ét tryk ruller til Mølleren med alle tre svar på skærmen og fokus på det første. Før skulle hun rulle 1642 px forbi kortet. Bjælkens linje med samme opgave er væk, så første skærm har færre ord (53 til 49 på 390).
- **Ny elev (648 G1 rettet):** efter "Start eventyret" står siden øverst, hele forklaringen er på skærmen, flaget sættes ved Forstået, og Forstået ruller til Mølleren.
- **Ordene:** "Hoved er at regne: dele, brøker og klokken ved Møllen, Kirken og Sporvognen." og "Hånd er at bruge matematikken: måle i Grusgraven og handle med penge på Landsbygaden." Hver med "Når det vokser, stiger din helt også et niveau", som er sandt (`givNiveauPoint`). Alle fem stednavne står på kortet. Hjerte uændret.
- **De tre vigtigste ting, der stadig er rodede:**
  1. **Min helt (G4, G5):** uændret; otte slags tal på første skærm, erfaring to gange, to Hjerte-forklaringer.
  2. **Opgavens spilsprog (G7, ny):** "0 af 4 opgaver løst · mestret ved 3 rigtige i første forsøg" og "Brøker 60" er det første, barnet læser efter trykket.
  3. **Hoved og Hånd gør intet (G2):** ærligt forklaret, men uden virkning. Marcs valg.
- G6 ("?" ser ud som 30 px og sidder på Hjertes hjørne, men trykfladen er nu 44) og G8 ("at bruge matematikken" er et voksenord) er lave.
- Marc foran klassen: pænt og roligt, én tydelig knap; intet at skamme sig over.

### Blok 2: skakken (`SKAK.md`)

- **649 virker:** "Alle: bedst 10 i dag · bedst 10 denne uge." på én linje på 360, 390 og 1280; "Ny Gafler-rekord!" uden "Ny rekord" over alle temaer; søjlerne er 22 × 44 px, et tryk 6 px under den nyeste giver boblen og starter ingen storm; "Dagens storm" kan stadig rammes i kanten. Også på 360 × 640.
- **Stadig rodet:**
  1. **S13 middel:** slutkortet siger "Ny Gafler-rekord!" og lige under "Din rekord på denne enhed: 20 gåder". To rekorder uden forskel forklaret, fire linjer tal.
  2. **S14 lav:** "0 forkerte træk (−0 s)" og "Ingen forkerte træk. Flot!" siger det samme.
  3. **S15 lav:** søjlerne har ingen overskrift. Plus #33 ("rekord 5." alene på 360 og 390), som Chaturanga kender.
- S16 lav: "Dagens storm (28/9)" og " - " som tankestreg i to tekster.
- Marc foran klassen på 1280: "Dagens storm" står på første skærm ved siden af brættet; lærersiden er rolig. Intet at skamme sig over.

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-656/mat-656.mjs` | før og efter, 390 og 1280, gemt spil og ny elev: 0 net, 0 JS-fejl. `mat-656.json`, 28 billeder `M656-*.png` |
| `node outputs/kritik-656/skak-656.mjs` | 360, 360 × 640, 390, 1280 og lærersiden: 0 net, 0 JS-fejl, en Gafler-storm med 5 spillet med tryk på hver. `skak-656.json`, 17 billeder `S656-*.png` |
| `node outputs/kritik-656/verify-656.mjs --blok 1` | GROEN (før commit 1) |
| `node outputs/kritik-656/verify-656.mjs --blok 2` | GROEN (før commit 2): gren, kun egne mapper, ingen upstream, ASCII, begge JSON, dokumenterne og rapporten |
| `npm run lint` | grøn |

Ingen andre `verify:*` er kørt: ingen appkode er rørt.

## Hvad er næste

**Ganita** (matematik, Marcs valg hvor det rører spillet):
1. G4 og G5: fjern boksen Erfaring på Min helt, fold Udstyr og Titler ned, behold én Hjerte-forklaring.
2. G7: én linje over opgaven, som en 11-årig forstår ("3 rigtige i træk, så er du færdig"); "Brøker 60" væk fra opgaven.
3. G6 og G8: "?" væk fra Hjertes hjørne; "Hånd er at måle og handle".
4. G2 er **Marcs** valg: skal Hoved og Hånd have en virkning, eller slås sammen til ét tal ved siden af Hjerte?

**Chaturanga** (skak):
1. S13: slutkortet viser kun stormens egen linje; "Din rekord på denne enhed" og "Alle:" bag en fold eller væk.
2. S14 og S15: ingen "(−0 s)" ved nul fejl; "Dine sidste stormer" over søjlerne.
3. #33 sammen med S13, og S16 (datoen og " - ") når han alligevel er i teksterne.

**Marc:** begge kan vises frem. Matematikken er nu det bedste, den har været på første skærm; skakken er som før, med et slutkort der er lidt for fuldt af tal.

**Til Hara:** School-planeten, spor matematik-minispil: 651 gjorde matematikken mærkbart mindre rodet (opgaven på første skærm, forklaringen ses af nye elever, Hoved/Hånd/Hjerte forståelig). Tilbage er Min helt og et valg for Marc om Hoved og Hånd. Skakken er stadig klar til klassen.

## Ærlige grænser

- **Ingen rigtig 11- eller 12-årig, klasse eller projektor har set noget af det.** Tal (ord, knapper, y, linjer, trykflader, flag) er målt; "forstår", "roligt" og "skamme sig" er mit skøn ud fra skærmbillederne.
- Matematik: ét gemt spil (niveau 2, Møllen) og én ny elev. Senere i spillet er Min helt længere.
- Skak: én storm (Gafler, 5 løst, 0 fejl) med Chaturangas syntetiske lager, som ikke hænger helt sammen ("bedst 10 i dag", søjler højst 6). Et andet slutkort (fejl, ingen rekord) er ikke set.
- Touch er emuleret i headless Chromium på Windows, ikke en rigtig telefon, Safari eller skole-pc.
