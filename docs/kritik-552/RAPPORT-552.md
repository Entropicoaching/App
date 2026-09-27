Ordre 552

# Kritik 552: skakkens nye gåder og kendte partier (Chaturanga 544) og matematikspillet efter Ganitas 542 (Bhishak)

**skakken stadig klar til eleverne: ja**
**kendte partier er rigtige: ja**
**matematikspillet foeles stadig som et eventyr: ja**

## Gren

`kritik-552` fra `main` (`45229ae`). Ingen push, ingen merges, ingen sub-agenter. Filer kun under
`docs/kritik-552/` og `outputs/kritik-552/`. Skak og matematik er kun læst med `git archive`
(skak `main` @ `5e6756c`; matematik `e085b2b` før og `main` @ `f9ef917` efter). Begge træer er
urørt. Chaturanga og Ganita står på egne grene i dem.

- `08d7902` blok 1: skakken (`docs/kritik-552/SKAK-5.md`).
- Blok 2: matematikspillet og denne rapport (`docs/kritik-552/MATEMATIK-3.md`). Hashen står i
  git-loggen.

547 (`bibliotek-547`) er **ikke** merget i skak `main`, så den er ikke vurderet.

## Hvad ændret

Intet i skak eller matematik. Kun kritik:

**Blok 1, skakken** (`SKAK-5.md`)
- "Øv et tema": 13 knapper på dansk, rigtige temaer, sværhed efter elevens rating (437-825 for en
  ny elev), licenslinjen (lichess.org, CC0) under gåderne og i licensteksten.
- "Kendte partier": **alle ti** partier tjekket mod min reference, halvtræk for halvtræk, plus
  spillere, sted og år. Alt rigtigt. Udsagnene i historierne er regnet efter på brættet. Usikre
  punkter står i tabellen (operaens dato, Rubinsteins 1907/08 og Łódź' land dengang,
  guldmønterne som Marshalls egen fortælling, Réti-Tartakower som friparti).
- Nye fund: **K13 middel** (på telefonen står brættet 1,6-1,9 skærme over skærmen efter et tryk på
  et kendt parti, 1,3-1,6 efter "Øv gafler"), K14 lav (O-O-O# i kongejagten får "Præcis sådan
  spillede Edward Lasker"; han spillede Kd2#), K15 lav (Steinitz: 22...Dxe7 er ikke mat), K16 lav
  (Réti 1910: "tidens stærkeste"), K17 lav (de nye lichess-gåder er kun 3-15 % af puljen i seks
  temaer).

**Blok 2, matematikspillet** (`MATEMATIK-3.md`)
- M8: Biavleren og Bigårdens skilt er der, opgaven om honningen passer til "Nye bistader".
  Skiltet er lille (24 px mod 44-49) og 3 px fra "Kirken og Landsbygaden" på 360, men rører ikke
  (N5 lav).
- M9: "To sække mel er lige store ..." og "Din figur er blevet klogere: Hoved er nu 2." læses
  rigtigt.
- M5: over fire terninger går 2/3 mod 2/5 fra 9 til 5 gange, ordrette gentagelser fra 8 til 3.
  Bedre, ikke løst.
- N2: følgeren hører om Hans 20-21 s efter, hun kom, med alle fire terninger (før 3:51-9:02 eller
  aldrig). Hans' quest kommer stadig 4-9 min efter (N8 lav, reglerne).
- Ankomsterne ved Landsbygaden (Else), Kirken og Sporvognen er der og er væk efter første svar.
  N3 lav (samme besked to gange på Landsbygaden og i Grusgraven), N4 lav (anførselstegn i
  anførselstegn).
- Marcs to valg kan læses af en lærer, men **N6 middel**: N1-A siger ikke, at elever, der i dag
  er Svend eller Mester uden at have hjulpet nogen, mister titlen. N7 lav: M2-A's Hjerte-tal
  starter på 1.

## Testresultat

- `node outputs/kritik-552/partier-552.mjs`: **41/41** (ti partier = referencen, historiernes
  udsagn regnet efter).
- `node outputs/kritik-552/skak-552.mjs`: **41/41** på 360, 390 og 1280 (12 temaer løst, ti
  partier løst, 0 net, 0 fejl, ingen vandret rulning).
- `rul-552.mjs` (K13), `pulje-552.mjs` (K17): målt, tal i SKAK-5.
- `elev-552.mjs`: før og efter med terning 525 på 390 og 1280 (med dag 2 og dag 3) og terning 7,
  42 og 1234 på 390. 16 kørsler af 30 minutter, **0 JS-fejl, 0 netkald**. Med terning 525 er
  tallene Ganitas (travl 2/3 mod 2/5: 5 til 2; Hans efter 6:02 til efter 0:21).
- `kort-552.mjs` (M8): skiltet på 360, 390 og 1280, 0 fejl.
- `node outputs/kritik-552/verify-kritik-552.mjs --blok 1` og `--blok 2`: grøn. `npm run lint`:
  grøn (i verify).

## Hvad er næste

**Chaturanga** (skak):
1. K13: rul til brættet (ikke til `#gaade-titel`), når eleven trykker på et kendt parti eller et
   tema. Det er det eneste, jeg ville rette før en time på telefoner.
2. K14: efter O-O-O# i kongejagten "Løst! Lasker spillede Kd2#, men O-O-O# er også mat."
3. K15 og K16: to sætninger i historierne (Steinitz og Réti).
4. Merge 547, så jeg kan måle "Mit bibliotek", "Gentag i dag" og K12.

**Ganita** (matematik):
1. Venter på Marcs svar på M2 og N1. Før Marc svarer, bør N1-A sige, hvad der sker med elever,
   der allerede er Svend eller Mester (N6), og M2-A, at Hjerte starter på 1 (N7).
2. N3 og N4: fjern den låste linje, når ankomsten står over den, og brug » « om questens navn.
3. N5: Bigårdens skilt lidt større eller lidt længere fra Kirkens.

**Hara** (skole-planeten, sporet "skakbrættet frit brædt og opgaver til undervisningen"): de
kendte partier er rigtige og kan bruges foran en klasse; K13 bør rettes, før eleverne selv
finder dem på telefonen.

## Ærlige grænser

- Min reference for partierne er min hukommelse af de kendte opgivelser, ikke et opslag (ingen
  net). En fejl, som Chaturanga og jeg husker ens, fanges ikke. Søgningen efter andre vindende
  træk går kun til mat i 1 og mat i 2 med skak.
- Eleverne er scripts, ikke børn; tiderne i matematikspillet er modellens ur. Sproget og Marcs
  valg er vurderet af mig.
- Terning 7, 42 og 1234 er kun kørt på 390 px.
- Hvis Ganita merger mere i matematik `main`, før Marc læser dette, gælder efter-tallene
  `f9ef917`, og verify blok 2 vil sige, at efter-kørslen ikke er på `main`.
- 547 er ikke målt.
