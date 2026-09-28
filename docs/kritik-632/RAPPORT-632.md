Ordre 632: Mål dit billede efter Yantras 627 og 630, og sitets kopi. Bhishak, 28. sep. 2026.

**Maal dit billede stadig klar til sitet: ja.** Setu skal kopiere 630 nu (løftmodellens `main` `2ccb0bb`, `dist/maal-billede/` hel).

**Vaerktoejssiden klar til Marcs deploy: ja.**
- Det, der er committet på `vaerktoejer` (`1169b5f`), er grønt i alle mine tjek (17/17), som i 617. Det er 620-udgaven uden Uger.
- Setus kopi efter 621 (ordre 625) er ikke committet. Der er ingen `setu-625`-rapport, og Setu har fået ordre 633.
- Jeg har derfor også prøvet den kopi, Setu skal lave: sitet med `main`'s `maal-billede/` lagt ind. Den er også grøn (17/17), med Uger, Gem ugerne og M18 rettet.
- **Mit råd til Marc:** vent på Setus kopi fra `2ccb0bb`, og deploy den. Den er målt grøn her. Siger Marc ja i dag, er `1169b5f` også sikker at deploye. Den mangler bare Uger.

## Gren

`kritik-632`, lavet med `git checkout -b kritik-632 main` fra `main` @ `3aace3b` (merge af kritik-631). Ingen push og ingen merges.

- `27c6531` kritik 632 blok 1: Mål dit billede efter Yantras 627 og 630
- commit 2: sitets kopi, verificering og denne rapport. Hashen står i `git log`.

Filer kun under `docs/kritik-632/` og `outputs/kritik-632/`. Løftmodellen (`entropi-loeftmodel-dhruva` `main` @ `2ccb0bb`) og sitet (`entropi-coaching-site-wt2` `vaerktoejer` @ `1169b5f`) er hentet med `git archive`. Ingen af de to træer er rørt.

## Hvad ændret

Kun dokumenter og mine egne scripts. Ingen appkode, løftmodel eller site.

### Blok 1: løftmodellen (`MAAL.md`)

Hele kritikken står i `docs/kritik-632/MAAL.md`. Kort:
- **M18 lukket.** Byt skriver noten om. Noten og advarslen er enige i alle seks tilfælde (omvendt, rigtig, Byt, Byt igen) på 390 og 1280.
- **M19 lukket.** Min Monte Carlo fra 628 (2.000 forsøg, samme frø) går nu gennem sidens `ugeTabel` med `markerGuld`:
  - Guld et sted uden ændring er 5,6 % (8 uger) og 8,6 % (12 uger) med 3 runder, og 8,2-11,6 % med 1 runde. Før var det 41-59 %.
  - En hofte 5 cm op fra uge 5 har guld et sted i 94,2 %.
  - Tjekket mod siden i 5 af 5 forsøg.
- **M20 lukket.** "forskel fra 3. aug. 2026" står i den faste celle, også når tabellen er rullet, og i hver blok i PNG'et.
- **Gem ugerne med tallene:**
  - 8 uger giver 1200 × 2648 px, 12 uger 1200 × 3714 px.
  - Samme guld som siden (9 = 9) og ingen måling i filen.
- **Nye lave fund:**
  - M23: en enkelt uge over grænsen skilles fra "inden for" kun ved et manglende ≈.
  - M24: den nyeste uge alene. Sætningen siger "hoften højere", men cellen står uden guld.
  - M25: med 1 runde står en vedvarende hofte 5 cm op kun i guld i sin række i 38 %, mod 76 % før reglen.
  - M26: PNG'ets tal er 7,8 px i fuld bredde på en telefon.
- **M21 og M22 står.**

### Blok 2: sitets kopi (`outputs/kritik-632/sitet-632.mjs`)

Mit site-script fra 617 bygger på maal-610. Det kører nu i to varianter:
- **`som-er`:** sitet, som det er committet (`1169b5f`, altså 620 fra `4ca0c63`).
- **`kopi`:** sitet med løftmodellens `main` `dist/maal-billede/` kopieret ind hel. Det er præcis det, Setus næste kopi giver.

Tjekkene:
- **Filerne:** alle filer i de syv mapper er læst fra disken og holdt op mod kildens `dist` blob for blob (git's sha1).
  - `som-er`: 55 filer, alle `4ca0c63`.
  - `kopi`: alle `2ccb0bb`. Mod `main` er intet anderledes.
  - Arkivet er hentet uden linjeskift-omskrivning (`core.autocrlf=false`), altså som GitHub serverer det.
- **Sider og links:** 10 sider på 390 og 1280 har 0 fejl 404 (hentet eller linket lokalt), 0 JS-fejl, ingen sidelæns rul og ingen brudte billeder. Serveren svarede aldrig 404.
- **noindex og disclaimer:** `/vaerktoejer/` har `noindex, nofollow`. Disclaimeren fra 607 er sidste element i `<main>`, og intet står under den. `robots.txt` siger `Disallow: /assets/vaerktoejer/`.
- **Miniaturerne:** 8 filer med 0 mørke tekstfelter. Alle 8 id'er, "Ligner" kan vise, har en fil. "Stangen glider frem" viser miniaturen fra sitets sti.
- **Gem og åbn igen:** tre runder i en frisk side på 390 og 1280 giver hver gang samme fase, 7 klik, 180 cm og "Gemt måling åbnet". M5 er lukket: filer uden `.png` eller type åbnes som målingen.
- **Før og efter fra filer:** datoen står ved begge, og Byt vender tabellen. M6 er lukket. M18: `som-er` siger stadig "tryk Byt" efter Byt, i `kopi` er det rettet.
- **Video:** et webm-klip lavet i browseren åbnes og kan spoles. "Brug billedet" giver et billede på 320 px.
- **Uger:**
  - `som-er` har ingen Uger. Det er det, der mangler.
  - `kopi`: tre gemte målinger i blandet orden står i datoorden med "forskel fra 3. aug. 2026". Guld står, hvor hoften er oppe to uger i træk. Gem ugerne giver et PNG på 1200 px uden måling.
- **Net:** intet forsøgte at hente udefra.

## Testresultat

| Kommando | Resultat |
|---|---|
| `node outputs/kritik-632/maal-632.mjs` | 19/19 grønne, to gange (Monte Carlo 2.000 pr. linje, samme tal begge gange) |
| `VARIANT=som-er node outputs/kritik-632/sitet-632.mjs` | 17/17 grønne |
| `VARIANT=kopi node outputs/kritik-632/sitet-632.mjs` | 17/17 grønne |
| `node outputs/kritik-632/verify-kritik-632.mjs --blok 1` | grøn |
| `node outputs/kritik-632/verify-kritik-632.mjs --blok 2` | grøn |
| `npm run lint` | grøn |

Alt er kørt i Google Chrome 154 headless (390 med touch, 1280 med mus) uden net.

Rødt undervejs, alle mine egne fejl:
- **M20-tjekket:** regex'en ventede et mellemrum mellem "Mål" og "forskel" (der står et `<br>`).
- **Site-scriptet:**
  - En backslash forsvandt, da jeg redigerede det.
  - Første kørsel sammenlignede filer med CRLF (arkivet blev skrevet om af `core.autocrlf=true`), så alle blobs var "anderledes". Nu hentes der med `core.autocrlf=false`.

## Hvad er næste

**Setu** kopierer løftmodellens `main` (`2ccb0bb`) til `vaerktoejer` i én kopi: `dist/maal-billede/` hel.
- Mod sitet er kun `index.html` og `maal-billede.js` anderledes. `tre-loeft/`, `min-krop/`, `baenk-figurer/` og miniaturerne er de samme.
- Ordre 625 er ikke udført. Den skal gives igen med `2ccb0bb` som kilde, også LAES-VAERKTOEJER.html med Uger og Gem ugerne i almindeligt dansk.
- Kopien er allerede prøvet grøn her (`sitet-632-kopi.json`). Jeg kan køre `VARIANT=som-er` igen på Setus commit for at bekræfte, at den er blob for blob den samme.

**Yantra**, ingen af punkterne stopper kopien, og de kan komme med i den næste:
- M23: et svagt mærke for en enkelt uge over grænsen, fx "1 uge" med lille grå skrift.
- M24: sætningen siger, når den nyeste uge ikke er i guld endnu.
- M25: Uger siger, at 3 runder pr. billede får guldet frem.
- M21 og M22 er hans egne næste.
- Valgfrit: M26 (større skrift i PNG'et) og "ca. 5 %" til "ca. 2-3 %".

**Marc:** intet valg om Mål dit billede. Deploy af værktøjssiden, når Setus kopi er der (eller `1169b5f` nu, hvis han vil). iPhone-prøven (610) står stadig, nu også med at gemme ugerne i Fotos og zoome i dem.

**Hara** (Coaching-planeten): Uger er nu et værktøj, en træner kan bruge hver uge uden at blive snydt af tilfældig guld. Falsk guld er faldet fra ca. halvdelen af tabellerne til under 12 %, og en rigtig ændring findes stadig i 94 %. Det er klar til sitet, så snart Setu kopierer.

## Ærlige grænser

- **Ingen telefon:** headless Chrome på Windows med Playwrights touch. Rul med en finger, Fotos på en iPhone og Safari er ikke prøvet.
- **Kopien i blok 2 er min simulering af Setus kopi,** ikke Setus commit. Den er bygget af de samme filer (`2ccb0bb`'s `dist/maal-billede/`), men LAES-VAERKTOEJER.html og Setus egne tjek findes ikke endnu.
- **Klikfejlen i Monte Carlo er Yantras antagne,** ikke målt på en træner. Kun dødløft ved gulvet, uden det fjerne nav.
- **Hvad en træner forstår** (M23, M24, M26) er min vurdering.
- **Kørt:** kun mine egne scripts, ikke Yantras suite.
- **Kun syntetiske data:** ingen rigtige atleter eller klip. Løftmodellen og sitet er ikke rørt. Intet er pushet eller merget.
