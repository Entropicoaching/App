Ordre 457

Dødløft og bænk efter 447 og 452: den endelige dom. Mine 441-scripts er kørt mod løftmodellens `main`, og figurerne er set igennem som coach. (Bhishak)

## Gren

`kritik-457` fra main `f11501f` i `entropi-app-kritik`. Der er intet merget og intet pushet.
- `76397c6`: blok 1, mine fund på det nye, svarene til Yantra og dommen over D1/D3 som modelgrænser.
- Blok 2 (KRITIK-2 og denne rapport) er grenens sidste commit.

Ordren blev genstartet efter brugsgrænsen kl. ca. 01:52. Den første session havde lavet scriptet og skærmbillederne, men intet committet. Jeg fortsatte på samme gren uden reset og kørte scriptet igen, så alle tal er fra denne session.

## Hvad ændret

Intet i løftmodellen eller sitet er rørt. Løftmodellen (`0869560`) er kun læst med `git archive` og `git show`. Nyt er:
- `docs/kritik-457/FIGURER-457.md` (blok 1): status for D1-D7 og B1-B5 med bevis, de nye fund N1-N4, svarene på Yantras to spørgsmål og om D1 og D3 kan stå som modelgrænser.
- `docs/kritik-457/KRITIK-doedloeft-baenk-2.md` (blok 2): fundene øverst og én dom pr. løft.
- `outputs/kritik-457/`:
  - `figurer-457.mjs`: mit 441-script, uændret i målingerne. Tre ting er tilføjet: hoftearmen med Marcs egen torso, albuens valg midt i bænkens optur og tre tegn i dødløftets SVG'er.
  - `figurer-457.json`, 40 figurbilleder og 4 sidebilleder.
  - `verify-kritik-457.mjs`.
- `package.json`: scriptet `verify:kritik-457`, som ordren kræver.

Dommen er **klar til sitet: ja** for alle tre løft:
- Konventionelt dødløft: ja. Opstilling, knæhøjde og lockout ligner nu løftet. D1 og D3 er modelgrænser på tallene, og siden skal sige dem.
- Sumo: ja. Vinduet forfra viser standen.
- Bænkpres: ja. B1-B5 er lukket. Tilbage er én forældet sætning (N2) og pynt midt i opturen (N1).

Ti af mine tolv 441-fund er lukket. D1 og D3 er delvise, præcis som Yantra målte i 452.

## Testresultat

- `node outputs/kritik-457/figurer-457.mjs`: 40 figurer fotograferet mod `0869560`. Ingen sidelæns rulning på 390 eller 1280. Den mindste figurtekst er 12,1 px på 390 og 13,8 px på 1280, og HTML-teksten er 14,4 px.
- Blok 1: `node outputs/kritik-457/verify-kritik-457.mjs 1` er grøn. Den regner status for hvert fund ud af JSON'en med 441's kriterier for "åben" og 457's grænse for "lukket". Den kræver, at det stemmer med tabellen i FIGURER-457 (10 lukket, D1 og D3 delvise). Den kontrollerer også, at overslagene rammer modellens egne tal, når modellens vinkler sættes ind.
- Blok 2: `npm run verify:kritik-457` er grøn. Den kræver fundene øverst i KRITIK-2, tre domme og de fem afsnit i rapporten. Når dommen er ja, skal "Hvad er næste" sige, hvad Setu skal skrive om modelgrænserne.
- `npm run verify:kritik-441` er stadig grøn på sine egne gemte målinger.

## Hvad er næste

Dommen er ja, så det næste er Setus tekst. Til Setu, om modelgrænserne, som skal stå ved dødløftfigurerne (kort, i coachens sprog):
- **Ryggen (D1, D3):** "Modellen løfter med en lidt mere vandret ryg end Marc: 61° mod 50° fra lodret ved gulvet og 53° mod 45° ved knæet. Kroppen er bygget af længder udledt af højden, ikke målt, og det flytter hoften op og tilbage."
- **Tallene i Nm:** Skriv, at momenterne er modellens, og at de for et løft som Marcs sandsynligvis er 10-15 % for høje. Citer ikke 1294 eller 987 Nm som Marcs tal. Det, der kan citeres: hoften har ca. en fjerdedel mindre at holde ved knæet end ved gulvet, og knæet er holdt op med at strække ved knæhøjde (negativt knæmoment).
- **Knæet ved knæhøjde (D3):** "146° er et kompromis mellem litteraturen (ca. 159° hos konkurrenceløftere) og Marcs eget klip, ikke en måling."
- **Lockout (N3):** Citer ikke de 264 Nm ved lockout. Tallet kommer af, at stangen hænger foran en helt lodret krop. En løfter, der har låst, læner sig en smule tilbage, og så er hoftemomentet næsten nul.
- **Sumo:** Vinduet forfra er en tegning af standen. Modellen regner kun fra siden, og derfor står skinnebenet for skråt fra siden (N4).
- **Bænk, midt i opturen (N1):** Skriv, at figuren holder albuen under stangen set forfra, så albuen står langt mod fødderne fra siden. Rigtige løftere deler det med lidt flare. Albuemomentet er næsten det samme begge veje.

Til Yantra (ikke betingelser for sitet, kan tages når der er tid):
- N2: én sætning på `dist/baenk-figurer/index.html` under "Buen" siger stadig "vip af brystkassen" og "nærmere skulderen". Den skal sige bro og brystets højeste punkt, som forbeholdet længere nede.
- N1: albuen 8-10 cm uden for hånden forfra midt i opturen (underarmen ca. 25° forfra). Så står den ca. 15-17 cm mod fødderne fra siden i stedet for 21 cm. Tabellen står i `FIGURER-457.md`.
- N3 og N4 kan stå som tekst og behøver ingen rettelse.

Til Marc: figurerne kan på sitet, når Setus tekst om grænserne står ved dem. Et målebånd-sæt af dine længder er stadig det, der kan lukke D1 rigtigt.

Arbejdet hører under Coaching-planeten (sporet kropsmodel til teknikfeedback i de tre løft). Med denne dom er alle tre løft klar til at skrive i.

## Ærlige grænser

- **Overslagene er mine, ikke modellens.** Hoftearmen med Marcs torso er regnet som torsoens længde gange sinus til torsovinklen minus skulderen foran stangen. Kontrollen er, at den rammer modellens 41,0 og 30,1 cm med modellens vinkler. Balancen er ikke regnet med. Derfor er "10-15 % for højt" et bud og ikke en måling.
- **Mit 441-overslag med 159° holder ikke balancen.** Det gav torso 39°, mens Yantras model med balance siger ca. 60°. Jeg har trukket det tilbage som mål og regner Yantras tal for de rigtige.
- **Marcs hoftevinkel i klippet** regnes mod lårets retning, og den kommer fra det upålidelige knæ. Jeg har derfor sammenlignet på torsoen, hvor både hofte og skulder ses tydeligt. Klippets tabel kalder hoften pålidelig, og det er jeg ikke sikker på, at den er.
- **Albuens valg midt i bænken** holder stangen, hvor modellen har den (over skulderen). Ligger stangen længere mod fødderne midt i opturen, står albuen lodret lettere. Det er modellens J-kurve, som jeg ikke har målt.
- **Tegnene for D5-D7 i SVG'erne** er enkle: teksten "stand ... cm", teksten "ikke vist" og en cirkel om stangen. Resten af D7 (balde, svaj, hoved) har jeg set med øjnene i skærmbillederne.
- Jeg har ikke set tre-løft-siden (`dist/tre-loeft/`), kun de to figursider. Yantra har testet den i 452.
- Scriptet låner Playwright fra skak-mappen, som i 374, 384 og 441. Kun headless Chromium er brugt, og musen er ikke rørt.
- Ingen atletdata ud over Marcs eget klip i løftmodellen, ingen navne, ingen sub-agenter og ingen push.
