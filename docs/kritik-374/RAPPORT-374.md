Ordre 374

# Rapport: kritik af squat-opslagsværket (369) på telefonen og brøktrappen (368) spillet som elev (Bhishak)

## Gren

Gren `kritik-374` fra `main` i `entropi-app-wt2`. Ingen push.
- Commit 1 `1a5bb96`: blok 1. Scriptet `scripts/kritik-374.mjs`, `verify:kritik-374` i `package.json`, `docs/kritik-374/KRITIK-squat-369.md`, squat-skærmbillederne og artiklens synlige tekst.
- Commit 2 `ee11a4e`: blok 2. `docs/kritik-374/KRITIK-broektrappe-368.md` og brøk-skærmbillederne. Scriptets udsti er nu relativ, og Møllens klassificering er rettet.
- Commit 3: blok 3, den fulde verifikation (`maalinger.json` og alle skærmbilleder) og denne rapport. Hashen står i `git log`.

Kilder, kun læst via `git archive`: sitet `squat-opslag-7` (`a3e46de`) og matematik `main` (`423ac87`). Intet er rettet eller committet i de to repoer.

## Hvad ændret

Intet i appen. Ordren var kritik. Der er to kritikker og ét script.

**Squat-artiklen, klar til Marc: nej.** Tre fejl, som Setu kan rette på en halv dag, står netop dér, hvor læseguiden sender Marc hen:
- Kapitel 8 kalder "stangen over midtfoden" modellens balancebetingelse, mens kapitel 1 viser stangen 4,6 cm bag midtfoden i første og sidste figur (Q1).
- Kapitel 4's ankelgrænser (25°, 35° og 45°) findes ikke i panelet. Det viser 45° for alle seks kombinationer (Q3).
- Fejlbillederne og anatomitabellen kan ikke læses på telefonen: SVG-teksten er 3-5 px, og der står et komma i tre celler (Q4, Q7).

I alt er der 22 fund. Blandt de faglige er, at "Good morning" i modellen ikke er en good morning (Q8), at valgus står som "indad eller udad" (Q9), at canvas-teksten "IPF-dybde: ja" står på trods af kapitel 2 (Q6), og at vendepunktets 11 % ikke passer med 0,38 s af 2,8 s (Q10).

Det der holder: ingen tankestreger, intet "man skal", ingen atletnavne, ingen interne navne, forbeholdet nederst og ingen konsolfejl. Marcs røde tråd (intro, kapitel 4, kapitel 8) kan følges, men modellen fylder 203 ord mod Marcs 18 ord i første person.

**Brøktrappen, klar til klassen: ja.** Alle 8 forløb er spillet på 390 px med bevidste typiske fejl:
- Rækkefølgen er præcis den, BROEK-TRAPPE.md lover (`[k,k,k-1,k]`, og fra forløb 5 et ældre trin).
- Alle 47 forkerte svar fik et hint, der siger hvorfor.
- 4/6 dømmes rigtigt med ros.
- Mestringen fejler og giver forløbet igen med nye tal, og Grusgraven åbner først efter mestring af forløb 1-2.
- Ingen elev sidder fast, for efter to forkerte svar vises løsningen.

Der er 8 fund. De to vigtige:
- Kirken, som er åben fra start, stiller trin 2 og 3 på dag 1 (B1).
- Ingen "klaret"-replik vises nogensinde, så "du har gået hele brøktrappen", som RAPPORT-368 lover, ses ikke (B2).

## Testresultat

- `npm run verify:kritik-374`: grøn (exit 0). Kørslen:
  - trækker begge kilder ud
  - læser artiklen på 390x844 og 1280x900, skærm for skærm, med folderne lukket og åbne
  - trykker panelets seks kombinationer igennem
  - spiller Kirkens første forløb og Møllens 8 forløb
  - skriver `outputs/kritik-374/maalinger.json` og alle skærmbilleder
- Fundene gentog sig i den sidste kørsel: ankelgrænsen står til 45° i alle kombinationer, der er 3 komma-celler, der er 1068 px mellem figur og skyder, Kirken stiller trin `[1,2,3]`, `heleTrappenNaevnt: false`, og 27 af 47 hint ligger under skærmkanten. Konsollen var tom i alle sessioner.
- `npm run lint`: grøn.
- Der er ingen andre `verify:*`, der dækker området. Appens kode er ikke rørt.

## Hvad er næste

**Marc skal først se:** intet endnu fra squat-artiklen. Han kan få de ti `[MARC: ...]`-spørgsmål nu, fordi de ikke afhænger af rettelserne. Når Setu har rettet Q1-Q9, gælder læseguiden fra RAPPORT-369 (introen, kapitel 8, kapitel 4 og figurerne i kapitel 1 og 5). Brøktrappen kan han give klassen nu. Han skal sige "start i Møllen" og se efter, om eleverne læser hintet nederst på skærmen (B3).

**Setu (squat), prioriteret:**
1. Q1, Q3, Q4, Q6 og Q9: tekst- og scriptrettelser, cirka en time. Til Q4 er årsagen sidens eget script, der erstatter tankestreger (linje 1027 og 1044), som gør tabellens "—" til ", ".
2. Q7 og Q12: fejlbilleder og anatomi-stillbilleder i en størrelse, der kan læses (eller tallene ud i HTML), og panelets figur og skyder på samme skærm.
3. Q5, Q8, Q10, Q11 og Q19: vinkelbegrebet, good morning, vendepunktets tal, kapitel 6's "inden for båndet" og kapitel 5's målte forskel i hovedteksten.
4. Q13-Q16 og Q18: decimalpunktum, SKULLE, licensnoten, meta-kommentarer, gentagelser og forbehold i toppen.

Q2 og Q20 venter på en løftmodel-ordre (FIGUR-FUND-369), og Q17 venter på Marcs svar.

**Ganita (brøktrappen), prioriteret:**
1. B2: vis `replikker[1]` efter et mestret forløb (`spil-app.js`, én linje).
2. B1: lås Kirken på Møllens forløb 3, eller giv dens første forløb kun trin 1.
3. B4 og B5: hintet "Du har ganget med 1" ved tælleren 1 skal sige "det er alle sækkene", og hint 2 skal give mere end hint 1.
4. B3: hintet over svarknapperne eller rullet ind i syne.
5. B6-B8.

**For Hara:** Coaching-planeten, sporet "løft-artikler på entropicoaching.dk", får to ting. Squat-opslagsværket er ikke klar til Marc endnu, og der er en prioriteret rettelsesliste til Setu. Delmålet "Appen mærkbart bedre" er ikke berørt, for der er ingen ændring i entropi-appen. Brøktrappen hører til Skole-planeten og er klar til klassen med to rettelser anbefalet. Duta bedes lade begge dele stå i afleveringen.

## Ærlige grænser

- Kun Chromium-emulering (390x844, isMobile og touch, 2x, og 1280x900), ikke en rigtig telefon.
- Artiklen er læst i den renderede tekst og på skærmbillederne fra top til bund, men ikke hver figur er vurderet fagligt. Figurernes geometri er Setus og løftmodellens (FIGUR-FUND-369), og jeg har ikke regnet modellens tal efter, bortset fra Q10.
- SVG-tekstens pixelstørrelse er beregnet ud fra font-size i filen gange visningsskalaen, ikke målt i pixels.
- Brøkeleven er et script. Det regner facit, laver én forudbestemt fejl pr. opgave på det nye trin og vælger det uforkortede svar, når det findes. Det læser hintet, men handler ikke på det, som en elev ville. "Sidder ikke fast" er vurderet ud fra, at løsningen vises efter to forkerte svar og ud fra koden, ikke ud fra en elev.
- Spillets tal er tilfældige pr. kørsel, så opgaverne i `maalinger.json` er fra den sidste kørsel. Fundene gentog sig i tre kørsler.
- Første runde af hvert forløb fejler to gennemløb i træk, fordi eleven fejler på alle opgaver fra det nye trin, indtil scriptet skifter til rigtige svar. Mestringsbeskeden blev set i forløb 2-4, og mekanismen er den samme i de andre.
- Ikke spillet: Grusgraven, Sporvognen, Landsbygaden, Lyset og Kirkens forløb 2-6.
- Uheld undervejs: ordre 373 kørte `koer-verify.mjs` i hovedcheckouten. Dens gamle kritik-scripts (`kritik-skole*.mjs`) har `entropi-app-wt2` hårdkodet som udsti, så de skrev nye skærmbilleder ind i denne worktree. Jeg har sat de filer (181 i `outputs/kritik-skole*`) tilbage til deres committede tilstand og slettet én ny fil fra den kørsel (`outputs/kritik-skole/matematik/broek-uforkortet-hint-2.jpg`). Mit eget script skriver nu relativt til sin egen placering, men de gamle scripts gør det stadig og vil gøre det igen ved næste fulde verify-kørsel. Det bør rettes.
- Ingen elevdata, ingen atletnavne, ingen push. Kapitel 6's dødløft har kropsmål (183 cm, 120 kg) og 270 kg fra "eget klip". Der står intet navn, men Marc bør bekræfte, at løfteren er indforstået.
