# Ordre 409, blok 1: eleven

Biblioteket og Lær skak set af en 10-årig, der kan reglerne, men aldrig har
trænet. Skak `main` e56842f (ordre 400 merget), kun læst via `git archive` til
en kopi. Headless Chrome, 390 x 844, touch, 2x.

Script: `node outputs/kritik-409/elev-409.mjs <skak-kopi>` → `outputs/kritik-409/E-*.png`
og `outputs/kritik-409/elev-409.json` (alle beskeder ordret, træk for træk).
"Kassen" i tårn mod konge: `outputs/kritik-409/kasse.mjs`. Ingen sidefejl i hele kørslen.

## Marcs tur (RAPPORT-400, "Hvad er næste")

| # | Hvad jeg gjorde | Hvad skete | Skærmbillede |
|---|---|---|---|
| 1 | Bibliotek | 7 kategorier, 18 "Træn"-knapper, alle med ☆☆☆☆☆. Siden er 3737 px høj (4,4 skærme). "Start her, hvis du er ny" står kun ved Lær skak. Ingen "næste anbefalede". | `E-01-oversigt.png`, `E-01b-oversigt-helside.png` |
| 2 | Dronningemat: Dg8 (ikke skak) | "Det var ikke skak. Mat er altid skak - hvor kan dronningen give skak? Prøv igen." Godt hint, passer til fejlen. | `E-03-damemat-forkert-1.png` |
| 2 | Dh8+ (skak, ikke mat) | "Det var ikke mat. Hvilke felter kan kongen flygte til? ... Pilen viser vejen." Pilen viser hele svaret (Dh1). | `E-04-damemat-forkert-2-pil.png` |
| 2 | Dh1# | "Løst! Skakmat! Men med fejl eller hint, så rækken starter forfra." Tre mere: ★☆☆☆☆ → ★★★☆☆. Klar og ærlig. | `E-05`, `E-06` |
| 3 | Dronning mod konge, perfekt spil | Mat i 6 træk, "Rigtigt! Skakmat i 6 træk! (1 af 3 i træk)". | `E-07` til `E-09` |
| 3 | Med vilje: dronningen ved siden af kongen | "Kongen slog din brik - nu kan ingen vinde ..." Rækken nulstilles. God. | `E-10-dronning-haengt.png` |
| 3 | Med vilje: patt | "Patt - kongen kunne ikke flytte, men stod ikke i skak. Det er uafgjort. Giv den altid et felt ..." God. | `E-11-dronning-patt-eller-mat.png` |
| 4 | Oppositionen: bonden frem (b3) | "Det træk giver kun uafgjort. Stil din konge over for ..." | `E-13` |
| 4 | Kc4, sort Kb6 | "Godt! Hans konge veg. Gå nu frem ved siden af ham - stadig med kongen." Men det rigtige træk er Kb4: SIDELÆNS, ikke frem. En 10-årig prøver Kc5 eller Kd5. | `E-14` |
| 4 | Kb4 | "Løst! Kongen står rigtigt - nu kommer bonden igennem." Bonden er stadig på b2; eleven ser aldrig at den kommer igennem. | `E-15` |
| 5 | Kapitlet "Rokade, en passant ..." | Lær skak åbner på trin 12, lang rokade godtages, "Rigtigt! ..." + **Videre ›**. Virker. | `E-16`, `E-17` |

## Frit: tre kompetencer en 10-årig selv ville vælge

- **Gaffel med springeren** (lyder sjovt). Én fejl med vilje i øvelse 4 (b8c7):
  "Det træk angreb ikke to ting ..." og rækken nulstilles. Sidder efter 9
  øvelser. Efter hvert rigtigt: "Rigtigt! Du vandt materiale." - samme linje hver
  gang, ingen ord om HVAD gaflen ramte. `E-18-gaffel-sidder.png`
- **Tårnmat**. "Vis et hint" i øvelse 2: "Hint: pilen viser trækket." Hintet ER
  svaret; der er intet mellemtrin (fx "giv skak langs kanten"). Sidder efter 7.
  Otte øvelser, alle mat i ét træk, fire af dem med kongerne over for hinanden
  og tårnet på samme måde. Efter fem kan man mønstret; det er kedeligt, men det
  er også pointen. `E-19`, `E-20`
- **Tårn mod konge** (den svære). Spillet som en elev der har lært "kassen"
  (skær af, gør kassen mindre, kongen hjælper, tårnet må ikke hænge), men kun
  kigger ét svar frem: tk1 mat i 18, tk2 i 12, **tk3 35 træk brugt**, **tk4 35
  træk brugt**, tk5 i 16, tk6 i 10. To gange nåede jeg "2 af 3 i træk", og så
  kom tk3/tk4 og "Stjernerne starter forfra". De seks stillinger går i ring,
  så en elev der har svært ved to af dem, skal spille mindst 7 partier (ca.
  150 egne træk + 0,55 s pause pr. svar). `E-21` til `E-23`

## Lær skak fra start til rokaden ("Jeg er ny")

| Trin | Hvad jeg gjorde | Hvad skete |
|---|---|---|
| 1 Brættet | d4 (forkert), e4 | "Prøv igen - klik det ringede felt.", så "Rigtigt! Det er e4 ..." God. |
| 2 Kongen | tryk på tomt felt, Ke4 | Intet ved det tomme felt (fint), "Rigtigt! Sådan går kongen." |
| 3 **Dronningen** | Dd4-h8 | **Stillingen er ulovlig**: sort konge på h8 står i skak fra Dd4 med hvid i træk. Dronningen SLÅR KONGEN, kongen forsvinder, og appen siger "Rigtigt! Sådan går dronningen." `E-33-laer-dronningen.png` |
| 4-7 Brikkerne | et træk hver, Lc1-c3 forsøgt | Ulovligt træk (løber lige frem) giver ingen besked; brikken bliver bare stående. Ok, men en 10-årig ved ikke hvorfor. |
| 8 Bonden slår | e5 (forkert), exd5 | "Et lovligt træk - men ikke det, opgaven beder om ..." God. |
| 9 Slag | Sf5 (forkert), Sxb5 | Som ovenfor. God. |
| 10 Skak og mat | Te7 (forkert), Te8# | "Rigtigt! Skakmat - partiet er vundet!" God. |
| 11 Svar på skak | Kd2 | "Rigtigt! Kongen er ude af skak." |
| 12 Rokade | Kf1 (forkert), lang rokade | Godtaget. Ringen står stadig på g1 (kort rokade), selv om den lange blev spillet. `E-38` |

To ting på tværs af trinnene:
- Efter hvert rigtigt træk skifter opgaveteksten (i DOM) fra "Du er hvid." til
  **"Du er sort."**, fordi den bygges ud fra hvem der er i træk. På skærmen
  dækkes den af "Rigtigt!"-linjen, men en skærmlæser og enhver visning der
  viser teksten igen, siger forkert farve ("Du er sort. Sæt den sorte konge mat").
- "Spring over", "Start forfra" og "Skift niveau" står stadig under brættet
  (L8 fra ordre 400, delvist rettet).

Uden for "start til rokade" fandt en maskinel gennemgang af alle 32 trin én
ulovlig stilling mere: **trin 23 "Princip: tårne på åbne linjer"** (`k7/8/8/8/8/8/1P6/R3K3 w`):
Ta1 giver skak til Ka8 langs a-linjen, og Txa8 slår kongen.

## Hvor går man i stå, hvor keder man sig

- **I stå:** oppositionen (hint2 siger "frem", svaret er sidelæns); tårn mod
  konge (tk3/tk4 med 35 træk, og rækken nulstilles ved 2 af 3); oversigten
  (18 ens knapper, ingen vej).
- **Keder sig:** tårnmat og dronningemat (8 x mat i ét, ens mønster); brik-
  trinnene i Lær skak (alt er rigtigt, ét træk og færdig); "Rigtigt! Du vandt
  materiale." som samme linje hver gang.
- **Uklart hint:** "Vis et hint" = pilen med svaret (ingen trappe: tekst først,
  så felt, så pil); oppositionens hint2.
- **Forkert øvelse:** Lær skak trin 3 og trin 23 (ulovlige stillinger). I
  biblioteket: se blok 2 (`docs/kritik-409/SKAKKEN.md`).
