Maal dit billede stadig klar til sitet: ja

**Ja, og Setu skal kopiere 634 nu i stedet for 630.** Yantras 634 gør, hvad den siger:
- M21 er lukket for højden fra siden og fra Min krop, når filerne har en skrevet højde.
- M23 er lukket på siden. "1 uge" er svagt og tydeligt.
- M24 er lukket. Listen over rækker er rigtig.

Mine tre nye fund er alle lave (M27-M29), og ingen af dem stopper kopien. Ingen af dem gør et tal forkert:
- M27: PNG'et bryder "over grænsen, 1 uge" mellem "1" og "uge".
- M28: sætningen siger "Filerne", når kun nogle af filerne har en anden højde.
- M29: filer gemt med Min krop har ingen højde, så M21 kan ikke sige noget om dem.

M22, M25 og M26 står stadig. M26 er lidt større nu.

**Setu kopierer fra løftmodellens `main` (`2c8f284`):** `dist/maal-billede/` hel, med `miniaturer/`, som Yantra siger.
- Sitets `vaerktoejer` (`1169b5f`) er stadig blob for blob `4ca0c63` i alle fire mapper. Setu har ikke kopieret 630.
- Mod `main` er kun `maal-billede/index.html` og `maal-billede.js` anderledes. Siden 632 (`2ccb0bb`) er det også kun de to filer.
- Kopien fra `2ccb0bb` er derfor overhalet. Tag den fra `2c8f284`.

# Kritik 639, blok 1: Mål dit billede efter Yantras 634

Bhishak, 28. sep. 2026. Ordre 639.

**Løftmodellen:** `entropi-loeftmodel-dhruva` `main` @ `2c8f284` (merge af ordre-634), hentet med `git archive`. Intet træ er rørt. `docs/RAPPORT-dag-97.md` er læst.

**Sitet:** `entropi-coaching-site-wt2` `vaerktoejer` @ `1169b5f`. Jeg har målt i sitets kopi med `main`'s `dist/maal-billede/` lagt oven i. Det er det, Setus kopi vil give.

## Hvad jeg målte

`outputs/kritik-639/maal-639.mjs` gav **22/22** (`maal-639.json`, `.log`, `M-*.png`).

Opsætning:
- Google Chrome 154 headless: 390 med touch, 1280 med mus. Alt net uden for den lokale server er afbrudt. 0 netkald og 0 JS-fejl.
- **Filerne:** én måling er gemt med sidens egen Gem-knap. Min egen PNG-skriver (fra 610) har skrevet dato, højde, klik og runder om, så det giver én uge pr. fil.
- **Højden** skrives i feltet med `fill`, som en træner gør, og ikke med sidens api.
- **Min krop** er lagt i browserens lager, før siden åbnes: gennemsnittet for 178 cm og 85 kg med 10 % længere lår, som Yantras egen test.
- **Det gemte PNG:** sidens `fillText` er fanget, mens der gemmes. Så ses hver linje, filen tegner, og i hvilken farve.
- **Monte Carlo:** 2.000 forsøg pr. linje gennem sidens egen `ugeTabel`, med samme frø som 628 og 632. Tjekket mod siden: tre forsøg med 12 uger og 3 runder, givet siden som filer, gav samme antal guld, "1 uge" og M24-sætning (0/0, 5/1, 0/0).
- Kun syntetiske målinger. Billederne er grå flader.

Otte uger fra 3. aug., 1 runde uden klikfejl, som Yantras skærmbilleder: hoften er 13 cm oppe i uge 3 alene, i uge 5-6 og i den nyeste alene.

## Yantras punkter

### 1. M21: 165 på siden, filer fra én atlet gemt med 180

På 390 og 1280 står der:

> 8 målinger målt med kroppens længder (165 cm fra siden) som skala. Filerne er gemt med højden 180 cm; siden bruger 165 cm, og alle uger er regnet med sidens. Er filernes højde den rigtige, så skriv den i højdefeltet.

- Det er 5 linjer på 390 og 2 på 1280, lige over tabellen (`M-390-639-m21-165.png`).
- Skriver træneren 180 i feltet, forsvinder sætningen straks. Status siger kun "(180 cm fra siden)", og cm-rækkerne bliver 1,091 gange større.
- Tallene med 180 i feltet er præcis de samme som på en tom side, der tager den ældstes 180 selv. Den tomme side siger intet om en anden højde, og det er rigtigt.
- I det gemte PNG siger noten det samme ("siden bruger 165 cm"). Der er ingen måling i filen.

**Er sætningen klar? Ja.** Den siger hvilken højde, hvilken siden bruger, at alle uger er regnet med sidens, og hvad man gør. Den er lang, men den står kun, når noget er galt.

**Er det rigtigt, at siden ikke selv tager filernes højde? Ja.** Står der en højde på siden, kan træneren have rettet den med vilje, fx fordi atleten blev målt forkert første gang. Siden kan ikke vide, hvilken er rigtig. Nu kan træneren se det og vælge med ét felt. På en tom side tager siden stadig den ældstes højde, som før.

**Nyt lavt fund (M28):** fire filer med 180 og fire med 165, og 180 på siden, giver "Filerne er gemt med højden 165 cm; siden bruger 180 cm". Kun halvdelen af filerne er gemt med 165, og sætningen siger ikke hvilke. Det kan være to atleter i samme mappe, og så er det netop den situation, træneren skal opdage. Ret: "4 af 8 filer (uge 5-8) er gemt med højden 165 cm".

### 2. M21 med Min krop

**Min krop udfyldt og filer gemt med 180:**

> 8 målinger målt med kroppens længder (Min krop, 178 cm) som skala. Filerne er gemt med højden 180 cm; siden bruger 178 cm fra Min krop, og alle uger er regnet med sidens. Er filernes højde den rigtige, så ret Min krop.

- Rigtigt. Højdefeltet er skjult med Min krop, så "ret Min krop" er det eneste, træneren kan gøre. Der er intet link til Min krop i sætningen. Det ville hjælpe, men det er ikke nødvendigt.

**Filer gemt med Min krop (nyt lavt fund, M29):**
- En måling gemt på siden med Min krop har `hoejde: ""` og `vaegt: ""` i filen. De 178 cm, der blev regnet med, gemmes ikke.
- Åbnes de filer på en side med 165 skrevet (en anden browser eller en anden atlet), siges intet, og alle uger regnes med 165.
- Yantra skriver det selv under grænserne. Men det er netop den træner, der bruger Min krop på sin egen telefon, der rammer det.
- **Ret (Yantra):** gem den brugte højde i filen (fx `faelles.hoejdeBrugt` fra `K.hoejde`), også med Min krop, og lad `ugeSkala` bruge den, når `hoejde` er tom.

### 3. M23 på siden: er "1 uge" svagt nok og tydeligt nok?

Uge 3 og uge 8 har "1 uge". Uge 5-6 står i guld. Ingen "1 uge" står ved ≈ eller ved guld. Det er det samme på 390 og 1280 (`M-390-639-m23-1uge.png`, `-rullet.png`).

| | størrelse | farve | vægt |
|---|---|---|---|
| "1 uge" | 11,7 px | grå `rgb(185,180,168)`, kontrast 8,9:1 | 400 |
| forskellen over den (+12,4 cm) | 14,1 px | lys `rgb(237,234,226)` | 400 |
| forskellen i en ≈-celle (≈ 0,0 cm) | 11,7 px | samme grå | 400 |
| guld | 14,1 px | `rgb(200,146,58)` | 700 |

- **Svagt nok? Ja.** "1 uge" har samme grå og størrelse som ≈-cellernes forskel og som "samme kameraplads". Det råber ikke.
- **Tydeligt nok? Ja.** Forskellen er nu i fuld størrelse og lys, mens en ≈-forskel er lille og grå. Og der står et ord under. En hofte 13 cm oppe i én uge står ikke længere lige så stille som 0 cm.
- Rækken bliver ikke højere af mærket i mine tabeller (76 px med og uden), fordi rækken allerede har tre linjer for stangens "samme kameraplads".

**Hvor ofte står "1 uge" uden nogen ændring** (min Monte Carlo, samme stilling alle uger):

| | 8 uger | 12 uger |
|---|---|---|
| "1 uge" et sted, 1 runde | 44,3 % | 57,8 % |
| "1 uge" et sted, 3 runder | 39,7 % | 47,9 % |
| celler med "1 uge" i snit, 3 runder | 0,62 af 35 | 0,93 af 55 |
| guld et sted, 3 runder (som 632) | 5,6 % | 8,6 % |
| M24-sætningen, 1 og 3 runder | 9,2 og 8,6 % | 10,4 og 7,9 % |

Hver anden tabel uden ændring har altså ét "1 uge" et sted. Forklaringen under tabellen siger "det kan være et tilfælde", og det er ærligt. Med ét mærke i snit er det ikke støj.

### 4. M23 i PNG'et og M26

- Hver "1 uge" på siden har "over grænsen, 1 uge" i filen i grå (`#b9b4a8`): 6 = 6 med 8 uger og 6 = 6 med 12. Guld er det samme som på siden (6 = 6 og 12 = 12).
- **Nyt lavt fund (M27):** "over grænsen, 1 uge" brydes i to linjer i **alle 6 af 6 celler**, og altid som "over grænsen, 1" / "uge". Tallet står alene for enden af linjen, og "uge" står alene nedenunder. Guldlinjen brydes også i alle celler ("over grænsen, 2" / "uger i træk"). Se `M-390-639-uger-gemt-paa-telefon.png`.
  - **Ret (Yantra):** hårdt mellemrum i "1 uge" og "2 uger", som "+3,1 cm" allerede har. Eller kortere linjer, fx "1 uge" og "2 uger i træk", med betydningen i noten.
- **Højden (M26):**

| | 632 | nu |
|---|---|---|
| 8 uger | 1200 × 2648 | 1200 × 2828 |
| 12 uger | 1200 × 3714 | 1200 × 3865 |
| 8 uger uden nogen over grænsen | | 1200 × 2439 |

  Otte uger med 6 guld og 6 "1 uge" er 16 % højere end uden. På en telefon, der viser billedet i fuld bredde, er cellernes tal stadig ca. 7,8 px. M26 står og er lidt større.

### 5. M24: den nyeste uge

| tilfælde | sætningens ende |
|---|---|
| hoften 13 cm oppe kun i den nyeste | "Den nyeste uge står ikke i guld: kun én uge over grænsen indtil videre." |
| hoften i guld i uge 7-8, knæet 8 cm frem kun i uge 8 | "Den nyeste uge står ikke i guld i skinneben fra lodret: kun én uge over grænsen indtil videre." |
| hoften i guld i uge 7-8 alene | ingen M24-sætning |
| hoften op i uge 7 og ned i uge 8 | "Den nyeste uge står ikke i guld: kun én uge over grænsen indtil videre." |

- **Er listen rigtig? Ja.** Rækkerne i sætningen er præcis de rækker, der har "1 uge" i den nyeste kolonne på siden: skinneben fra lodret. Torso og hoftens højde står i guld og er ikke nævnt. Det er det samme på 1280 og i PNG'et.
- **Er sætningen klar? Ja, mest.** "står ikke i guld i skinneben fra lodret" læses lidt stift, fordi rækkens navn er et mål, ikke en kropsdel. Men det er entydigt, og det er det, tabellen hedder. Jeg gør det ikke til et fund.
- Hoften 5 cm oppe kun i den nyeste (12 uger, 3 runder): hoftens nyeste celle har "1 uge" i 59,3 %, og M24-sætningen står i 82,9 %. Resten er andre rækker alene over grænsen i den nyeste.
- Hoften 5 cm oppe fra uge 5 står stadig i guld i sin række i 77,5 % (632: 77,5 %). 634 har ikke flyttet guldet.

## Fund

| Fund | Styrke | Status |
|---|---|---|
| M21 | lav | lukket for en skrevet højde og for Min krop, når filerne har en højde (se M28 og M29) |
| M23 | lav | lukket på siden; i PNG'et se M27 |
| M24 | lav | lukket; listen over rækker er rigtig |
| M22 | lav | står (kort kameramærke) |
| M25 | lav | står (sig at 3 runder får guldet frem) |
| M26 | lav | står og er lidt større: 8 uger 2828 px mod 2648 |
| M27 | lav, ny | PNG'et bryder "over grænsen, 1 uge" mellem "1" og "uge" i alle celler, guldlinjen også |
| M28 | lav, ny | blandede filer: "Filerne er gemt med højden 165 cm", når kun 4 af 8 er, og uden at sige hvilke |
| M29 | lav, ny | en måling gemt med Min krop har tom højde, så M21 kan aldrig sige noget om den |

## Ærlige grænser

- **Kun headless Chrome på Windows.** Safari og en iPhone er ikke prøvet. iPhone-prøven fra 610 står stadig.
- **Kun syntetiske data.** Grå flader og modellens egen stilling med hoften og knæet flyttet. Ingen klip og ingen atletdata.
- **Klikfejlen i Monte Carlo er Yantras antagelse (E8)**, som i 628 og 632.
- **"Tydeligt nok" er min vurdering** ud fra farve, størrelse og skærmbilleder. Det er ikke prøvet på en træner.
- **M28 og M29 er målt med filer, jeg har skrevet om.** En træner, der blander to atleters filer, har jeg ikke set.
- **Sitet er ikke rørt.** Kopien er prøvet som sitets kopi med `main`'s `maal-billede/` lagt oven i, ikke som Setus commit.
