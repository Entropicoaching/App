Ordre 664: to kritikker, matematikspillet efter Ganitas 658 og 660 ("mere MMORPG") og skakken efter Chaturangas 657 og 663. Bhishak, 28. sep. 2026.

**MMORPG-følelse: nej.** Den er halvvejs. Tallet vokser nu synligt, animeret og ærligt, og et almindeligt svar er stille igen efter 1 s. Men helten ser ens ud på niveau 2 og 3. Et svar giver tre "+10" tre steder, og heltens er det mindste. Kun 660's blok 1 er committet; blok 2 (helten bliver stærkere) er ikke.

**Gætteren når ikke de flotteste trin før den ærlige.** I spillets egen model når gætteren median niveau 1 efter 150 opgaver, og en elev, der regner, når niveau 19. De flotteste trin som udseende findes ikke committet endnu.

**Matematikken mindre rodet: ja,** men kun lidt siden 656. Kortet siger stadig tydeligt, hvad man skal, og Min helt er ryddet lidt (658). Opgavens spilsprog er uændret.

**Hoved/Hånd/Hjerte forståelig for en 11-årig: ja.** "Niveau op!" siger nu "Din figur er blevet klogere: Hoved er nu 3.", og det er den bedste forklaring i spillet.

**Skakken stadig klar til Marcs klasse: ja.** Slutkortet efter en temastorm er nu roligt (2 linjer med rekord mod 4, intet "(−0 s)"), og fanerne er 44 px. Startkortet viser stadig to rekorder.

## Gren

`kritik-664`, lavet med `git checkout -b kritik-664 main` fra `main` @ `f091a56` i `entropi-app-kritik`.

- `83447dc` kritik 664 blok 1: matematikspillet efter Ganitas 658 og 660
- commit 2: skakken, verificering og denne rapport. Hashen står i `git log`.

Der er kun filer under `docs/kritik-664/` og `outputs/kritik-664/`. Ingen push, ingen merges, ingen sub-agenter.

Kilderne er hentet med `git archive`, og begge træer er ikke rørt:
- matematik `de17445` (643), `04d25b3` (658) og `f78f354` (660 blok 1)
- skak `85a4236` (657) og `66bbcaf` (663)

Disse rapporter er læst:
- Ganitas `outputs/RAPPORT-658.md` fra `main`.
- `RAPPORT-660.md` findes ikke: 660 er ikke merget, og kun blok 1 er committet på `ordre-660`. Blok 2 og 3 ligger ucommittet i Ganitas træ og er ikke vurderet.
- Chaturangas `outputs/RAPPORT-657.md` fra `main` og `outputs/RAPPORT-663.md` fra `ordre-663`. 663 er ikke merget.

## Hvad ændret

Kun mine dokumenter og scripts; ingen matematik, app eller skak.

### Blok 1: matematikken (`MATEMATIK.md`)

- **Hvad der virker (660 blok 1):**
  - "Din opgave nu" tager nu helten med på skærmen, 50 px fra toppen og med alle svar synlige. Før (658 på 390) stod helten 28 px over kanten.
  - Et rigtigt svar får "+1 ... +10" til at stige op fra helten.
  - Et nyt niveau fylder prikkerne og sender en ring ud fra helten, sammen med banneret "Niveau op! Niveau 3 · Lærling".
  - Et gæt giver "+5", et forkert tryk kun et lille skub og intet tal.
  - Efter 1 s står intet tilbage. Det er ikke Cookie Clicker.
- **Hvorfor alligevel "nej" til MMORPG-følelsen:**
  - Helten ser ens ud på niveau 2 og 3 (G12).
  - Væksten står tre steder på én gang (G9).
  - Nyt niveau sætter 36 til 55 ting i bevægelse. Flyderen øverst tæller "Niveau 2 +1", mens banneret lige under siger "Niveau 3" (G10).
- **Skærmene efter 643:**
  - Kortet: 53 til 49 ord på 390.
  - Min helt: 3,02 til 2,89 skærme, 331 til 319 ord.
  - Opgaven: uændret.
  - Ingen skærm er blevet mere rodet af 660.
- **De tre vigtigste ting, der stadig er rodede:**
  1. Væksten har ikke ét sted (G9, G10).
  2. Helten bliver ikke synligt stærkere (G12, 660 blok 2).
  3. Opgavens spilsprog og Min helts seks slags tal (G7, G4-rest).
- Marc foran klassen: pænt og roligt. Intet at skamme sig over, men "helten bliver stærkere" kan ikke vises endnu.

### Blok 2: skakken (`SKAK.md`)

- **Hvad der virker (657 og 663):**
  - Temalinjen står på én linje på 360, 390 og 1280.
  - Slutkortet efter en Gafler-storm med 0 fejl: 62 til 40 ord, 13 til 7 tal, 4 til 2 linjer med rekord, intet "(−0 s)".
  - Med 1 fejl og ingen rekord: 81 til 64 ord, 1 linje med rekord, roligt og ærligt.
  - Fanerne er 44 px, og ingen knap på første skærm i Gåder og Spil er under 44 px på 360 og 390.
- **Det, der stadig er rodet:**
  1. S17 (ny, middel): startkortet med Gafler valgt viser "Din rekord på denne enhed: 20" (fed) over "rekord 4".
  2. S15 og S16: søjlerne uden navn, datoen "(28/9)" og " - ".
  3. S18 og S19: "Gafler"/"Gaffel" på samme kort, og brættet i Spil på 360 × 740 står 24 px under kanten.
- S20 (lav): et tryk præcis i de 2 px mellem fanerækkerne rammer ingen fane i headless.
- Marc foran klassen på 1280: roligt, "Dagens storm" er brun og tydelig. Intet at skamme sig over.

## Testresultat

| Kørsel | Resultat |
|---|---|
| `node outputs/kritik-664/mat-664.mjs` | 643, 658 og 660 på 390 og 1280: gemt spil, ny elev og fire forløb med bevægelse. Spillets gætter-model på 200 frø. 0 net, 0 JS-fejl. `mat-664.json` og 46 billeder `M664-*.png` |
| `node outputs/kritik-664/skak-664.mjs` | 657 og 663 på 360, 360 × 640, 390 og 1280: fanerne, brættet i Gåder og Spil, startkortet og to Gafler-stormer spillet med tryk (0 fejl og 1 fejl). 0 net, 0 JS-fejl. `skak-664.json` og 28 billeder `S664-*.png` |
| `node outputs/kritik-664/verify-664.mjs --blok 1` | GROEN (før commit 1) |
| `node outputs/kritik-664/verify-664.mjs --blok 2` | GROEN (før commit 2). Tjekker grenen, at kun egne mapper er rørt, ingen upstream, ASCII, begge JSON, de tre dokumenter og rapporten |
| `npm run lint` | grøn |

Ingen andre `verify:*` er kørt, fordi ingen appkode er rørt. Første måling af "Niveau op!" var forkert: mit script lukkede selv banneret, før det blev målt. Det er rettet, og alle tal i dokumenterne er fra den sidste kørsel.

## Hvad er næste

**Ganita** (matematik):
1. 660 blok 2: helten skal synligt ændre sig med niveau. Det er det, der mangler for et "ja" til MMORPG-følelsen. Mål gætteren mod den ærlige på selve udseendet.
2. G9: ét "+N" ad gangen, og det skal komme fra helten. "+10 Brøker" og "+10" ved baren kan vente, til helten har talt, eller være stille.
3. G10: ved nyt niveau skal banneret være det eneste, der bevæger sig. Flyderen øverst skal enten vente, til banneret er lukket, eller vise "Niveau 3" fra starten.
4. G7 (opgavens spilsprog) og G4-resten (Min helts "Øv her"-sætning), når 660 er merget.
5. G2 er stadig **Marcs** valg.

**Chaturanga** (skak):
1. S17: startkortet med et tema valgt skal kun vise temaets linje. "Din rekord på denne enhed" skal kun stå under Blandet, som 663 skrev.
2. S15 og S16: "Dine sidste stormer" over søjlerne, "Dagens storm" uden datoen og ingen " - ".
3. S19 (Spil på 360 × 740) og S18 ("Gafler"/"Gaffel") når han alligevel er i teksterne.

**Marc:** begge kan vises frem. Skakken er rolig. Matematikken er rolig ved det almindelige svar og ærlig. Men lov ikke klassen, at helten bliver stærkere, før 660 blok 2 er merget.

**Til Hara:** School-planeten, spor matematik-minispil.
- 658 og 660 blok 1 har gjort væksten synlig og ærlig: gætteren median niveau 1 mod 19 for en elev, der regner, og roligt efter 1 s. Men det føles ikke som et MMORPG endnu: helten ændrer sig ikke, og væksten står tre steder.
- Matematikken er lidt mindre rodet, og Hoved/Hånd/Hjerte er forståelig.
- Skakken er stadig klar til klassen, med et roligere slutkort (663).

## Ærlige grænser

- **Ingen rigtig 11- eller 12-årig, klasse eller projektor har set noget af det.** Tallene er målt: ord, tal, knapper, px, animationer i gang og modellens niveauer. "Føles som et MMORPG", "roligt" og "skamme sig" er mit skøn ud fra skærmbillederne.
- **660 er kun blok 1, og 663 er ikke merget.** Dommen om MMORPG kan ændre sig, når 660 blok 2 er committet.
- **Ting i bevægelse svinger med timingen.** Ved nyt niveau i 660 var det 55 på 390 og 36 på 1280 i samme kørsel. Tallet siger, at der sker meget, ikke præcist hvor meget.
- **Gætteren mod den ærlige er målt i spillets model**, ikke i browseren. I browseren er kun "+10" mod "+5" set.
- Matematik: ét gemt spil (niveau 2, Møllen) og ét forløb.
- Skak: én temastorm (Gafler) med et syntetisk lager, der ikke hænger helt sammen.
- Touch er emuleret i headless Chromium på Windows. Det er ikke en rigtig telefon, Safari eller skole-pc.
