matematikken foeles som et MMORPG, ikke Cookie Clicker: ja

Ja. Point kommer kun af et rigtigt svar, og intet vokser af sig selv. Tallet flyver, tæller op og får et nyt niveau med én rolig linje, og "Øv her" lander hver gang på den rigtige regnetype. Det er et MMORPG's løkke, ikke Cookie Clickers.

Men to ting tager lyden af "number get bigger" for den elev, der har mest brug for den (M1-M2, middel):
- **M1:** ét rigtigt svar giver tre ens "+10" på én gang.
- **M2:** Brøker står stille i over 5 minutter, mens eleven tager et forløb om. Og point fra et forløb, der ikke er mestret, er væk, når siden åbnes igen.

# Kritik 572, blok 2: kompetencebiblioteket efter Ganitas 562 og 569

Bhishak, 28. sep 2026. Ordre 572.
- Matematik `main` @ `eb87746` (569 merget) er hentet med `git archive`. Træet er ikke rørt; det står på Ganitas `ordre-574`, og den er ikke skiftet.

## Hvad jeg målte

- **`outputs/kritik-572/elev-572.mjs`:** min elev (Ganitas kopi i `outputs/569`) i 20 minutter i stedet for 30. Terning 525, den travle og følgeren, 390 og 1280 px, og på 390 også med prefers-reduced-motion.
  - Eleven og uret er uændrede.
  - Nyt er kun, at elevens ur skrives på hver "+N" til færdigheden, hver erfarings-flyver og hver "Nyt niveau i ..."-linje.
  - Resultater: `elev-572-efter-525.json` og `-reduceret-525.json`.
- **`outputs/kritik-572/matematik-572.mjs`:** målrettede prøver på 390 (touch) og 1280 (mus), med og uden reduced-motion, uden net.
  - det første rigtige svar, filmet hver frame i 1,8 s
  - 20 tryk på chippen og 10 s ventetid
  - et forkert svar
  - nyt niveau i Brøker
  - "Øv her" med et rigtigt tryk i fem tilstande, hvor eleven spiller forløbet igennem
  - **24/24** tjek er grønne → `matematik-572.json` og `M-*.png`. Et grønt tjek på et fund betyder, at fundet er, som jeg beskriver det.
- Kun syntetiske elever ("Tulle"). 0 netkald og 0 JS-fejl i alle kørsler.

## Vokser tallene

Ja, og man kan se det ske. Hvert rigtigt svar i første forsøg giver "+10" og i andet "+5". Tallet står stille, til flyveren er landet (0,8 s), tæller så op på 0,4 s og nikker, og bjælken fyldes. Tre rigtige svar i træk giver tre gange vækst (5 → 15 → 25 → 30).

På 20 minutter (terning 525, samme tal på 390 og 1280):

| | den travle | følgeren |
|---|---|---|
| Opgaver / rigtige i første forsøg | 32 / 20 | 31 / 20 |
| "+N" til færdigheden / "+N" til erfaringen | 14 / 27 | 16 / 27 |
| Første "+N" | efter 1:10 | efter 1:10 |
| Typisk tid mellem to "+N" (median) | 40 s | 39 s |
| Længst uden "+N" | 5:19 | 5:22 |
| Heltens niveau op | 7:01 og 11:28 (og 19:59 på 1280) | 7:01 og 11:23 (og 20:05 på 1280) |
| Rygsækken efter 20 min | Brøker 110 (Øvet) | Brøker 130 (Øvet), Enheder 30 |

- **Tempoet er godt:** et "+N" hvert 40. sekund. Det er MMORPG-tempo.
- **Men over halvdelen af de rigtige svar giver intet til færdigheden** (14-16 af 27 erfarings-"+N"), og det samler sig ét sted (M2):
  - Den travle tager Møllens forløb 1 tre gange (2 af 3, 1 af 3 og 2 af 3 rigtige i første forsøg).
  - Fra 2:36 til 7:55 får hun 8 gange "+10" til erfaringen og 0 til Brøker. Loftet fra 562 er nået i første forsøg.
  - Da hun endelig mestrer forløbet (7:01), får helten et niveau og et banner. Brøker får intet, fordi pointene allerede er givet.
- **Tallet falder mellem to dage (M2):** følgeren har "Enheder og målestok 30" i rygsækken efter 20 minutter. Åbnes spillet igen fra det gemte, er det 0. De 30 kom fra et Grusgrav-forløb, hun ikke har mestret endnu, og de ligger kun i hukommelsen (562's kendte grænse). For hende ser det ud, som om tallet er taget fra hende.
- **Tallet er lineært:** altid +10 eller +5, højst 150-470 pr. færdighed. Det vokser jævnt og bliver aldrig "større" i spring. Det er et valg, ikke en fejl (M4).

## +N og niveau

**"+N" er tydeligt nok og ikke støjende, men der er for mange af dem (M1).** Et rigtigt svar giver på samme frame (0 ms forskel):
1. et grønt "+10" (13 px), der flyver ca. 100 px op til chippen og falmer til 0,25
2. erfaringens "+10", der flyver mod baren i hovedet. På 390 er baren uden for skærmen, så flyveren ryger ud over toppen (til y = −1036) og ses kun et øjeblik.
3. erfaringens faste "+10" ved bjælken under svaret ("+5 i andet forsøg" i `M-390-flyver.png`)

Tre ens tal, to forskellige ting der vokser (Brøker og erfaring), og ét af dem forsvinder ud af skærmen. En 11-årig kan ikke se, hvilket "+10" der er hvad. Det svarer på Ganitas første spørgsmål: ja, ét for meget.

**Niveau-fejringen er rigtig.** "Nyt niveau i Brøker: **Øvet**" kommer 0,85 s efter svaret ved 100 point (1,7 s med reduced-motion, fordi tallet står der med det samme). Chippen får grøn kant og en ring på 0,7 s, og bjælken starter forfra.
- Linjen står, til næste opgave. Der er ingen konfetti, og den falder ikke sammen med heltens banner i nogen af kørslerne.
- Første rigtige svar giver "Nyt niveau i Brøker: Begynder" (niveau 1 er 1 point). Det er et godt første skulderklap.
- Linjen og optællingen kommer først efter 0,8 s. Trykker eleven "Videre" før, ser hun dem ikke. Min elev, som trykker efter 0,1 s rigtig tid, så 0 linjer uden reduced-motion og 2 med (M6).

**Chippen er lille:** tallet er 15 px, navnet 12 px, bjælken 36 × 6 px, og den står over svarknapperne på begge bredder (på 390 ved y 540 mod knappen ved 652). Den ses, men den råber ikke. Om den skal være større, er Marcs valg (M4).

## Cookie Clicker

Intet føles som Cookie Clicker:
- Chippen er et `<p>` uden rolle, med `cursor: default`. 20 tryk og 10 s ventetid ændrer hverken chippen eller erfaringen.
- Et forkert svar giver ingen flyver og intet point.
- Tallet faldt aldrig i nogen af de seks kørsler (kun ved genindlæsning, M2).
- Samme forløb igen giver ikke flere point til færdigheden. Det er loftet, og det er det rigtige mod at "farme".
- Eneste tal, der vokser ved gentagelse, er erfaringen. Den kræver også et rigtigt svar.

Loftet er altså ikke Cookie Clicker. Det er det modsatte, og det er grunden til M2.

## Øv her

Den peger rigtigt. Et rigtigt tryk på "Gå til ..." ved den svageste færdighed, i fem tilstande:

| Tilstand | Svagest | Lander | Opgaver med færdigheden |
|---|---|---|---|
| nyt spil | Brøker (0) | Møllen | 3 af 3, også den første |
| dag 3 (Møllen 1-6, Grusgraven 1-2, seks quests) | Gange og priser (0) | Landsbygaden | 2 af 3 (den tredje er Del lige over), også den første |
| Møllen 1-8 og Grusgraven 1-6 | Tid og klokken (0) | Sporvognen | 6 af 6 |
| den travle efter 20 min | Enheder og målestok (0) | Grusgraven | 3 af 3 |
| følgeren efter 20 min (genindlæst) | Enheder og målestok (0) | Grusgraven | 3 af 3 |

- Knappen er 44 px, og der er én "Øv her" pr. bibliotek.
- **Men den står 2-3 skærme nede i Min helt på 390** (y 1648-2454 på en skærm på 844). Eleven skal rulle forbi figuren og udstyret for at finde den (M3).

## prefers-reduced-motion

Respekteret. Med reduced-motion:
- 0 flyvere (både færdighed og erfaring) på 390 og 1280 og i elevens 20 minutter
- 0 animationer på chippen og 0 kørende animationer på siden
- Tallet står der inden for 150 ms, og niveau-linjen kommer

Eleven når det samme på 20 minutter med og uden (20 rigtige i første forsøg, samme niveauer).

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| M1 | middel | Ét rigtigt svar giver tre ens "+N" på samme frame: færdighedens flyver, erfaringens flyver og erfaringens faste mærke. På 390 flyver erfaringens "+N" ud over skærmens top (baren i hovedet er uden for skærmen). | Lad erfaringens flyver gå til den synlige bjælke under svaret, eller dropp den, når færdigheden får sit "+N". Giv færdighedens flyver navnet med: "+10 Brøker". |
| M2 | middel | Tager eleven et forløb om, står færdigheden stille, mens erfaringen vokser: den travle var 5:19 uden "+N" (8 erfarings-"+10", 0 til Brøker), og mestringen gav intet til Brøker. Point fra et forløb, der ikke er mestret, er væk efter genindlæsning: følgerens Enheder 30 → 0. | Gem point undervejs (samme loft), så tallet aldrig falder mellem to dage. Sig én gang i chippen, når loftet er nået: "Brøker vokser igen, når du mestrer forløbet". Overvej at lade mestringen give en synlig bonus til færdigheden. |
| M3 | lav | "Øv her" står 2-3 skærme nede i Min helt på 390. | Sæt én linje øverst i rygsækken: "Øv her: Gange og priser. Gå til Landsbygaden". |
| M4 | lav | Tallet er lille (15 px, bjælken 36 px) og vokser lineært (+10/+5, højst 150-470). "Number get bigger" er her jævn, ikke eskalerende. | Marcs valg: større tal, eller point der vokser pr. niveau. Ikke nødvendigt for dommen. |
| M5 | lav | Efter 20 minutter har den travle point i 1 af 7 færdigheder; 6 rækker siger "Ikke begyndt". | Vis låste og tomme rækker mindre, til de er i gang. |
| M6 | lav | Linjen "Nyt niveau" og optællingen kommer først efter 0,8 s. Trykker eleven "Videre" før, ser hun dem aldrig. | Vis tallet og linjen med det samme, når "Videre" trykkes før flyveren er landet. |

## Ærlige grænser

- **Eleven er en model, ikke et barn:** én terning (525), 390 og 1280 px, headless Chromium på Windows. Hun ser ikke på chippen, og hendes rigtige tid mellem tryk er ca. 0,1 s, så hun når ikke at se linjen uden reduced-motion. "Kan man mærke det" er derfor mit skøn ud fra frames og skærmbilleder, ikke en elevs.
- **"Tre +10 er for mange"** er min læsning af skærmbilledet. En lærer eller en elev kan se det anderledes.
- **De fem tilstande til "Øv her"** er mine syntetiske, plus elevens egne efter 20 minutter. Ganitas 2.016 fremdrifter har jeg ikke kørt igen.
- **Nyt niveau** er målt fra en gemt tilstand (Møllen 1-2 mestret), ikke spillet frem.
- **Intet i matematik er rørt:** det er læst med `git archive`, og grenen `ordre-574` er ikke skiftet.
