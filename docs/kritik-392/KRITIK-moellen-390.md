# Kritik: Møllen lever (ORDRE 390), spillet som en elev på telefonen

Bhishak, ORDRE 392, blok 1. Kilde: matematik `main` (`53f01a6`, merge af `moellen-lever`), kun trukket ud med `git archive`. Intet er rettet.

**Sådan blev det set.** Headless Chromium på 390x844 med touch og 2x skærm, i en flygtig profil med figuren "Ravn" og ingen elevdata. Kommando: `node scripts/kritik-392.mjs --kun moellen`. Billeder og tal ligger i `outputs/kritik-392/` (`moelle-*.png` og `maalinger.json` under `moellen`).

Turen gik sådan:

1. Eleven spiller Møllens forløb 1-4. I hvert forløb svarer eleven én gang bevidst forkert for at se hintet, og resten rigtigt.
2. Efter trin 4 kommer klikkerprøven: 30 tryk på tallet, prikkerne og kortet.
3. Lyden slås til, og eleven giver ét rigtigt svar.
4. En "gættemaskine" i en ny profil tager 16 opgaver og trykker altid forkert først.
5. Trin 8 sættes direkte i spillets egen lokale tilstand, én gang med og én gang uden `prefers-reduced-motion`.

## Fund, vigtigst først

| # | Alvor | Fund | Målt | Til |
|---|---|---|---|---|
| M1 | Vigtigst | **Det der vågner, ses mest på kortet, og kortet er ude af syne, mens eleven regner.** Når eleven svarer, står siden rullet ca. 700 px ned, og kortet ligger over opgaven. Kun trin 1 ændrer Møllen-scenen øverst i opgavekortet (hjulet går fra gråt og stille til brunt og drejende). Trin 2-4 (vognen, bageriet, broen) findes kun på kortet. Der er de små (ca. 20-35 px på 390) og samlet i kortets nederste højre hjørne, delvist bag træer og Møllen-skiltet. "Se det på kortet" ruller op og virker, men eleven skal selv vælge at trykke. | scrollY ved svar: 683-710 px. Efter "Se det på kortet": 231-252 px. Billeder: `moelle-2-d-se-kortet.png`, `moelle-4-e-kort-trin4.png` | Ganita |
| M2 | Middel | **Beskrivelsen og målingen er uenige om, hvad der er hurtigst.** MOELLEN-LEVER.md siger, at vognen (14 s) og klokken (2,8 s) er det hurtigste. Men det nye vandsprøjt ved hjulet (`liv-sproejt`) gentager hver 1,2 s, og scenens gamle drypvand (`vand-dryp`) hver 1,0 s. Klokkens lydbuer (`liv-lydbue`) toner fra usynlig til fuld og tilbage hver 2,8 s. Det er det eneste, der minder om blink, men det er ca. 0,36 gange i sekundet og langt fra noget, der kan udløse anfald. Ved trin 8 kører 55 uendelige animationer samtidig (21 ved start, 39 ved trin 4). Med `prefers-reduced-motion` kører 0. | `maalinger.json` → `moellen.trin8.anim`, `moellen.forloeb[*].anim` | Ganita (ret teksten eller sæt sprøjtet ned til ca. 2-3 s) |
| M3 | Middel | **"Number get bigger" flytter sig kun fire gange på ca. 20 opgaver.** Indbyggertallet går 12 → 19 → 27 → 38 → 50 og vokser kun ved mestring. Det er rigtigt mod Cookie Clicker, men mellem mestringerne vokser kun erfaringsbaren (+10 pr. rigtigt svar), og den ligger øverst på siden, også ude af syne. Det der ses ved hvert svar, er "Rigtigt!", syv melkorn og nikket. | Forløb 1 tog 6 opgaver, forløb 2-4 4 opgaver hver. Et forkert svar i første runde koster en hel runde mere, fordi mestringen kræver 3 af 3. | Ganita (overvej at vise +10 eller en lille bar ved selve svaret) |
| M4 | Lille | Kortet ved trin 8 er tæt og skævt. Det nederste højre hjørne er fyldt med marker, gildestang, dansere, lygter, vogn, bageri, bro og ni figurer. Venstre halvdel er tom, og det låste Sporvognen-skilt dækker et træ. Det er charmerende på 390 px, men man skal lede. | `moelle-95-trin8.png` | Ganita |
| M5 | Lille | Kortet "Byen vågner" toner blødt ind (halvt gennemsigtigt ved 150 ms). Tallet tæller op og står fx på 13 af 19 efter 150 ms og på 19 efter 1,3 s. Melkornene fra det sidste svar lander hen over "Ny opgave" i 0,75 s. Det er kun et øjeblik, men det er lige der, eleven skal læse. | `moelle-1-b-mestret-som-set.png` | Ganita (valgfrit) |

## Det der virker (målt)

- **Fremskridt føles.** Efter hvert mestret forløb står kortet "Byen vågner" inde i skærmen uden at eleven skal rulle (top 462-613 px af 844 i alle fire tilfælde). Kortet viser hvad der vågnede, indbyggertallet der tæller op, den nye persons replik og den nye opgave, og prikken fyldes (1, 2, 3, 4 af 8). En blød ring pulserer om det nye på kortet. Replikkerne binder trinene sammen, fx bageren: "... broen over åen er rådden, så jeg kan ikke køre brødet ud." Næste trin er broen.
- **Dop ved hvert rigtigt svar:** 7 melkorn, "+10" flyver op til baren, og questgiveren nikker. Efter 1 s er alle melkornene væk, og intet skal klikkes væk.
- **Ikke Cookie Clicker.** 30 tryk på tallet, prikkerne og kortet ændrede intet (50 før, 50 efter; trin 4 før og efter). Gættemaskinen tog 16 opgaver med forkert svar først og stod bagefter stadig på trin 0 og "Forløb 1 af 8". Byen vågner kun af, at eleven kan det.
- **Fagligt uændret.** Hvert forløb gav et forkert svar et konkret hint om misforståelsen ("Hint 1 af 2: Flere dele betyder MINDRE dele ..."). Brøkdommeren roser et uforkortet svar og viser forkortningen ("6/9 kan også skrives 2/3"). Mestringsreglen er den gamle.
- **Stille som udgangspunkt.** Lyden er slået fra fra start, og der blev spillet 0 toner på hele turen. Med lyd til kom der 1 tone pr. rigtigt svar. Med `prefers-reduced-motion` står alt stille (0 kørende animationer), og det genopbyggede er stadig tegnet.
- 0 konsolfejl.

## Dom

**Klar til klassen: ja**, fordi det faglige er uændret, lyden er slået fra, intet vokser af at klikke eller gætte, og intet blinker hurtigere end ca. 1 gang i sekundet. Det M1 viser, er en svækkelse af oplevelsen og ikke en fejl, der skader undervisningen. Marc kan bruge det i morgen, men eleverne ser mest belønningen, hvis læreren siger "tryk på Se det på kortet".

**Ville Marc sige, at det er levende: ja, men han vil sige det om kortet ved trin 8 og om hjulet, der går i gang, ikke om det eleven ser mens der regnes; der er det stadig mest "Rigtigt!" og syv melkorn.**
