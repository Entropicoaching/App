skakken stadig klar til Marcs klasse: ja

Ja. Det, Chaturanga lavede i 592, holder for både eleven og læreren.

**K26 er lukket.** I "Find feltet", "Skriv feltets navn" og "Hvor står brikken?" står feltets navn, uret, hele brættet og tastaturet eller brikvalget på skærmen efter Start og Igen. Det gælder på alle fire skærme, også 360 × 640, og uanset om eleven trykkede på Start nederst eller øverst.

**Klassens fremgang virker, som Marc ville bruge den:**
- Uge 1 huskes med fluebenet.
- "Flyt koderne herned" flytter dem.
- Uge 2 giver én rigtig sætning, og ingen enkelt kode står nogen steder.

**K25 er lukket i de store temaer:** gafler, bindinger, spyd og mat i 1-3. I 568 fik en ny elev 1048 i gafler. Nu er hendes højeste 730.

**Men ikke i temaer med en lille pulje (S5, lav).** I Mellemtræk, Angreb på f7, Bagerste række og Offer får en ny elev på 800 stadig lichess-gåder op til 1036-1394:
- Mellemtræk i alle forløb, Angreb på f7 i 36 % og Bagerste række i 20 % af forløbene på 20 tryk.
- Grunden er, at de 3 af 10 valg fra hele temaet udvider vinduet til ±400.

Det er en gåde for svær en gang imellem, ikke en fare for klassen.

# Kritik 598, blok 2: skakken efter Chaturangas 592

Bhishak, 28. sep 2026. Ordre 598.
- **Skak `main` @ `890c033`** (592 merget), hentet med `git archive`. Træet er ikke rørt.
- Chaturanga arbejder på 597 i skak-træet (ændrede filer, ingen commit på `ordre-597`). Ordren siger, at jeg skal vurdere det, der er committet, så 597 er ikke med.
- `outputs/RAPPORT-592.md` er læst, også "Hvad Bhishak bør prøve".

## Hvad jeg målte

`outputs/kritik-598/skak-598.mjs` giver **58/58 grønne tjek** (`skak-598.json`, `S-*.png`).

Grundstammen er min `skak-590.mjs` (del A-E), nu også på 360. Nyt i 598 er det, Chaturanga bad mig prøve:
- **F:** K26
- **G:** K25 med min K17-måling fra 568
- **H:** klassens fremgang i Marcs to uger

**Browseren:** Playwrights Chromium headless.
- 360 × 780 og 390 × 844 med touch (eleven på 12 år)
- 360 × 640 (en lille telefon)
- 1280 × 800 med mus (læreren og projektoren)

Kun `file:` er tilladt: **0 netkald og 0 JS-fejl** i alle kørsler.

**Kun syntetiske data:**
- Min elev fra 517-590 (mat i 1, ellers største slag, ellers skak, ellers tilfældigt).
- `syntetiskeKoder` med mine egne frø: klassen 5981 og 598.
- Ingen elevnavne.

## Som elev

**De fem nye temaer (581)** er prøvet på 360, 390 og 1280: Hængende brik, Aflede, Lokke, Fanget brik og Mat i 3.
- Eleven løser 3 af 3 i hvert tema på alle tre bredder.
- Koden er udgave 2 (20 tegn) og bærer præcis hendes tal. Samme tal en måned senere om aftenen og uden uger giver samme kode.
- QR-koden bærer præcis koden og intet andet. Den er læst af min egen QR-læser fra 590.
- 0 net og ingen vandret rulning, også på 360.

**K26 "Find feltet" (592).** Eleven har selv rullet, så Start står nederst eller øverst på skærmen, og trykker dér. Så Igen. Det giver 48 tryk: 3 øvelser × 2 steder × 2 knapper × 4 skærme.

**Efter hvert tryk står det hele på skærmen:** feltets navn og uret, hele brættet, og tastaturet ("Skriv feltets navn") eller brikvalget ("Hvor står brikken?").

| Skærm | Find: navn, bræt (px fra toppen) | Skriv: tastaturets bund | Brik: valgets bund |
|---|---|---|---|
| 360 × 780 | 312, 361-671 | 672 | 716 |
| 390 × 844 | 346, 395-735 | 736 | 780 |
| 360 × 640 | 172, 221-531 | 532 | 576 |
| 1280 × 800 | 275, 328-688 | 689 | 733 |

- På 360 × 640 står "?" og uret øverst (26 px), og tastaturet slutter 108 px over bunden (`S-360x640-k26-skriv.png`).
- Tre tryk på de sagte felter giver "Fundet: 1, 2, 3" på alle fire skærme.
- I 568 stod navnet −35 px over skærmen på 360.
- Chaturangas spørgsmål om adresselinjen, der folder sig ind og ud, kan headless ikke svare på.

**K25 og K17 (592).** En ny elev (800) trykker 20 gange på hvert af de 17 temaer i "Øv et tema".

**Andelen er høj:** 91 % er lichess-gåder, med mindst 13 af 20 i hvert tema.

**I de store temaer er den højeste lichess-gåde under 900:**

| Tema | Højeste |
|---|---:|
| Mat i 1 | 646 |
| Mat i 2 | 726 |
| Gafler | 730 |
| Bindinger | 894 |
| Spyd | 741 |

I de små temaer fik hun i browseren Mellemtræk 796-1050 og Angreb på f7 615-978. I en tidligere kørsel af samme script var det 1049.

**Samme valg i node** med appens egen `vaelgTemaGaade` og `filtrerEfterTema`: 400 nye elever × 20 tryk pr. tema, med målet 650 (800 − 150).

| Tema | Puljen | Lichess nær målet | Forløb med en lichess-gåde over 900 | Højeste |
|---|---:|---:|---:|---:|
| Mellemtræk | 60 | 15 | 100 % | 1394 |
| Angreb på f7 | 79 | 34 | 36 % | 1049 |
| Bagerste række | 85 | 40 | 20 % | 1011 |
| Offer | 85 | 40 | 8 % | 1036 |
| Forvandling, Fanget brik | 85 | 40 | 1 % | 970, 1039 |
| Gafler, bindinger, spyd, mat i 1-3 | 514-1764 | 40 | 0 % | |

**Grunden (S5):**
- 7 af 10 valg tages nu kun inden for ±250 af målet. Det er K25-rettelsen, og den holder.
- De sidste 3 af 10 går til `vaelgNaesteGaade` over hele temaet. Når de nære er set, udvider den til ±400, altså op til 1050, og derefter ±800.
- I de store temaer er der egne gåder nok nær målet, så det sker aldrig.
- I temaer, hvor puljen er ca. 85 lichess-gåder, sker det. Chaturanga nævner selv mellemtræk som undtagelsen, men det gælder også f7, bagerste række og offer.

## Som lærer

**laerer.html med 25 syntetiske koder** (390 og 1280) er uændret fra 590 og holder:
- 20 i udgave 2 og 5 i udgave 1, tastet med små bogstaver, mellemrum og O for 0.
- Siden viser "25 koder læst." og 23 kompetencer.
- Ingen kode står i resultatet, og intet gemmes uden flueben.
- HTML vises som tekst, og 25 koder i én lang linje læses.
- Det falske kamera med elevens QR giver A, B, A. Kameraet slukkes ved Stop og ved faneskift, og intet billede gemmes. Et nægtet kamera siger "tast".

**Klassens fremgang (#24), som Marc ville bruge den** (360 og 1280):

1. **Uge 1:** 25 koder tastes, og fluebenet sættes: "25 koder læst."
2. **Uge 2:** siden åbnes igen. De 25 står i feltet. "Flyt koderne herned" flytter dem til "sidst" ("25 koder fra sidst læst.") og tømmer feltet.
3. **Uge 2's koder tastes.** Klassen er den samme tænkte klasse (frø 5981), 15 point bedre i gafler og 12 i aflede.
   - Sætningen: "Siden sidst blev klassen bedre til gafler: 38 % mod 23 % i snit."
   - Bedre: kun Gaffel (+15 point, under 50 %: 17 → 15). Dårligere: ingen. Stort set det samme: 7.
   - Aflede står under "Kan ikke sammenlignes endnu", fordi under halvdelen har øvet det.
   - Se `S-360-fremgang-uge2.png`.
4. **Fravær:** de 5 svageste mangler i uge 2.
   - Gaffel går fra +15 til +18 point. Ingen andre kompetencer bliver "bedre".
   - Linjen over listerne siger selv: "Sidst 25 koder, i dag 20. Koderne har ingen navne, så det er klassens snit: er nogle elever væk den ene dag, kan snittet flytte sig, uden at nogen er blevet bedre." Det er tydeligt nok.
5. **Blandede udgaver:** uge 1 i udgave 1 (16 tegn).
   - De fem nye temaer står under "kan ikke sammenlignes", og gafler er stadig bedre.
   - Linjen bliver lang (15 kompetencer), men den er rigtig.

**I alle tre:**
- Ingen enkelt kode i resultatet.
- "Klassens time: gafler" står.
- Ingen vandret rulning på 360.
- Begge sæt er kun gemt, fordi fluebenet er sat.

**Er "5 point" en fornuftig grænse med 25 elever?** I min klasse gav den præcis det, jeg havde skruet på (gafler), og ingen falske "bedre", heller ikke ved fravær.

Men en ægte fremgang i et nyt tema, som under halvdelen har øvet (aflede, +12), vises slet ikke (S6, lav). Siden siger hvorfor, og det er ærligt. Men læreren ser ikke det tema, klassen måske har arbejdet med.

## Persondata

- Kun opdigtede koder og min syntetiske elev.
- Koden bærer kun procent, ikke navn, tid eller enhed. `skak.html` kan ikke læse koder og har intet kamera.
- `laerer.html` gemmer kun med flueben, og det gælder begge sæt (`skak-laerer-koder-v1`, `skak-laerer-koder-sidst-v1`).
- Kameraet gemmer intet billede.

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| S5 | lav | K25 er kun lukket i de store temaer. I temaer med en lille pulje (ca. 60-85, næsten kun lichess) giver de 3 af 10 valg fra hele temaet (`vaelgNaesteGaade`, der udvider til ±400) en ny elev lichess-gåder over 900. Det gælder Mellemtræk (alle forløb, op til 1394), Angreb på f7 (36 %, 1049), Bagerste række (20 %), Offer (8 %), Forvandling og Fanget brik (1 %). | Chaturanga: lad også den sidste gren holde sig inden for et vindue (fx ±250, og kun ±400, hvis intet andet findes), eller vælg dér kun blandt temaets egne gåder. Test med 400 nye elever × 20 tryk pr. tema som ovenfor. |
| S6 | lav | Klassens fremgang: en fremgang i et tema, som under halvdelen har øvet, vises ikke (aflede +12 står under "kan ikke sammenlignes"). Det er reglen, og siden siger den. | Ingen rettelse nødvendig. Overvej at skrive antallet af elever, der har øvet, i linjen. |

S1-S4 fra 590 står, som de stod (lav). K26 og K25 (store temaer) er lukket, og K24 (tekst) er rettet i MOD-LICHESS.

## Ærlige grænser

- **Ikke en telefon:** headless Chromium på Windows. Touch er Playwrights. Adresselinjen, der folder sig ind og ud på en rigtig telefon, er ikke målt.
- **Ikke en elev på 12 år:** min elev er et script med en fast model. Om en rigtig elev forstår "Find feltet" eller fremgangen, er ikke prøvet.
- **Simuleringen i node** bruger `data/gaader-lichess.json`, den store bank og de egne gåder, som mit script kender dem. Appens pulje kan have flere egne gåder. Browseren gav dog samme billede (Mellemtræk 1050, f7 978-1049).
- **Kameraet er et falsk kamera** (canvas.captureStream), ikke et webkamera.
- **597 er ikke med.** Den var ikke committet, da jeg målte.
- **Grænserne:** ingen elevdata, og skak-træet er ikke rørt.
