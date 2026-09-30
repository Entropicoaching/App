Klar til klassen: nej (skak main ff682c5, inkl. ordre 919). De tre vigtigste ting Chaturanga retter naeste gang: (1) en ny elev lander stadig paa GAADER, og forklaringen af hvad en gaade er staar ca. 1100 px nede paa siden; foerste skaerm paa 360 x 560 og 390 er "Find det bedste traek", "Sort traekker", "Niveau: 0 af 10", "Storm" og "Vis et hint", og knappen "Spil et parti" er ikke at se (skaerm: `outputs/kritik-927/360x560-E0-foerste-skaerm.png` og hele siden `360x560-G1b-gaader-side.png`; fil: opstartsfanen i `src/main.js` / `skiftFane(...)` og forklaringen `#gaade-forklaring` + `#gaade-strimmel-spil` i `skak.html`; aabn paa Spil eller Laer skak foerste gang, eller saet forklaring og en stor "Spil et parti" oeverst paa gaade-siden); (2) hintet viser stadig ingen brik: efter 1. e4 e5 mod computeren staar der "Ingen fare lige nu, spil dit plan." og intet felt eller ingen brik lyser (de gule felter er kun sidste traek) (skaerm: `outputs/kritik-927/360x560-H1-hint-efter-e4.png` og `1280x800-B3-hint-e4.png`; fil: hint-teksten og markeringen i `src/spil.js` og `src/styles.css`; marker altid en brik og et maalfelt, ogsaa naar der ikke er fare, fx udviklingstraek eller central bonde); (3) "Laer skak": braettet hopper stadig mellem trin, fordi teksten over det skifter laengde (360: top 235 -> 223 px fra "Braettet" til "Kongen", 1280: 251 -> 233; 390: 312 -> 314) (skaerm: `outputs/kritik-927/360x560-C1-laer-ny.png` og `360x560-L2-laer-senere.png`; fil: `#laer-tekst` / `#laer-trin-oeverst` i `src/laer.js` og `src/styles.css`; giv teksten en fast min-hoejde paa to-tre linjer, saa braettet staar stille).

# Rapport 927: skakbraettet set med en 11-aarigs og en laerers oejne

Maalt paa `skak.html` fra `git archive main` (ff682c5) i en midlertidig mappe, headless (Playwright), frisk profil pr. scenarie, kun syntetiske partier (e4/e5, d4/d5). Skaermbilleder: `outputs/kritik-927/`. Scripts: `docs/kritik-927/elevtur-927.mjs`, `elevtur2-927.mjs`, `hint-927.mjs`. Laest: Chaturangas RAPPORT-914 og RAPPORT-911 ("Hvad aendret", "Hvad er naeste"), `docs/MOD-LICHESS.md` (ranglisten efter 914) og foerste linje af min egen seneste skak-kritik (922, der laeste main efter 914). Ordre 919 har ingen RAPPORT-fil i `outputs/`; jeg har vurderet dens to commits (fe06f63, ff682c5) direkte.

## 1. Kan en 11-aarig komme i gang uden hjaelp?

Delvist. Naar eleven staar paa Spil, ja: to store valg ("Mod computeren" / "Mod en makker"), og braettet ligger i vinduet paa 360 x 560 (top 147, bund 451) med Fortryd / Hint / Giv op lige under (y 457-501, i vinduet) og skakuret som to store felter (Hvid 5:00 / Sort 5:00) i makker-partiet. Paa 1280 x 800 ligger braettet 481 px stort med knapperne i sidepanelet. Problemet er indgangen: en frisk profil aabner paa Gaader paa alle tre stoerrelser (360, 390, 1280). Paa telefon staar der "Find det bedste traek" og et braet med en stilling, hvor man er sort; forklaringen "En gaade er en stilling, hvor der findes et bedste traek ... tryk paa Spil et parti" (ordre 919) staar nederst paa en 2379 px lang side, og strimlen under braettet viser kun "Vis et hint" i vinduet. En 11-aarig, der vil spille skak, skal selv gaette at trykke paa fanen "Spil". Laer skak fra "Jeg er ny" er bedre: trin 1 siger "Klik e4" og en groen ring viser feltet paa braettet. Braettet ses altid paa Spil, Gaader og Laer skak paa 360, 390 og 1280.

## 2. Hvad er stadig besvaerligt eller rodet paa lav telefon (360 x 560)

- Braettet er 304 px (top 147) og kun ca. 30 px luft bliver under knapperne i et parti: paa 320 x 520 er hovedet (to raekker faner + "Undervisning") ca. 100 px af 520, og "Valg: ..." staar som en halvt skjult fold nederst. Det virker, men er tungt (ranglistens nr. 1, kraever Marcs ja).
- Uret i makker-partiet: "5+0"-valgene ligger som en raekke af runde knapper lige under uret og staar stadig fremme midt i partiet (skaerm `360x560-A3-efter-2-traek.png`); en elev kan komme til at aendre tiden ved et uheld.
- Felt-koordinaterne ligger tættere paa brikkerne end paa 1280: "8" og "1" paa a-linjen er flyttet vaek fra taarnene (919), men bogstavet "a" nederst til hoejre og cifrene i gaade-braettet (fx "3", "4", "5" paa a-linjen) skyder sig stadig ind i brikkens kant paa 360 (`360x560-D1-gaade.png`).
- Hintet siger "Ingen fare lige nu, spil dit plan." uden at vise noget (se dommen, punkt 2). For en 11-aarig er det en blindgyde.
- Gaade-siden er 2379 px lang paa 360 (Storm-kortet, forklaring, fire folder, statistik foer man kommer til "Vis et hint / Spring over" ved y ca. 1950).

## 3. Er mine seneste fund lukket? (922)

| 922-fund | Nu |
|---|---|
| 1. Ny elev lander paa Gaader uden forklaring/vej til parti | **Delvist.** Forklaringen og en "Spil et parti"-knap findes nu (919), men landingsfanen er den samme og forklaringen staar langt nede; ikke set i foerste skaerm |
| 2. Hint viser ingen brik | **Ikke lukket** i de stillinger jeg proevede (1. d4 d5 og 1. e4 e5 mod niveau 1). 919 rettede kun hintet "paa startraekken" (springer/loeber); efter 1. e4 e5 sker der intet |
| 3. Koordinater oven i taarnene | **Lukket for 8/1 paa a-linjen** (919); resten (bogstavet "a", cifrene paa gaade-braettet) er kosmetisk |
| 908-fund "Laer skak: braettet hopper 12-20 px" | **Ikke lukket** (360: 12 px, 1280: 18 px). Staar som nr. 3 paa Chaturangas egen liste |
| 911/914: kun een Fortryd efter Giv op; 1280-braet 481 px | Ikke gentestet i dybden; Giv op paa 1280 kunne mit script ikke trykke (knappen sidder i sidepanelet under et andet id), saa jeg vurderer det ikke |

## 4. Hvad jeg ikke kunne / ikke naaede

- Hint-knappen og Giv op paa 1280: scriptets `#strimmel-*`-id'er findes kun paa telefon; hint paa 1280 er testet med `#knap-spil-hint` i `hint-927.mjs` (samme resultat), men Giv op og slut-skaermen paa 1280 er ikke set i denne runde.
- Ingen rigtig touch-maaling af trykflader (kun Playwrights `tap`); ingen lyd; kun niveau 1; ikke et helt parti til mat.
- Ordre 919 har ingen rapport, saa jeg kunne ikke laese dens "Hvad er naeste".

## 5. Hvad det betyder

Ingen betydning for Hara; intet skrevet til miljoevariabler, Supabase eller appens kode; ingen elev- eller atletdata. Til Chaturanga: ret rækkefoelgen (1) landingsfane/forklaring, (2) hintet, (3) Laer skak-hoppet; det andet paa ranglisten (hovedet paa lav telefon og #29) venter stadig paa Marcs ja. Marc/laereren boer selv proeve en frisk telefon: aabn skak.html foerste gang og se, om klassen finder "Spil".
