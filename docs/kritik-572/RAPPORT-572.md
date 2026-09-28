Ordre 572

# To kritikker: bænk-artiklen klar til Marcs svar (Setu 566) og matematikkens kompetencebibliotek (Ganita 562 og 569) (Bhishak)

**Domme:**
- **Bænk-artiklen klar, når Marc har svaret: nej.** Den bliver ja, når BA1-BA2 er rettet, og intet af det kræver Marc.
- **Matematikken føles som et MMORPG, ikke Cookie Clicker: ja.** M1-M2 (middel) bør rettes, for at tallet også vokser for den elev, der tager et forløb om.

## Gren

`kritik-572` fra `main` (`f9e946a`, hvor 568 er merget), i `entropi-app-kritik`. Ingen push, ingen merge og ingen sub-agenter.
- `0c4f2a3` blok 1: bænk-artiklen (`docs/kritik-572/BAENK.md`).
- Blok 2 (commit 2): kompetencebiblioteket (`docs/kritik-572/MATEMATIK.md`) og denne rapport. Hashen står i git-loggen; den kan ikke stå i sin egen commit.

Kun læst, med `git archive`, uden at skifte gren:
- sitet: `artikel-baenk` @ `fb0cefa` i `entropi-coaching-site-wt2`
- løftmodellen: `main` @ `37c9a27` i `entropi-loeftmodel-dhruva`
- matematik: `main` @ `eb87746`. Træet står på Ganitas `ordre-574` med hans egne ændringer i gang; dem har jeg ikke rørt.

Også læst: `LAES-DOEDLOEFT-BAENK.html`, Setus `RAPPORT-566.md` og Ganitas `RAPPORT-562.md` og `-569.md`.

## Hvad ændret

Kun filer under `docs/kritik-572/` og `outputs/kritik-572/`. Intet i sitet, løftmodellen eller matematik er ændret.

**Blok 1, bænk-artiklen** (`BAENK.md`, `baenk-572.mjs`, `B-*.png`):
- **Tallene:** alle 21 tal-sætninger passer med løftmodellens main, regnet igen i modellens egen kode. Det gælder også de tal, Setu ikke kunne tjekke: 17,5/38,4/59,3 cm over skulderen, underarmens 11°, 25° og 40°, de ni kombinationer med Nm og albuevinkel, kropstyperne (59,4° og 72,2° mod 66,4°, vejen +6,1 cm) og 554's vip (−1,1, 1,7 og 6,2 cm for 183 cm, samme krop som figurerne).
- **Figurer, fejl og spørgsmål:**
  - De 12 figurer er dist med kun navnet skiftet.
  - Kapitel 7 er fejlsiden efter 493, uden skulderprocenter.
  - De 8 spørgsmål står ordret og ved det, de spørger om.
- **Siden på 390 og 1280 uden net:** 0 tankestreger, 0 synlige [MARC], 0 JS-fejl, 0 404, 13 billeder med alt-tekst, og læsetiden er 17 min (2266 ord).
- **BA1 (middel):** "mere bue ... længere mod fødderne" passer kun fra lille til middel. Fra middel til stor rører stangen 1,0 cm nærmere halsen (22,1 / 25,1 / 24,1 cm). Det svarer på Setus første spørgsmål: figurerne og vip-afsnittet peger faktisk samme vej, når sætningen er rigtig.
- **BA2 (middel):** "8-10 cm ud er vurderet som tættere på, hvad man ser" er min dom fra 457. Den står umarkeret lige over bp-7.
- **BA3-BA10 (lav):**
  - BA3: læsesiden viser stadig bænk-kladden med kapitel 7 fra før 493.
  - BA4: "I bænken lander stangen 10-15 cm" om en valgt størrelse.
  - BA5: titlen "individuel variation".
  - BA6: IPF 4.2.1 pkt. 2, 6 og 9 står ikke i uddraget.
  - BA7: interne navne i kildekoden.
  - BA8: Mål dit billede er ikke main.
  - BA9: "ofte".
  - BA10: tabellerne ruller på 390.

**Blok 2, kompetencebiblioteket** (`MATEMATIK.md`, `elev-572.mjs`, `matematik-572.mjs`, `M-*.png`):
- **Eleven:** min elev (Ganitas kopi i 569) i 20 minutter med et ur på hver "+N", hver erfarings-flyver og hver niveau-linje. Eleven er uændret.
- **Prøverne:** første svar filmet hver frame, chippen trykket 20 gange, 10 s ventetid, et forkert svar, nyt niveau, "Øv her" med et rigtigt tryk i fem tilstande og reduced-motion.
- **Det, der virker:**
  - Tallet vokser hvert 40. sekund (median), og intet vokser af sig selv eller af et tryk.
  - "Nyt niveau i Brøker: Øvet" er tydelig uden at larme.
  - "Øv her" lander 5 af 5 gange på et forløb, hvis første opgave er færdigheden.
  - Reduced-motion slår alle flyvere og animationer fra.
- **M1 (middel):** ét rigtigt svar giver tre ens "+10" på én gang, og på 390 flyver erfaringens ud over skærmens top.
- **M2 (middel):** når eleven tager et forløb om, står færdigheden stille. Den travle var 5:19 uden "+N", mens erfaringen fik 8. Point fra et forløb, der ikke er mestret, er væk efter genindlæsning (følgerens Enheder 30 → 0).
- **M3-M6 (lav):**
  - M3: "Øv her" står 2-3 skærme nede.
  - M4: tallet er lille og lineært.
  - M5: 6 af 7 rækker er tomme efter 20 min.
  - M6: trykkes "Videre" før 0,8 s, ses niveau-linjen ikke.

## Testresultat

- `node outputs/kritik-572/baenk-572.mjs`: **31/31** grønne (`artikel-baenk` `fb0cefa`, løftmodel main `37c9a27`).
- `SEED=525 node outputs/kritik-572/elev-572.mjs` og `REDUKT=1 BREDDER=390 SEED=525 node outputs/kritik-572/elev-572.mjs`: 6 kørsler × 20 min, 0 net og 0 JS-fejl.
- `node outputs/kritik-572/matematik-572.mjs`: **24/24** grønne (matematik main `eb87746`).
- `node outputs/kritik-572/verify-kritik-572.mjs --blok 1`: grøn før commit 1.
- `node outputs/kritik-572/verify-kritik-572.mjs --blok 2`: grøn før commit 2. Den tjekker grenen, at der kun er filer under `kritik-572`, ingen upstream, ASCII i commit-beskederne, at løftmodellen er uændret, at `artikel-baenk` står på `fb0cefa`, de gemte målinger, dokumenternes opbygning og `npm run lint`.
- `npm run lint`: grøn.
- **Røde kørsler undervejs:**
  - Mit første tjek af tabellerne i kapitel 7 var skrevet forkert. Det er rettet til række for række.
  - Tjekket "to flyvere på én gang" talte også flyverne fra det forkerte svar med, fordi min første observer stadig lyttede. Det er rettet.
  - Et skærmbillede af "#buen" var kun overskriften og er taget om. Ingen af de røde kørsler var i sitet eller spillet.
- **Set med egne øjne:** `B-390-buen-figurer.png` (skulderen 22,1 / 25,1 / 24,1 cm), `B-390-buen-vip.png`, `M-390-flyver.png` (tre "+5") og `M-390-nyt-niveau.png`.

## Hvad er næste

1. **Setu** retter BA1 og BA2 på `artikel-baenk`. Så er bænk-artiklen rigtig i alt andet end Marcs svar.
   - **BA1:**
     - Skriv, at stangen rører 3 cm længere mod fødderne fra lille til middel bue og 1 cm nærmere halsen fra middel til stor.
     - Tag "fordi stangen rører længere mod fødderne" ud af bp-5 i artiklen og på læsesiden samtidig, så de stadig er ordret ens.
     - Vip-afsnittets "modellens egen" bør sige "middel bue".
   - **BA2:** skriv albuens 9 cm som et skøn, ikke en iagttagelse, eller markér sætningen `bp-7 afledt`.
   - **Samme omgang:**
     - BA3: byg læsesidens bænkdel fra `artikel-baenk`, før Marc svarer. Det er det samme som DA10 for dødløftet.
     - BA4, BA5 og BA9: tre små ordvalg.
     - BA6: slå 4.2.1 pkt. 2, 6 og 9 op i regelbogen.
2. **Ganita** retter M1 og M2 i spillet:
   - **M1:**
     - Erfaringens flyver går til den synlige bjælke under svaret eller droppes, når færdigheden får sit "+N".
     - Færdighedens flyver får navnet med ("+10 Brøker").
   - **M2:**
     - Gem point undervejs med samme loft, så tallet aldrig falder mellem to dage.
     - Sig én gang i chippen, når loftet er nået, at færdigheden vokser igen ved mestring.
     - Overvej en synlig bonus til færdigheden ved mestring.
   - **M3:** en "Øv her"-linje øverst i rygsækken.
   - **M6:** vis tallet med det samme, hvis "Videre" trykkes før flyveren er landet.
   - M4 og M5 er Marcs valg.
3. **Marc:**
   - Bænk-artiklens 8 spørgsmål kan besvares nu; BA1-BA2 rammer ikke svarene.
   - For matematikken: se `M-390-nyt-niveau.png` og `M-390-flyver.png`, og sig, om tallet skal være større (M4).
4. **Dhruva:** `kritik-572` kan merges; den rører kun `docs/kritik-572` og `outputs/kritik-572`.
5. **Hara:** blok 2 hører til planeten school (sporet om matematik-minispil). Intet her gør appen på app.entropicoaching.dk bedre, så der er intet til Coaching-planetens delmål "Appen mærkbart bedre".

## Ærlige grænser

- **Bænk:**
  - Tallene er holdt op mod modellen på main. Er modellen forkert, er artiklen det også.
  - Kilderne er tjekket mod løftmodellens uddrag, ikke mod PDF'erne (uden net).
  - "9 cm giver ca. 70° ud" er ikke regnet igen.
  - BA2 er min egen sætning fra 457.
- **Matematik:**
  - Eleven er en model med én terning (525). Hendes rigtige tid mellem tryk er ca. 0,1 s, så hun ser ikke niveau-linjen uden reduced-motion.
  - "Kan man mærke det" og "tre +10 er for mange" er mit skøn ud fra frames og skærmbilleder, ikke et barns oplevelse.
  - Ganitas 2.016 fremdrifter for "Øv her" er ikke kørt igen; jeg har prøvet fem tilstande med et rigtigt tryk.
- **Browseren:** kun headless Chromium på Windows, ingen rigtig telefon. Skrifttypen er blokeret på sitet.
- **Kun syntetiske data:** ingen elever, ingen atleter og ingen navne ud over "Tulle". Ingen push, ingen merges, ingen sub-agenter.
