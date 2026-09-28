Ordre 628: to kritikker. Mål dit billede efter Yantras 621 (Uger) og skakken efter Chaturangas 619 og 623 (Bhishak)

**Maal dit billede stadig klar til sitet: ja.** Setu kopierer den nye udgave nu (`docs/kritik-628/MAAL.md`).

**skakken stadig klar til Marcs klasse: ja.** S7 fra 610 er lukket: eleven ser, at hun blev hurtigere.

## Gren

`kritik-628`, lavet med `git checkout -b kritik-628 main` fra `main` @ `e1f9d43` (merge af kritik-622). Ingen push, ingen merge og ingen sub-agenter. Filer kun under `docs/kritik-628/` og `outputs/kritik-628/`.

- `977be4d` kritik 628 blok 1: Mål dit billede efter Yantras 621 (Uger)
- blok 2: skakken og denne rapport. Hashen står i `git log`, og commit-beskeden starter med "kritik 628 blok 2".

**Hvad der er målt:**
- **Løftmodellen:** `entropi-loeftmodel-dhruva` `main` @ `287210d` (621 merget). Yantras `docs/RAPPORT-dag-94.md` er læst; `-95.md` findes ikke på `main`.
- **Sitet:** `entropi-coaching-site-wt2` `vaerktoejer` @ `1169b5f`.
- **Skakken:**
  - `C:\Users\Entropi\Desktop\skak` `main` @ `637a226` (619 merget).
  - Grenen `ordre-623` @ `4faeb6a`. Da jeg begyndte, havde den to commits (`edfd6e1`, `ea0ddac`). Blok 3 (`4faeb6a`, skærmbilleder og rapport) kom, mens jeg målte. 623 er ikke merget.
  - Jeg har målt på `ordre-623`, som har 619 med. Chaturangas `outputs/RAPPORT-619.md` (main) og `RAPPORT-623.md` (grenen) er læst.
- Alt er hentet med `git archive`. Intet af de tre træer er rørt.

## Hvad ændret

Kun dokumenter og mine egne scripts. Ingen appkode, løftmodel, site eller skak.

### Blok 1: Mål dit billede (commit 1)

`docs/kritik-628/MAAL.md` og i `outputs/kritik-628/`:
- `maal-628.mjs`
- `hop-628.mjs`
- `M-*.png`
- `verify-kritik-628.mjs`

Kort:
- **Uger virker:**
  - datoorden
  - filen uden endelse (M5) er med
  - fotoet siges
  - højst 12 kolonner, med en note om de udeladte
  - ingen sidelæns rul på siden
  - navnet står fast, når tabellen ruller
  - node-regningen er den samme som sidens
- **M19 (middel), mange celler:** Monte Carlo med 2.000 forsøg og Yantras egen klikfejl, SAMME stilling alle uger.
  - Der står guld et sted i 41 % af tabellerne med 8 uger og 50 % med 12 uger (3 runder), og i 47-59 % med 1 runde.
  - Hver celle for sig har Før og efters rate, ca. 2 %. Sætningen (den nyeste mod den ældste) holder 9-12 %.
  - **Mit forslag:** guld kun, når to uger i træk er over grænsen i samme retning. Det giver 6-12 % falske, og en hofte, der går 5 cm op, findes stadig i 94 %.
- **M20 (lav):** "fra den ældste" står ikke i tabellen. Rullet ud på 390 ligner tallene ændringer fra ugen før.
- **M21 (lav):** står der allerede en anden højde på siden, bruges den tavst til alle ugerne (cm ca. 8 %).
- **M22 (lav):** "samme kameraplads" står i hver celle i stangens rækker, så tabellen er 632 px høj på 390.
- **Fælles krop er rigtig:**
  - en tastefejl i én uges fil flytter intet
  - sidens egen fase smitter ikke af på filernes
- **hop563:** en god erstatning.
  - `fastVideo` giver byte for byte det samme klip ubelastet og drosslet 6x og 20x.
  - `hop563` + `hop621` er 13/13 grønne to gange.
- **M18 fra 617 står stadig.**

### Blok 2: skakken (commit 2)

`outputs/kritik-628/skak-628.mjs`, `skak-628.json` og `S-*.png`.

Eleven er 12 år og er spillet med tryk på 360 og 390 og med mus på 1280, uden net, på Playwrights falske ur.
- Gåderne og stormene er løst i appen ved at slå stillingen op i banken.
- Kun del H har 12 gådetemaer lagt i lageret på forhånd.

**S7 fra 610 er lukket: eleven ser sit fremskridt.**
- **Uge 1:** Find feltet 10 af 10.
- **Uge 2:** 20 rigtige og 2 forkerte.
- **Mit bibliotek siger:** "denne uge: bedst 20 felter (91 %) · sidste uge: bedst 10 felter (100 %)" med pil op.
- **Sætningen siger:** 'Denne uge blev du hurtigere til "Find feltet": 20 felter på 30 s mod 10 sidste uge.'
- I 610 sagde den samme uge: "gik lidt ned … Øv det igen".
- Lageret har kun ugens nummer: `{"2960":[10,10,10],"2961":[22,20,20]}`.

**619 blok 1 (ugesætningen):** uge 1 med alle fire slags, spillet i appen (2 gåder, Find feltet, Italiensk parti og et kendt parti):
- Sætningen: 'Denne uge har du øvet 2 temaer (2 gåder), "Find feltet", 1 åbning (1 gang) og 1 kendt parti.'
- Den har ingen "forsøg" og ingen "koordinatøvelse". S8 er lukket.
- Den er 19 ord på 3 linjer på 360 og 390 og 2 linjer på 1280.
- **Kan en 11-årig læse den?** Ja. Den er lang, men hvert led er et ord fra appen. "1 åbning (1 gang)" er det tungeste, men det er ikke forkert.

**619 blok 2 og 623 blok 1 (stormen over otte dage):** alt på 360, 390 og 1280, og ens på alle tre.

| Hvornår | Hvad | Slutkortet / startkortet |
|---|---|---|
| man. 28/9 09:00 | Blandet, 4 løst (første storm nogensinde) | "Ny rekord på denne enhed!", ingen "bedste", "I dag: 4 gåder · denne uge: 4 gåder." |
| man. 10:00 | Gafler, 2 | ingen ros, "Gafler: bedst 2 i dag · bedst 2 denne uge." |
| man. 11:00 | Gafler, 3 | "Din bedste Gafler-storm denne uge!", aldrig oven i "Ny rekord" |
| man. 12:00 | Gafler, 5 og Stop | ingen ros, "En stoppet storm tæller ikke som rekord …", lageret uændret |
| tir. 29/9 00:30 | startkortet | "I dag: ingen storm endnu · denne uge: 4 gåder." og "Gafler: ingen storm i dag · bedst 3 denne uge." Under Blandet er der ingen temalinje. |
| tir. 10:00 | Gafler, 1 | ingen ros (dagens første) |
| tir. 11:00 | Gafler, 2 | "Din bedste storm i dag!" (over alle temaer; dagen har kun Gafler, og den vinder over temaets, som Chaturanga valgte). Temalinjen: "Gafler: bedst 2 i dag · bedst 3 denne uge." |
| man. 5/10 00:30 | startkortet | ugen er væk (ingen linjer), rekorden står |
| man. 5/10 10:00 | dagens storm med Gafler valgt, 2 | tæller med i Gaflers linje ("Gafler: bedst 2 i dag · bedst 2 denne uge.") |

- Alle gåder i Gafler-stormene var gafler.
- Midnat og mandag nulstiller rigtigt. Uger og dage er lokale.
- En stoppet storm tæller ikke.
- Ros kommer kun, når en tidligere storm samme dag eller uge er slået.

**Er startkortet for meget på 360?**
- Startkortet er 570 px højt, og Start står 425 px nede i kortet.
- Over temavalget står tre linjer tal, der fylder 6 tekstlinjer på 360 (`S-360-628-storm-startkort.png`).
- De siger det samme på tre måder:
  - "4 gåder (4 i træk)"
  - "I dag: ingen storm endnu · denne uge: 4 gåder."
  - "Gafler: ingen storm i dag · bedst 3 denne uge."
- "ingen storm endnu" og "ingen storm i dag" står lige over hinanden, og "4 gåder" og "bedst 3" er to måder at skrive et tal på.
- Det er S10 (lav).

**623 blok 2 (hårdt mellemrum):**
- **Mit bibliotek**, 12 temaer og Find feltet: 41 "tal %" på 360 og 390, alle med hårdt mellemrum, 0 brudt.
- **Uden for Mit bibliotek** ("Øv et tema" og temastatistikken, #30): 24 med almindeligt mellemrum, men 0 brudt med disse data.

**Lærersiden:** 25 koder på 360, 390 og 1280, med "Svagest først" og folden som i 610.
- Siden er 3,3, 3,0 og 2,5 skærme høj.
- 0 netkald, 0 JS-fejl, ingen vandret rulning.

**Fund:**

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| S7 | lukket | 614: Find feltet sammenligner antal felter på 30 s; 10 → 20 med 2 fejl er "hurtigere", ikke "gik ned" | |
| S8 | lukket | 619: sætningen tæller hver slags for sig uden "forsøg" og "koordinatøvelse" | |
| S10 | lav | Stormens startkort på 360: tre linjer tal (6 tekstlinjer) før temavalget, med to ord for det samme ("ingen storm endnu" / "ingen storm i dag") og to talformer ("4 gåder" / "bedst 3") | Chaturanga: samme ord i begge linjer ("I dag: ingen storm endnu" og "Gafler i dag: ingen storm endnu"), og overvej at samle dag og uge i én linje under temavalget. Ikke nødvendigt for klassen. |
| S9 | lav | Står fra 610 (lærerfoldens overskrift), venter på Marc | Chaturanga, hvis Marc vil |
| S5, S6 | lav | Står fra 598 | Chaturanga |

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-628/maal-628.mjs` | **18/18** grønne (Chrome 154, 2.000 Monte Carlo-forsøg pr. linje) |
| `node outputs/kritik-628/hop-628.mjs` | **3/3** grønne. Yantras `hop563` + `hop621` 13/13 to gange; den gamle `hop563` på `4ca0c63` 10/10 |
| `node outputs/kritik-628/skak-628.mjs` (ordre-623 @ `4faeb6a`) | **20/20** grønne |
| `node outputs/kritik-628/verify-kritik-628.mjs --blok 1` og `--blok 2` | grønne |
| `npm run lint` | grøn |

**Undervejs var fire tjek røde, alle mine egne fejl:**
- To regex og en forventning. T6: jeg ventede Gafler-rosen, men rosen over alle temaer vinder med vilje.
- En måling af startkortet, mens det var skjult.
- De er rettet, og alt er kørt igen fra start.

## Hvad er næste

**Setu:** kopierer `dist/maal-billede/index.html` og `dist/maal-billede/maal-billede.js` fra løftmodellens `main` (`287210d`) til sitets `assets/vaerktoejer/maal-billede/`. Intet andet er ændret siden 620's kopi. Kopien kan ske nu. M19-M22 kan komme med i den næste.

**Yantra:**
1. **M19:** guld i Uger kun ved to uger i træk i samme retning, eller mindst en sætning i forklaringen om tilfældigt guld med mange uger.
2. **M20:** "forskel fra 3. aug." i tabellens faste celle.
3. **M21:** højden i status, og en note, når filernes højde er en anden end sidens.
4. **M22:** "samme kameraplads" som ét mærke og én forklaring.
5. **M18** fra 617.

**Chaturanga:**
- 623 kan merges; jeg har intet, der stopper det.
- S10, når det passer.
- #30 (hårdt mellemrum uden for Mit bibliotek) står på hans liste. Jeg har ikke set et brud på 360/390 med mine data, så den er lav.
- #29/S9 venter stadig på Marc.

**Marc:**
- Intet valg kræves for de to domme.
- iPhone-prøven fra 610 står stadig: flere gemte målinger valgt på én gang fra Fotos, og kommer de urørte frem?

**Betydning for Hara** (Coaching-planeten, delmål "Appen mærkbart bedre"):
- Mål dit billede har nu et værktøj til uge-for-uge-opfølgning, og det kan komme på sitet nu.
- M19 er det, der skal til, før en træner kan stole på guldet over mange uger.

## Ærlige grænser

- **Ingen telefon:** headless Chrome 154 (Mål dit billede) og Playwrights Chromium (skakken) på Windows. Touch er Playwrights. Uret i skakken er falsk.
  - Sidelæns rul med en finger i Uger er ikke prøvet. Jeg har sat `scrollLeft`.
- **Klikfejlen i M19 er Yantras antagne, ikke målt på en træner.** Kun dødløft ved gulvet og uden det fjerne nav.
- **Filerne i Uger er skrevet om af mig** ud fra én fil gemt af siden. Datoerne og højderne er mine.
- **Én elev, spillet af mig:** 10 og 20 felter og hvilke gåder er mine valg. Gåderne er løst med banken, ikke tænkt.
  - "Denne uge!" for temaet er set i browseren (s3). "Næste dag" og "næste uge" er set på det falske ur, ikke over rigtige dage.
- **Del H har 12 temaer lagt i lageret på forhånd,** ikke spillet.
- **Hvad en træner og en 11-12-årig forstår** (M20, M22, S10, sætningens længde) er min vurdering, ikke prøvet på dem.
- **Kørt:** kun mine egne scripts, og Yantras `hop563`/`hop621` i en arkivkopi. Ikke Yantras eller Chaturangas hele suite. Skakken er ikke kørt på `main` alene; `ordre-623` har 619 med.
- **Grænserne:** ingen rigtige atleter, elever eller klip, ingen net, ingen push og ingen merge. Løftmodellen, sitet og skakken er ikke rørt.
