Matematikken mindre rodet: ja

Hoved/Hånd/Hjerte forståelig for en 11-årig: nej

Bhishak, ordre 648 blok 1, 28. sep. 2026. Matematikspillet før og efter Ganitas 643, set som en 11-årig på 390 px touch og som Marc foran klassen på 1280.

**Kort sagt.** 643 har ryddet det rigtige sted. "Tilbage til kortet" står nu samme sted på Min helt, i Journalen og i Questbogen (øverst, 24 px), de tre knapper står på én række, og Min helt er en femtedel kortere. Men den skærm, et barn ser først, har stadig ikke det, hun skal gøre: opgaven står knap to skærme nede. Og forklaringen af Hjerte er god, men Hoved og Hånd forklarer kun, *hvornår* tallet vokser, ikke hvad det er godt for. Og en helt ny elev når aldrig at se forklaringen.

## Hvad jeg målte

- **Før** = matematik `main` @ `31d22fd` (642 merget). **Efter** = `ordre-643` @ `471784d` (Ganitas blok 1 `7aedc4a` og blok 2 `471784d`). 643 er ikke merget, og `RAPPORT-643.md` findes ikke endnu (blok 3 er ikke committet). Jeg vurderer det, der er committet.
- Begge hentet med `git archive` til en midlertidig mappe. Matematik-træet er ikke rørt (Ganita arbejder i det).
- `outputs/kritik-648/mat-648.mjs`: headless Chromium (playwrights), 390 × 844 touch (×2) og 1280 × 900 mus, alt net blokeret (0 kald), uret og `Math.random` låst, reduceret bevægelse, 0 JS-fejl. Tal i `mat-648.json`, billeder `M648-*.png`.
- Samme gemte spil som Ganitas egne billeder (Møllens forløb 1 mestret, niveau 2), men med mit fantasinavn Tulle. Og en helt ny elev fra en tom browser (Lav din figur, Start eventyret).
- Tallene nedenfor er alt, hvad der kan ses: tekst med en boks og uden `display: none`. "Første skærm" er det, der står uden at rulle.

## De tre skærme, før og efter

| Skærm | Bredde | Før | Efter |
|---|---|---|---|
| Kortet, første skærm | 390 | 51 ord, 12 tal, 7 knapper | 53 ord, 12 tal, 9 knapper |
| Kortet, hele siden | 390 | 2,33 skærme, 123 ord, 27 tal | 2,26 skærme, 122 ord, 27 tal |
| Første svarknap (y) | 390 | 1701 px (2,0 skærme nede) | 1642 px (1,9 skærme nede) |
| Første svarknap (y) | 1280 | 1859 px | 1801 px (2,0 skærme nede) |
| Opgaven, én skærm | 390 | 65 ord, 14 tal, 4 knapper | 65 ord, 14 tal, 4 knapper (uændret) |
| Min helt, første skærm | 390 | 93 ord, 12 tal, 1 knap | 88 ord, 12 tal, 3 knapper |
| Min helt, hele siden | 390 | 3,73 skærme, 406 ord | 3,02 skærme, 331 ord |
| Min helt, hele siden | 1280 | 3,25 skærme, 406 ord | 2,62 skærme, 331 ord |
| "Tilbage til kortet" (y) | 390 | Min helt 3041, Journalen 811, Questbogen 1082 | 24, 24, 24 |

**Hvad der er bedre, og som en 11-årig mærker:**
- **Tilbage står ét sted.** Før lå "Tilbage til kortet" i bunden af Min helt, 3,6 skærme nede; nu øverst til venstre på alle tre sider. Det er den tydeligste forbedring.
- **Knapperne på én række.** Min helt, Journalen og Questbogen står side om side (før: en bred Min helt og to under). Kortet og opgaven rykker ca. 60 px op på 390 (første svarknap 1701 til 1642).
- **Låste steder er stille.** "🔒 Mestr Grusgravens forløb 1-2" står ikke længere på kortet (læses stadig højt). Kortet ser roligere ud (`M648-foer-390-1-kortet.png` mod `M648-efter-390-1-kortet.png`).
- **Min helt er kortere.** 75 ord og 0,7 skærm mindre: gråt udstyr ud over det næste er foldet bag "Se 4 mere, du kan få", og færdigheder, eleven ikke er begyndt på, fylder én linje.

Derfor **ja, mindre rodet**. Men det er oprydning i kanten. Det, der gør skærmene travle, er stadig der (G3 og G4).

## Hoved, Hånd og Hjerte

Ordene (efter 643, de samme i spillet og på `laerer.html`):
- **Hoved** (21 ord): "Hoved er at tænke og regne. Det vokser, når et forløb ved Møllen, Kirken eller Sporvognen giver dig et nyt niveau."
- **Hånd** (26 ord): "Hånd er at øve og gøre, fx at måle og handle. Den vokser, når et forløb i Grusgraven eller på Landsbygaden giver dig et nyt niveau."
- **Hjerte** (25 ord): "Hjerte er at hjælpe andre. Det vokser for hver person, du hjælper. Så går de med dig på kortet og kommer senere og hjælper dig."

Passer med koden: Møllen, Kirken og Sporvognen løfter `hoved`, Grusgraven og Landsbygaden `haand` (`spil-quest.js` 917-970); Hjerte er `1 + antal hjulpet` (`spil-figur.js:100`), og vennerne hjælper tilbage (takkekortet, `spil-app.js:1862`).

**Som en 11-årig:**
- **Hjerte: ja.** Hvad det er, hvordan det vokser, og hvad hun får ud af det, i tre korte sætninger. Det er den bedste af de tre.
- **Hoved og Hånd: nej.** Hun kan læse ordene, men ikke svare på "hvad skal jeg bruge Hoved 2 til?". Teksten siger kun, hvornår tallet vokser. Det er ærligt, for Hoved og Hånd gør intet i spillet: de bruges kun som tal (`spil-app.js:1954-1955`, `helten.js:71`). Ordren til Ganita bad om "hvad der sker, når hver vokser"; det står kun for Hjerte.
- **Skellet passer ikke med opgaverne.** Ved Møllen deler hun brød (at gøre), i Grusgraven måler hun (at regne). Et barn, der har spillet begge steder, kan ikke se, hvorfor det ene er Hoved og det andet Hånd.
- **To spilord bærer forklaringen.** "Forløb" og "et nyt niveau" skal hun allerede forstå, og "niveau" er også figurens Niveau 2 lige over. "Et forløb giver dig et nyt niveau" og "Næste niveau: mestr et forløb eller hjælp en person" står 200 px fra hinanden og betyder næsten det samme.

**Visningen:**
- **Elev med gemt spil, første gang:** forklaringen står åben lige under tallene, hele boksen på første skærm (390: y 266, 285 px høj). Rolig og tydelig; "Forstået" lukker den (`M648-efter-390-4-hhh-foerste-gang.png`). Den skubber opgaven 295 px længere ned (første svarknap 1937 px, 2,3 skærme).
- **Helt ny elev: ser den ikke.** "Start eventyret" ruller siden ned til åbningsscenen (`scrollY` 1607 på 390, 1680 på 1280). Forklaringen står ved y 266, altså halvanden skærm over. Flaget `ganita:hhh-set` sættes, når boksen tegnes, ikke når den ses, så efter en genindlæsning er den lukket (`efterGenindlaes: false`). Hun får den kun, hvis hun selv ruller op, før siden genindlæses (G1).
- **"?"** er 30 × 30 px og sidder på Hjertes hjørne (G6).
- **Min helt** har nu to Hjerte-forklaringer lige under hinanden (G5).

## Marc foran klassen (1280)

- Spillet er en søjle på 520 px midt på skærmen; resten er baggrund (`M648-efter-1280-1-kortet.png`). Kortet og tallene ses fint, men opgaven står 2 skærme nede, så Marc skal rulle, før klassen ser, hvad de skal regne.
- Linjen "Næste niveau: mestr et forløb eller hjælp en person." er med lille skrift i billedet. Om den kan læses bagerst i et klasseværelse på en projektor, har jeg ikke målt.
- Ville Marc skamme sig over at vise det? Nej. Det ser pænt og roligt ud, farverne og tegningerne er venlige, intet flimrer. Det, der ville irritere ham, er rulningen og tallene (G3, G4), ikke udseendet.

## De tre vigtigste ting, der stadig er rodede

1. **Opgaven står under kortet (G3).** Den første skærm på 390 har figuren, tre tal, tre knapper og kortets top, men ikke det, eleven skal gøre. "Møllerdrengen venter på dig: »Del ligeligt«" er en linje, ikke en knap. Første svarknap står 1642 px nede (1,9 skærme), første dag med forklaringen 1937 px.
2. **For mange slags tal (G4).** På Min helts første skærm står 12 tal i otte slags: Niveau 2, 30 erfaring (to gange: i hovedet og i boksen Erfaring), Brøker 60 point, Udstyr 1 af 9, Titler 0, Hoved 2, Hånd 1, Hjerte 1. På kortet og ved opgaven kommer 19 indbyggere, otte prikker, Forløb 2 af 8, 0 af 4 opgaver og Brøker 60 oveni. En 11-årig ved ikke, hvilket tal hun skal jagte.
3. **Hoved og Hånd uden mening (G2).** Tre store tal øverst på kortet, men kun det ene betyder noget for hende. To af tre felter er pynt, og nu har de en forklaring, der siger det uden at sige det.

## Fund

| Fund | Alvor | Hvad | Forslag til Ganita (Marcs valg, hvor det rører spillet) |
|---|---|---|---|
| G1 | middel | En ny elev ser aldrig forklaringen: siden rulles til åbningsscenen, flaget sættes ved tegning, efter genindlæsning er den lukket. | Sæt flaget ved "Forstået" (eller når boksen har været i syne), ikke ved tegning. Lille, kun visning. |
| G2 | middel | Hoved og Hånd siger kun, hvornår de vokser, ikke hvad de gør; de gør intet i spillet. Skellet tænke/gøre passer ikke med opgaverne. | Marcs valg: enten får Hoved og Hånd en ærlig mening ("viser, hvor meget du har regnet ved ... "), eller de slås sammen til ét tal ved siden af Hjerte. |
| G3 | middel | Opgaven står 1,9 skærme nede på 390 og 2 på 1280; første skærm har ingen næste handling. | En knap "Til opgaven" (eller opgaven over kortet på 390). Kun visning. |
| G4 | middel | Otte slags tal på Min helts første skærm, erfaring to gange. | Fjern boksen Erfaring (den står i hovedet), fold Udstyr og Titler ned under udstyret. |
| G5 | lav | To Hjerte-forklaringer på Min helt: "Hjerte er de folk, du har hjulpet" og "Hjerte er at hjælpe andre". | Behold én. |
| G6 | lav | "?" er 30 × 30 px (under 44), og på Hjertes hjørne ser det ud til kun at høre til Hjerte. | 44 px trykflade, og stil det ved overskriften eller midt over de tre. |

## Ærlige grænser

- **Ingen rigtig 11-årig har læst det.** "Forstår" og "ser" er mit skøn ud fra ordene, spillets kode og skærmbillederne. Mine tal (ord, tal, knapper, y) er målt; dommen er læst.
- 643 er ikke færdig: blok 3 og `RAPPORT-643.md` mangler, og Ganitas træ har en ucommittet ændring (`outputs/643/B2-foerste-gang-390.png`). Ændrer blok 3 noget i spillet, gælder dommen ikke.
- Ét gemt spil (niveau 2, Møllen) og én ny elev. Senere i spillet (flere venner, mere udstyr, flere steder åbne) er skærmene længere.
- Headless Chromium på Windows, ikke en skole-pc eller en projektor. Skriftstørrelser er ikke målt.
