MMORPG-følelse: halvvejs. Rodet: ja (mindre end i 698, men klaret-skærmen viser to grønne kort med det samme, og Min helt har 16 tal de første sekunder). De tre vigtigste ting Ganita retter næste gang: (1) niveau-banneret og klaret-kortet siger det samme to gange i træk (`M717-390-6-niveauop.png`, `M717-390-10-klaret.png`; niveau-banneret og `renderKlaret` i `src/spil-app.js`): slå dem sammen til ét kort, så eleven kun trykker "Fedt!" én gang og "Hvor nu?" står øverst; (2) Hånd og Hjerte forklares med ting, en 11-årig endnu ikke har (`M717-390-2-ny-foerste.png`, `src/hhh-forklaring.js`): "Grusgraven" er et låst sted, han aldrig har hørt om, og "hjælper" siger ikke hvem; skriv "Hånd: du måler og regner om, når du kommer til det låste sted" eller vis et eksempel fra Møllen, og lad Forstået-kortet stå, til det er trykket væk (lige nu ligger det over "Din opgave nu"); (3) helten bliver kun større og får en ny genstand ved spring (`M717-390-8-helt-ro.png`, `src/helten.js`): mellem niveau 3 og 15 ser eleven kun tallet stige, og "Kappen har kobberkant / Du bærer en vandrestav" står som fire linjer tekst, ikke som noget, der sker; lad det nye udstyr dukke op i niveau-kortet og på helten med en kort bevægelse.

# Rapport 717: matematikspillet set med en 11-årigs og en lærers øjne

Bhishak, 29. sep. 2026. Kritiker; jeg har ikke rørt matematikspillet. Syntetisk elev "Tulle", ingen elevdata, ingen push, ingen merges.

## Gren

`kritik-717`, lavet med `git checkout -b kritik-717 main`. Commits: `69c2115b` (skærmbilleder og script), `ffacc112` (rapport) og en tredje, der tilføjer dette felt. Ingen push, ingen merge.

## Hvad jeg gjorde

- Hentede `main` fra `C:\Users\Entropi\Desktop\matematik` (`634d0a8`, ordre 700 er merget) med `git archive --format=zip` til en midlertidig mappe (tar kunne ikke læse formatet på Windows) og kørte det derfra.
- Læste kun RAPPORT-700 og RAPPORT-697 (Ganitas to nyeste) og første linje af min egen seneste matematik-kritik (698).
- Kørte mit elev-script (`outputs/kritik-717/mat-717.mjs`, kopi af `mat-698.mjs` med ét ekstra mål: Min helt i hvile efter 3,5 s). Headless Chromium, 390 touch og 1280 mus, uret og `Math.random` låst, uden net (0 kald), 0 sidefejl.
- Spillede som elev: opret helt, tre opgaver hos Mølleren, niveau op (til niveau 3), et klaret forløb, Min helt. Derudover 60 opgaver "ærlig" mod 60 opgaver "gætter" på 390.

## 1. Føles det som et MMORPG?

**Halvvejs.** Det er tydeligt bedre end i 698, og det, Marc beder om, er begyndt at ske:

- **Tallet vokser synligt:** "+40 Brøker (nu 140)" står stort i klaret-kortet, "Niveau 3" står som stort tal ved helten, erfaring, indbyggere ("27, før 19") stiger, og Hoved/Hånd/Hjerte har prikker, der fyldes.
- **Helten bliver stærkere:** han bliver større for hvert niveau (700 og 697), og kappe/stav skifter ved spring. Men mellem springene er det kun størrelsen og et tal; jeg ser ingen ny ting, der dukker op og bevæger sig. Det, Marc kalder MMORPG (helten *bliver* noget), er stadig mest en tekstlinje ("Du er nu lærling").
- **Det betaler sig at være et godt menneske: ja, og målt.** 60 opgaver på 390 med samme start (ny elev):

| | Ærlig (rigtigt første gang) | Gætter (trykker til det er rigtigt) |
|---|---|---|
| Niveau | 15 | 1 |
| Hoved / Hånd | 9 / 7 | 1 / 1 |
| Forløb mestret | 14 | 0 |
| Erfaring | 600 | 310 |

En gætter kommer altså ikke ud af niveau 1 på 60 opgaver, mens en ærlig elev er på 15. Det er præcis Marcs regel, og den er ikke "Cookie Clicker": man kan ikke trykke sig til styrke. Det, der mangler, er at *eleven ser* det: gætteren får kun en ikke-stigende helt, ingen besked om hvorfor.

Ikke set: om tallet tæller op som animation (jeg har billeder i 150, 650 ms og slut, `M717-390-5-svar-*.png`, men ikke målt selve tælleren i denne omgang).

## 2. Rod: hvilken skærm konkurrerer mest om blikket?

Synlige elementer ved første blik på 390 (ord / tal / knapper, mit script tæller kun det, der ligger i skærmen):

| Skærm | Ord | Tal | Knapper | Sidehøjde (skærme) |
|---|---|---|---|---|
| Ny elev, første skærm | 78 | 9 | 9 | 2,90 |
| Kortet med opgave | 49 | 12 | 9 | 2,20 |
| Niveau op (banner + klaret) | 88 | 10 | 5 | 3,34 |
| Klaret-forløb | 155 | 12 | 4 | 2,93 |
| Min helt, lige efter åbning | 118 | 16 | 3 | 3,31 |
| Min helt, i hvile (3,5 s) | 117 | 7 | 3 | 3,25 |

De tre vigtigste skærme er **ny elev (første skærm), klaret-forløb og Min helt**:

- **Klaret-forløb har flest ord (155)** og er den mest rodede: to grønne kort efter hinanden (banner "Niveau 3 · Lærling" med helt og "Fedt!", derefter klaret-kortet med samme helt og "Niveau 3"), "Bonus i rygsækken", "Hvor nu?", to steder at gå til, "Se det på kortet" og "Mere: Mølleren fortæller". Det er tre valg (Grusgraven, Landsbygaden, kortet) på et sted, hvor en 11-årig bare vil videre.
- **Min helt** har 16 tal de første sekunder og 7 i hvile (700 virker), men 117 ord: kappe/stav-tekst, tre bokse, "Øv her" og "Du har ikke hjulpet nogen endnu" kæmper stadig om blikket, før udstyret begynder. Det er en tekstvæg.
- **Ny elev, første skærm** er roligere (78 ord, 9 tal), men forklaringsboksen fylder næsten halvdelen af skærmen og skubber "Din opgave nu" ned.
- **Kortet med opgave** er den rolige skærm (49 ord, 12 tal); den er godt.
- På 1280 er tallene ens eller lidt højere (klaret 161 ord og 16 tal, Min helt 150 ord og 19 tal lige efter åbning, 136/10 i hvile); ingen vandret rulning på nogen af skærmene.

## 3. Forstår en 11-årig Hoved, Hånd og Hjerte første gang?

**Halvt.** Forklaringen står, hvor den skal (lige under de tre bokse), og er kort (`M717-390-2-ny-foerste.png`):

- "Hoved er at regne: dele, brøker og klokken." God: konkret.
- "Hånd er at bruge matematikken: mål og regn om i Grusgraven." En 11-årig kender ikke Grusgraven (den er låst 🔒 på kortet, "Mestr Møllens forløb 1-2"), så sætningen peger på et sted, han ikke har været. Ordet "bruge matematikken" er også abstrakt. Under Min helt står det bedre: "Mål og regn om, så vokser den".
- "Hjerte er at hjælpe andre. Det vokser for hver, du hjælper." Klart nok, men *hvem* og *hvordan* fremgår først, når han møder Ane og Niels; første gang ser han bare tre tal på 1.
- Boksen forsvinder først, når man trykker "Forstået". Det er godt (ingen tvang), men mange 11-årige trykker uden at læse.

Min dom til lærer-vinklen: Hoved er forståeligt, Hjerte næsten, Hånd ikke. Hånd og Hjerte er også de to, der står som 1 uden bevægelse i lang tid (Hånd vokser først i Grusgraven), så eleven kan ikke se, hvad han skal gøre for at få dem til at stige.

## 4. Er mine seneste fund (698) lukket?

| 698-fund | Status | Bevis |
|---|---|---|
| Min helt: "+1/+40", to grønne mærker, "Øv her" og "Siden sidst" på første skærm (16 tal) | **Lukket i hvile, delvist lukket lige efter åbning** | 16 tal lige efter åbning, 7 i hvile efter 3,5 s; "Øv her" ligger nu under Hoved/Hånd/Hjerte (`M717-390-8-helt-ro.png`) |
| Klaret-skærmen: "Hvor nu?" under et helt skærmhøjt kort (3,04 skærme) | **Lukket** | Klaret-kortet står øverst, kortet er skjult, mens det står; sidehøjde 2,93 (`M717-390-10-klaret.png`) |
| Hånd: "måle og handle med penge" siger ikke, hvad en 11-årig gør | **Delvist lukket** | Teksten er nu "mål og regn om i Grusgraven" (`hhh-forklaring`), men peger på et låst sted; se afsnit 3 |

Nyt, der opstod, mens de blev lukket: banneret "Niveau op" og klaret-kortet står nu lige under hinanden med samme helt og niveau (det var ikke tydeligt, da klaret-kortet lå langt nede). Det er fund nr. 1 nedenfor.

## 5. De tre vigtigste ting Ganita retter næste gang

1. **Slå niveau-banner og klaret-kort sammen** (`M717-390-6-niveauop.png` og `M717-390-10-klaret.png`; niveau-banneret og `renderKlaret` i `src/spil-app.js`). Ét kort: helt, "Niveau 3 · Lærling", bonus, "Hvor nu?" og de to steder; fjern "Se det på kortet" som tredje knap. Mål: højst ca. 100 ord på klaret-skærmen mod 155 nu.
2. **Gør Hånd forståelig for en, der ikke har været i Grusgraven** (`M717-390-2-ny-foerste.png`; `src/hhh-forklaring.js`, forklaringen af Hånd og Hjerte). Skriv, hvad eleven *gør* i Møllen ("du måler og regner om"), og lad forklaringsboksen ligge under "Din opgave nu" i stedet for over; vis Hjerte med et eksempel ("hjælp Ane med brødet").
3. **Lad helten blive stærkere som en hændelse, ikke som en tekstlinje** (`M717-390-8-helt-ro.png`; `src/helten.js`, teksten om kappe og stav i Min helt). Kappe/stav-teksten (fire linjer) kan blive til ét lille mærke "Nyt: vimpel ved niveau 5", og det nye udstyr skal dukke op i niveau-kortet med en kort bevægelse.

## Ærlige grænser

- Ingen rigtig 11-årig eller lærer har set noget; alt er min vurdering ud fra billeder og tal. Touch er emuleret i headless Chromium på Windows.
- Ord- og tal-tællet er kun det, der ligger inden for skærmen ved første blik (ikke det, man ruller til), og det er ikke sammenligneligt med tal, hvor sidehøjden er anderledes.
- Tælleranimationen ("tallet bliver større og animeret") har jeg set på tre billeder, men ikke målt; jeg dømmer den derfor ikke.
- Jeg har ikke spillet et forløb hos Ane, Niels eller Søren (Hjerte), og ikke Grusgraven (Hånd), så udsagnet om, hvad de to giver, er læst i teksten, ikke set i spil.
- Betydning for Hara: ikke Coaching-planeten (delmålet "Appen mærkbart bedre"), men school-planeten og sporet om matematikspillet: dom "halvvejs" med tre konkrete rettelser til Ganita.

## Filer

- `docs/kritik-717/RAPPORT-717.md` (denne)
- `outputs/kritik-717/mat-717.mjs`, `mat-717.json` og 38 skærmbilleder `M717-390-*.png` og `M717-1280-*.png`

## Hvad ændret

Intet i matematikspillet (kritik, kun læsning). I dette træ: `docs/kritik-717/RAPPORT-717.md`, `outputs/kritik-717/` (script, måletal, 38 skærmbilleder).

## Testresultat

Ingen tests i appen berørt. Elev-scriptet kørte rent på `main` @ `634d0a8`: 0 netkald, 0 sidefejl, niveau-op og klaret-forløb nået på både 390 og 1280. Rent træ efter commit.

## Hvad er næste

De tre rettelser til Ganita ligger i første linje og i afsnit 5: sammenlæg niveau-banner og klaret-kort, gør Hånd forståelig uden Grusgraven, og lad helten blive stærkere som en hændelse.
