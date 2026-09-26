# Kritik 409: Træningsbiblioteket og Lær skak set af en elev

**Klar til klassen: nej, fordi** to ting lærer eleven noget forkert: "Stop
matten" godtager, og peger med hint-pilen på, træk der giver dronningen eller
et tårn væk (B1), og Lær skak har to ulovlige stillinger hvor dronningen/tårnet
slår kongen og appen siger "Rigtigt!" (B2). Begge er små at rette. Resten af
biblioteket holder fagligt (54 stikprøver: lovlige, entydige, rigtigt tema), og
som elev er det til at finde ud af; efter B1-B2 er det klar, B3-B6 gør det
værd at blive ved med.

Grundlag: `docs/kritik-409/ELEVEN.md` (blok 1, headless 390 px, `E-*.png`) og
`docs/kritik-409/SKAKKEN.md` (blok 2, dybde 4 + fuldstændig slutspilsløser).
Skak `main` e56842f, kun læst.

## Fund (vigtigst først)

**B1 - "Stop matten" belønner at give brikker væk, og hint-pilen viser det.**
Reglen "alle træk der stopper mat i 1" godtager i 4 af 8 øvelser et træk der
taber mindst 3 (dybde 4): sm07 Dg4+ (dronningen, -12), sm03 Td3+ (-6), sm08
Tc6 (-6), sm02 Kg7 (-3). Pilen ("Vis et hint", og efter to fejl) viser altid
`godeFoerste[0]`, og i sm03, sm07 og sm08 er det tabstrækket. Målt: pil Dd1-g4,
"Kan du se hvorfor det virker?", og Dg4+ giver "Matten er stoppet."
(`S-sm07-hint-pil.png`). *Konsekvens:* den ene kompetence der skal lære "se
hvad modstanderen truer" lærer at ofre dronningen. *Forslag:* godtag kun svar
der stopper matten OG ikke taber mere end det bedste (samme søgning som
"Red din brik"), sortér listen så pilen viser det bedste, og sig bagefter
"Men nu hænger din dronning" hvis eleven fandt et dyrt svar.

**B2 - Lær skak: to ulovlige stillinger, kongen kan slås.** Trin 3
"Dronningen" (`7k/8/8/8/3Q4/8/8/4K3 w`: Dd4 giver skak til Kh8) og trin 23
"Princip: tårne på åbne linjer" (`k7/8/8/8/8/8/1P6/R3K3 w`: Ta1 giver skak til
Ka8). Målt i trin 3: Dxh8, kongen forsvinder, "Rigtigt! Sådan går dronningen."
(`E-33-laer-dronningen.png`). Trin 3 er det tredje en ny elev ser. *Forslag:*
flyt kongen (fx til h7 i trin 3, h8 i trin 23), og en test der tjekker ALLE
Lær skak-FEN'er for "siden der ikke er i træk står i skak".

**B3 - Tårn mod konge: "3 vundne i træk" er for svært for en 10-årig.**
Grænsen 35 er rimelig (højst 14 ved perfekt spil). Men en elev der kan
"kassen" og kigger ét svar frem, bruger 18, 12, **35+, 35+**, 16, 10 træk
(tk1-tk6); to af seks stillinger slår grænsen, og ét tab nulstiller rækken.
Ca. 7 partier, 150 egne træk før det sidder (blok 1: "2 af 3" to gange, så
forfra). *Forslag:* grænse 50 (den rigtige 50-træksregel), "3 af de sidste
4", og 3-4 "gør kassen mindre"-øvelser (ét træk) før hele partiet.

**B4 - Oppositionen: hintet siger "frem", svaret er sidelæns, og 8 øvelser
er 3 mønstre.** Facit er eksakt rigtigt (løseren: det ENESTE vindende træk i
begge trin, alle 8). Men hint2 "Gå nu frem ved siden af ham" passer ikke på
Kc4-b4 (7 af 8 er sidelæns). op01/03/05 og op02/04/08 er samme manøvre
forskudt. Øvelsen slutter før bonden flytter. *Forslag:* "Gå til siden, så
du igen står over for ham", flere forskellige stillinger (løseren kan finde
dem), og spil linjen færdig til bonden forvandles som afslutning.

**B5 - "Vis et hint" er svaret.** I alle gåde-kompetencer viser første hint
pilen med hele trækket. Der er ingen trappe (tekst → brikken der skal flytte
→ pil), som taktikstien og lichess har. For en elev der er gået i stå, er
næste skridt at se svaret, ikke at tænke. *Forslag:* 1. tryk: hint-teksten
(den findes allerede, `k.hint`) + ring om brikken; 2. tryk: pilen.

**B6 - Oversigten har ingen vej.** 18 ens "Træn"-knapper på 4,4 skærme,
alle ☆☆☆☆☆. "Red din brik" (niveau 1) står som nr. 15 efter afdækket angreb
(3); Tårn mod konge (3) før Oppositionen (2); Mat i 2 (3) før Dronning mod
konge (2). *Forslag:* en "Næste for dig"-knap øverst efter stien i
SKAKKEN.md, og "Red din brik" lige efter "Slå den ubeskyttede".

**B7 - "Du er sort." efter hvert rigtigt træk i Lær skak.** Opgaveteksten
bygges ud fra hvem der er i træk, så efter elevens træk står der "Du er sort.
... Sæt den sorte konge mat" (alle 11 trin målt). På skærmen dækkes den af
"Rigtigt!"-linjen; en skærmlæser læser den. *Forslag:* byg farven fra trinnets
FEN, ikke fra motoren.

**B8 - Rokér i tide: 3 af 8 uden valg.** ro1-ro3 har brikker på den anden
side, så kongen kan slet ikke trækkes derhen; "Kun den ene vej er lovlig -
hvilken?" har ét svar. De 5 med angrebet felt er gode. *Forslag:* skift de tre
ud med stillinger hvor den anden vej er fri, men et felt er angrebet.

**B9 - Dronningemat nævner aldrig patt i øvelserne.** dm01 har 7 patt-træk,
dm06 har 4; spiller eleven et, står der "Det var ikke skak ...". *Forslag:*
eget hint: "Patt! Kongen kan ikke flytte og står ikke i skak - det er
uafgjort. Giv den et felt."

**B10 - Små ting.** Efter hvert rigtigt gaffel/binding/spid: "Rigtigt! Du
vandt materiale." (samme linje, intet om hvad der blev ramt). Afdækket 03CF0:
andet træk f3 (+2 mod +3) afvises. Lær skak rokade: ringen står på g1 efter
lang rokade. Ulovligt træk i brik-trinnene (løber lige frem) giver ingen
besked. "Spring over"/"Start forfra" står stadig under brættet.

## Hvad der holder

- **Skakken i banken:** 54 tilfældige øvelser (3 pr. kompetence) er lovlige,
  facit kan spilles, løsningen er entydig på dybde 4, temaet er rigtigt
  (gafler rammer to ting, kvælningsmat er med springer og alle nabofelter egne
  brikker, baglinjemat på bagerste række). Alle 46 mat-i-1-øvelser har
  præcis ét mattræk. "Red din brik" godtager præcis de sikre træk.
- **Oppositionen og slutspillene er eksakte** (løseren), og slutspillenes
  beskeder ved patt, tabt brik og for mange træk er klare og venlige.
- **Forkert-hintene passer til fejlen** ("Det var ikke skak ...", "Det træk
  angreb ikke to ting ..."), og "Løst! ... med fejl eller hint, så rækken
  starter forfra" er ærligt.
- **Dronningemat, tårnmat og gaffel sidder efter 7-9 øvelser** med en fejl
  undervejs: kort nok til at en 10-årig når stjernerne i en time.
- **L1, L4, L6, L9, L10 fra ordre 400 virker:** "Rigtigt! ..." + Videre,
  "Du er hvid." før opgaven, "Et lovligt træk - men ikke det, opgaven beder om",
  kapitlerne som genveje.
- Ingen sidefejl i hele kørslen.

## Rækkefølgen og tårnmat i 35

Se `SKAKKEN.md`: rækkefølgen er rigtig inden for Matmønstre, men ikke på
tværs (B6), og tårnmat i 35 er rimelig som grænse, men for svær som
"sidder"-krav (B3).
