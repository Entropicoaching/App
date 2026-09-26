# Kritik: Smuk skak (ORDRE 391), set som en elev på telefonen og på en skole-pc

Bhishak, ORDRE 392, blok 2. Kilde: skak `main` (`afbd125`, merge af `smuk-skak`), kun trukket ud med `git archive`. Intet er rettet.

**Sådan blev det set.** Headless Chromium på 390x844 (touch, 2x, tryk-tryk) og 1280x800 (mus), i en flygtig profil. Kommando: `node scripts/kritik-392.mjs --kun skak`. Billeder og tal ligger i `outputs/kritik-392/` (`skak-390-*.png`, `skak-1280-*.png` og `maalinger.json` under `skak`).

Turen var den samme i begge bredder:

1. Forsiden (Gåder) som den åbner.
2. To gåder. Eleven laver først et forkert træk og løser derefter gåden med hint-knappen eller selv, hvis der er mat i 1.
3. En pil med tegneværktøjet.
4. "Udseende": fire temaer og fem brikkesæt.
5. Spil mod en makker efter "Start forfra": 1.e4 e5 2.Dh5 Sc6 3.Dxf7+. Der tages et billede midt i et glid.
6. Lyd ved træk slået til, ét træk mere.
7. Lær skak, "Jeg spiller allerede", første træk e2-e4.

## Fund, vigtigst først

| # | Alvor | Fund | Målt | Til |
|---|---|---|---|---|
| S1 | Vigtigst (telefon) | **Første skærm på telefonen ligner et tegneprogram, ikke lichess.** Gåder er forsiden. Over brættet står tegneværktøjslinjen: Flyt, Pil, Ring, Viskelæder, tre farvecirkler og "Ryd tegning", 96 px høj i tunge piller. Under brættet står den fede sætning "Vil du tegne? Vælg Pil eller Ring over brættet." Brættet starter først 267 px nede. I Spil og Lær skak er linjen skjult, og der starter brættet ved 205-210 px og ser langt roligere ud. | `skak-390-01-forside.png` mod `skak-390-07-skak-efter-fem-traek.png`. `forside.vaerktoejslinje` = top 163, h 96 | Chaturanga (fold værktøjet bag én lille "Tegn"-knap på smal skærm, eller gør det lige så stille som knapperne under brættet) |
| S2 | Middel (telefon) | **En blågrå boks blinker hen over brikken ved hvert tryk på telefonen.** styles.css sætter ikke `-webkit-tap-highlight-color`, så Chromes standard (`rgba(51,181,229,0.4)`) ligger på felt og brik. Midt i et glid farver den springeren blågrøn og tegner en forskudt boks. En valgt brik ser snavset blågrøn ud. Det ses ikke med mus (1280: `rgba(0,0,0,0.18)` og intet tryk). lichess har det ikke. | `forside.tapHighlight` (390). `skak-390-06-midt-i-glid.png` og `skak-390-05-valgt-brik-lovlige-felter.png` mod `skak-1280-06-midt-i-glid.png` | Chaturanga (én CSS-linje: `.braet, .braet * { -webkit-tap-highlight-color: transparent; }`) |
| S3 | Middel (dårligere end før) | **Koordinaterne er blevet svage.** De tager nu det modsatte felts farve, og kontrasten er 2,29:1 på Træ, 2,84:1 på Grøn, 2,06:1 på Blå og 2,17:1 på Nat, ved 12,5 px og vægt 700. Det er lichess' valg, men lichess' brugere kender brættet. I Lær skak skal en begynder finde "e4" og "f7" ud fra netop de bogstaver. Rapport 391 nævner det selv som en grænse. | `temaer[*].kontraster` (begge bredder) | Chaturanga (fx mørkere koordinater i Lær skak, eller kontrast på mindst 3:1) |
| S4 | Lille | Nat er det svageste tema for sorte brikker: kontrasten mellem sort og mørkt felt er 4,13:1 (Træ 6,67, Grøn 6,27, Blå 7,89). Brikkerne kan stadig læses på 390, men Nat bør ikke være valget til en svag projektor. | `temaer[*].sortBrikMoerktFelt`. `skak-390-03-tema-nat.png` | Chaturanga (tekst i menuen, eller lysere mørke felter) |
| S5 | Lille | "Start forfra" i Spil beder om bekræftelse ("Det nuværende parti forsvinder") selv når partiet har 0 træk. | `spilForfraSpoerger` = true, med startstillingen på brættet. `skak-390-05b-start-forfra-spoerger.png` | Chaturanga |
| S6 | Lille (ikke fra 391) | Træklisten skriver engelsk notation ("2. Qh5 Nc6 3. Qxf7+"), mens Lær skak skriver dansk ("e4, Sf3, Lc4"). En elev møder to navne for den samme brik. | `skak-1280-07-skak-efter-fem-traek.png` | Chaturanga (senere) |

## Det der virker (målt)

- **Trækkene glider.** Hvert træk fik klassen `glider` med `transition` 0,18 s. Midt i trækket står brikken forskudt med en transform, fx +49 px for e2-e4 på 390, og billedet midt i glidet på 1280 er rent. Det føles som lichess, der bruger ca. 0,2 s.
- **Sidste træk ses tydeligt.** Fra- og til-felt (fx h5 og f7) er gulgrønne på alle seks træk, og i Lær skak ses modstanderens e7-e5 på samme måde.
- **Skak ses tydeligt.** Sort konge på e8 får en rød radial glød, og statuslinjen siger "Sort står i skak." (`skakFelt`).
- **Brikkerne er pæne og kan læses på telefonen.** Staunton (cburnett, lichess' standard) er standard. Brikken fylder 95-96 % af feltet, og feltet er 47 px på 390. Merida og Chessnut er lige så skarpe. Rammen er væk (`borderWidth 0px`), og der er kun en blød skygge.
- **Temaer og sæt kan skiftes med det samme** fra "Udseende", og valgene huskes. De fire temaer og fem sæt er alle set på begge bredder.
- **Tegneværktøjet er ikke blevet dårligere.** Pilen d2-d4 blev tegnet, og dens startpunkt ligger 0 px fra feltets midte på både 390 og 1280, også nu hvor rammen er væk.
- **Lyden er slået fra som standard:** 0 toner på fem træk. Med "Lyd ved træk" til kom der 1 tone på ét træk.
- Knapperne under brættet (Vend, Tavle, Tegnelag, Hvad sker der, Udseende) er nu stille tekstknapper, og ingen synlig knap er under 44 px. 0 konsolfejl.

## Sammenlignet ærligt med lichess

På 1280 i Spil er det tæt på. Klassiske brikker, brun træfarve, gulgrøn sidste træk, rød skak-glød, 0,18 s glid, stille koordinater, trækliste i sidepanelet: en lichess-bruger ville kende sig selv igen. Brættet er mindre (537 px i et vindue på 800), og overskrifterne med serif og den kursive statuslinje giver et andet, blødere præg. Det er et valg og ikke en fejl.

På telefonen er brættet lige så godt, men rammen om det er det ikke. Forsiden åbner med et tegneprogram over brættet (S1), hvert tryk efterlader en blågrå boks (S2), og under brættet står fem tekstknapper og en sætning om tegning. lichess på telefonen er et bræt, et par små ikoner og intet andet. Det er de ting, der får appen til at føles som et skoleværktøj og ikke som et spil.

**Kan konkurrere med lichess på udseende: delvist.** Selve brættet (brikker, farver, markeringer, glid, skak) kan nu stå ved siden af lichess. Det kan telefonens forside ikke, fordi tegneværktøjet og tap-boksen fylder mere end brættet. S1 og S2 er tilsammen et lille stykke arbejde og ville flytte dommen tæt på "ja".
