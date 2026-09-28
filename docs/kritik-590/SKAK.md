skakken klar til Marcs klasse: ja

Ja. Koden bærer kun procent pr. kompetence: intet navn, ingen dato, intet ur. QR-koden bærer præcis de samme 20 tegn og intet andet. Jeg har læst den med min egen QR-læser.

Kameraet på laerer.html gemmer intet billede og sender intet, og det slukkes ved Stop og ved faneskift. Hverken skak.html eller laerer.html kan sende noget, og det tastede vises aldrig som HTML. Lærersiden, også klassens fremgang, viser kun hele klassen, og intet gemmes uden flueben.

Marc skal vide to ting:
- **S1, lav:** i praksis er koden næsten altid elevens egen, et fingeraftryk af tallene den dag. Det er i orden, fordi eleven selv viser den. Men én kode alene på lærersiden viser én elev.
- **S4, lav:** QR-scanningen er kun prøvet med et falsk kamera. Ingen har prøvet et rigtigt webkamera.

# Kritik 590, blok 2: skakken efter Chaturangas 577, 581, 587 og 592

Bhishak, 28. sep 2026. Ordre 590.
- **Skak `main` @ `890c033`** er hentet med `git archive`. Træet er ikke rørt.
  - Merget: 577, 581, 587 (QR og kamera) og 592 (K26/K25 og klassens fremgang).
  - 587 og 592 blev merget, mens jeg målte. Min første kørsel på `f7966e8` (581) var 24/24. Alt nedenfor er kørt igen på `890c033`.

## Hvad jeg målte

`outputs/kritik-590/skak-590.mjs`, **43/43 grønne** → `skak-590.json` og `S-*.png`. Headless Chromium på 390 (touch) og 1280 (mus), file://, alt net afvist.
- **A, filerne:**
  - Jeg søgte i `skak.html` og `laerer.html` efter alt, der kan sende noget, læse maskinen eller gemme et billede.
  - 2.000 koder (udgave 1 og 2) ind og ud.
  - Gåderne i de nye temaer talt op.
- **B, min elev** fra 517-558 (mat i 1, ellers største slag, ellers skak, ellers tilfældigt):
  - Hun prøvede hvert af de fem nye temaer tre gange som begynder. Uret stod på mandag 28. sep kl. 9.
  - Første træk er hendes eget. Er det forkert, fortryder hun og løser gåden.
  - Bagefter "Vis min kode". Koden læste jeg igen en måned senere kl. 20:13 og igen uden ugerne.
- **C, laerer.html:**
  - 25 syntetiske koder (20 i udgave 2 med frø 590, 5 i udgave 1), tastet med små bogstaver, mellemrum og O for 0.
  - Fluebenet, HTML i feltet, én kode alene og alle 25 i én lang linje.
- **D, QR og kamera (587):**
  - QR-koden i Mit bibliotek er læst af **min egen QR-læser**, fra SVG-stien, uafhængig af Chaturangas: formatinfo, maske, dataord og bogstav-tilstand efter ISO/IEC 18004, kun version 2.
  - Et **falsk kamera** (`canvas.captureStream`) viste laerer.html elevens egne QR-skærmbilleder fra skak.html: tomt, A, tomt, B, tomt, A.
  - Siden fik tællere på `toDataURL`, `toBlob` og `MediaRecorder`.
  - Til sidst et kamera, der siger nej.
- **E, klassens fremgang (592):** 25 syntetiske koder fra sidst og 25 fra i dag, fluebenet sat og taget af.

## Kompetence-koden (udgave 1 og 2)

- **Kun tal.** Koden på skærmen læst med `laesKode` giver præcis elevens tal:
  - gafler 40 %, bindinger 90 %, mat i 1 100 %
  - de fem nye temaer efter hendes egne forsøg (fx på 390: hængende brik 100 %, aflede 0 %, fanget brik 70 %)
  - Det er de samme tal, som Mit bibliotek regner.
- **Ingen tid, intet navn:**
  - Samme tal en måned senere om aftenen giver samme kode (`88N9-R5VC-PFR0-00TB-SCB1`).
  - Når ugerne slettes fra lageret, giver det også samme kode.
  - Boksen under koden nævner intet navn og ingen dato.
- **At vise koden ændrer intet i lageret**, og der er 0 netkald.
- **skak.html kan ikke læse en kode:** `laesKode`, QR-læseren (`qrLaesMatrix`) og `getUserMedia` står 0 gange i `skak.html`.
- **Udgave 1 og 2:**
  - 2.000 koder ind og ud giver de samme tal.
  - En kode fra udgave 1 får "ikke øvet" (0) i de fem nye temaer.
  - Blandet i ét felt tæller begge.
  - Står alle 25 i én lang linje uden mellemrum, deler siden dem rigtigt op efter kontrolsummen: "25 koder læst."
- **Hvad lageret ved om tid:**
  - `skak-gaade-fremgang-v1` gemmer ugenumre (`"uger":{"2961":[3,2]}`) og tre datoer fra før 577 (dagens gåde: `dagensLoest`, `dagsNoegle`).
  - Ingen tidsstempler.
  - Intet af det kommer med i koden, og det ligger kun i elevens egen browser.

## QR og kamera (587)

- **QR-koden bærer kun koden.**
  - Min egen læser giver præcis de 20 tegn med bindestreger (`88N9-R5VC-PFR0-00TB-SCB1` på 390, `82JJ-4P63-Q0R0-00TB-SD32` på 1280).
  - Den er i bogstav-tilstand, niveau Q, og efter teksten kommer en afslutning (0000).
  - Der er ingen adresse, intet navn og ingen tid i den.
- **Scanningen virker med elevens eget billede:**
  - Det falske kamera viste A, B og A med tomme pauser (2,2 s). Feltet fik A, B, A, og status sagde "3 koder scannet. Vis den næste."
  - Samme kode tæller altså igen efter en pause, men ikke, mens den holdes op.
- **Intet billede gemmes eller sendes:**
  - 0 kald til `toDataURL`, `toBlob` og `MediaRecorder`.
  - Intet nyt i lageret, bortset fra fanens eget valg.
  - Intet `<canvas>` eller `<img>` på siden.
  - 0 netkald.
  - `laerer.html` indeholder hverken `toDataURL`, `toBlob`, `MediaRecorder` eller `createObjectURL`.
- **Kameraet slukkes:** efter Stop er sporet "ended". Startet igen er det "live", og når læreren skifter til "Klassens storm", er det "ended" igen.
- **Kamera nægtet:** "Kameraet må ikke bruges: browseren fik et nej, eller skolens indstillinger forbyder det. Tast koderne i feltet i stedet." Tastefeltet virker bagefter ("1 kode læst.").

## laerer.html med 25 syntetiske koder

- **"25 koder læst."** på begge bredder, med 23 kompetencer i de to lister.
- **Forslaget er "Klassens time: gafler":** "19 af 25 har øvet gafler, i snit 44 % rigtige; 9 ligger under 50 %."
- Ingen af de 25 koder står i resultatet, heller ikke uden bindestreg.
- Uden flueben er intet gemt. Med flueben gemmes det tastede under `skak-laerer-koder-v1`, og når fluebenet tages af, slettes det.
- `<img src=x onerror=...>` og `<b>` i feltet vises som tekst i listen over koder, der ikke kunne læses. Intet køres, og intet element laves; siden skriver kun med `textContent`.
- **Klassens fremgang (592):**
  - 25 + 25 syntetiske koder giver én sætning: "Siden sidst blev klassen bedre til gafler: 44 % mod 27 % i snit."
  - Ingen af de 50 koder står i resultatet.
  - Begge sæt gemmes kun med fluebenet (`skak-laerer-koder-v1` og `-sidst-v1`) og slettes begge, når det tages af.
- 0 netkald, 0 JS-fejl og ingen vandret rulning.
- På 390 er siden lang (ca. 4.200 px, fem skærme; `S-390-laerer-25.png`), men forslaget står på første skærm.

## De nye temaer og fremgang pr. uge

Min elev, tre gåder pr. tema, på `890c033` (med 592's K25: kun lichess-gåder inden for 250 af målet):

| Tema (knap) | Gådernes rating (390 / 1280) | Første træk rigtigt (390 / 1280) |
|---|---|---|
| Hængende brik ("Øv hængende brikker") | 607-722 / 607-784 | 3 / 3 |
| Aflede ("Øv at aflede") | 798-848 / 798-819 | 0 / 1 |
| Lokke ("Øv at lokke") | 538-737 / 669-738 | 3 / 3 |
| Fanget brik ("Øv fangede brikker") | 645-798 / 729-826 | 2 / 1 |
| Mat i 3 ("Øv mat i 3") | 469-771 / 674-766 | 1 / 0 |

- **Alle 30 gåder kom fra det rigtige tema og blev løst.**
- Hvert tema har 85 gåder, 40 under 900.
- Aflede har ingen gåde under 770 og er det tema, min elev klarer dårligst (1 af 6 første træk). Fanget brik starter ved 645. Det er Chaturangas egen grænse (#23).
- **Forklaringen står over brættet:**
  - "Aflede: Tving en forsvarer væk fra det felt eller den brik, den skal passe på."
  - "Lokke: Lok en brik (tit kongen) hen på et felt, hvor den kan angribes."
  - Det er til at forstå for en 11-årig, der læser den.
- **Fremgang pr. uge:**
  - Mit bibliotek skriver "denne uge: 100 % i 3 forsøg · sidste uge: ikke øvet".
  - Over listen står "Denne uge har du øvet 5 temaer i 15 forsøg."
  - Gemt er kun ugens nummer og to tal.

## Persondata: kan noget lække?

Nej, ikke ud af computeren: intet kan sende, og kameraet gemmer intet. To ting kan kobles til en elev, og begge er meningen:
1. **Koden (og QR-koden) er næsten altid unik (S1).**
   - Udgave 2 har 12^23 ≈ 6,6 · 10^24 mulige koder. I matematik er der 6^7 = 279.936.
   - Alle 25 syntetiske koder er forskellige, både med frø 577 og 590.
   - Teksten "alle med de samme tal har den samme kode" er sand, men sker næsten aldrig.
   - Den, der ser eleven vise sin kode, og som har koden gemt, kan finde elevens tal igen.
2. **Én kode alene viser én elev (S1).**
   - Taster eller scanner læreren én kode, står der "1 kode læst." og hver kompetence med "i snit 40 % · 1 af 1 har øvet".
   - Siden har ingen mindste klasse.
   - Det er elevens egne tal, som eleven selv har vist. Men "siden viser kun hele klassen" passer ikke, når klassen er én.
   - Klassens fremgang siger selv, at fravær kan flytte snittet, fordi koderne ikke har navne.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| S1 | lav | Koden er i praksis entydig (25 af 25 i begge tænkte klasser), og én kode alene viser den ene elevs procent pr. tema. Teksten til eleven og læreren kan læses, som om koden er anonym. | Skriv til eleven: "Koden er dine tal, ikke dit navn. Vis den kun til din lærer." Lad lærersiden skrive "Vises, når der er mindst 5 koder" under det. Marcs valg; ikke nødvendigt for dommen. |
| S2 | lav | Aflede har ingen gåde under 770, og min elev klarer 1 af 6 første træk dér. Fanget brik starter ved 645. | Chaturangas #23 (egne lette gåder). |
| S3 | lav | Lærersiden er ca. 4.200 px (fem skærme) på 390 med 23 kompetencer. | Fold "Øvet af under halvdelen" sammen som standard. |
| S4 | lav | QR-scanningen er kun prøvet med et falsk kamera (Chaturangas og mit). Et rigtigt webkamera med skærmskær, lysstofrør og en telefon på 20-50 cm er ikke prøvet. | Marc prøver det én gang med to elever, før han regner med det. Tastefeltet er reserven og virker. |

## Ærlige grænser

- **Målt på `890c033`.** Min første kørsel var på `f7966e8`, før 587 og 592 blev merget. Den er erstattet af kørslen på `890c033`.
- **Min elev er en model, ikke et barn:** tre gåder pr. tema på hver bredde. "Første træk rigtigt" siger noget om hendes model (slag og skak først), ikke om, hvor svære gåderne er for et barn.
- **Min QR-læser kan kun version 2 og retter ingen fejl.** Den læser SVG-stien, ikke pixels. Pixel-vejen er prøvet gennem Chaturangas læser med det falske kamera.
- **Kameraet er falsk:** `getUserMedia` giver en `canvas.captureStream` med elevens skærmbillede, pænt i midten. Et rigtigt kamera er ikke prøvet (S4).
- **De 25 (og 25 + 25) koder er syntetiske.** Ingen rigtige elever.
- **Første kørsel var rød i 2 af 24.** Fejlen var min: jeg lagde gaflerne ind som "4 løst, 6 fejlet", men `fejlet` tæller fejl blandt de løste. Med rigtige tal (10 løst, 6 med fejl) er alt grønt.
- **Headless Chromium på Windows**, ikke en rigtig telefon eller en skole-pc.
- **Skak er ikke rørt:** kun læst med `git archive`. K26 (592, "Find feltet" ruller) er ikke gentjekket her; den hører til min kritik 568.
