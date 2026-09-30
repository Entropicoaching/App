Klar til klassen: ja (skak main 6a3b399, inkl. ordre 919; med to forbehold). De tre vigtigste ting Chaturanga retter naeste gang: (1) faa ordre 924 ind paa main: den ligger kun paa grenen `ordre-924` (commit 83f8877, ikke merget), og uden den hopper braettet i Laer skak (360: top 235 -> 223 px fra "Braettet" til "Kongen", 1280: 251 -> 233) og hintet er tavst senere i partiet (skaerm: `outputs/kritik-932/360x560-C1-laer-ny.png`, maal i `outputs/kritik-932/laer-hop-932.txt`; fil: `holdBoksHoejde` i `src/laerskak.js` og `planHint` i `src/spilhint.js`); (2) skakuret i makker-partiet: tidsvalget "Intet 3+0 4+0 5+0 10+0 5+3 Frit" staar stadig fremme under uret midt i partiet, lige ved braettet, saa en elev kan skifte tid ved et uheld (skaerm: `outputs/kritik-932/360x560-A3-efter-2-traek.png` og `1280x800-U1-ur-efter-2-traek.png`; fil: `#segment-skakur` i `skak.html` / `src/spil.js`; skjul valget, naar foerste traek er spillet, eller lig det i "Valg"-folden); (3) efter Giv op staar "Fortryd" foerst og "Nyt parti" sidst i resultatkortet, og "Tre steder hvor partiet vendte" er en overskrift uden indhold, naar partiet er kort (skaerm: `outputs/kritik-932/1280x800-U3-giv-op-slut.png`; fil: `#knap-resultat-fortryd` og resultatkortet i `skak.html`; saet "Nyt parti" foerst og skjul den tomme overskrift).

# Rapport 932: skakbraettet set med en 11-aarigs og en laerers oejne

Maalt paa `skak.html` fra `git archive main` (6a3b399) i en midlertidig mappe, headless (Playwright), frisk profil pr. scenarie, kun syntetiske partier (e4/e5, d4/d5). Jeg har ogsaa koert en kopi af grenen `ordre-924` (83f8877, kun committede filer) for at se, hvad der venter. Skaermbilleder: `outputs/kritik-932/`. Scripts: `docs/kritik-932/` (elevtur-932, elevtur2-932, hint-932, spilparti-932, giv-op-1280-932; samt b924-udgaven af elevtur2). Laest: Chaturangas RAPPORT-924 og RAPPORT-919 ("Hvad aendret", "Hvad er naeste"; 924 ligger kun paa grenen), `docs/MOD-LICHESS.md` og foerste linje af min egen seneste skak-kritik (927: "nej").

## 1. Kan en 11-aarig komme i gang uden hjaelp?

Ja, nu. Braettet ses altid: paa 320, 360 og 390 (touch) staar det oppe under hovedet paa Spil, Gaader og Laer skak, og paa 1280 (mus) staar det til venstre med sidepanelet til hoejre. Min 927-bekymring var, at en ny elev lander paa Gaader uden vej til et parti. Det er lukket: paa foerste skaerm paa 360 x 560 staar "Vis et hint" og en stor "Spil et parti" (y 484-528, i vinduet), paa 320 y 468-512, paa 390 y 650-694 (`360x560-E0-foerste-skaerm.png`). Paa 1280 staar forklaringen "En gaade er en stilling, hvor der findes et bedste traek ... tryk paa Spil et parti" oeverst i sidepanelet (`1280x800-E0-foerste-skaerm.png`). Spil: to store valg, "Mod computeren" / "Mod en makker"; braet, Fortryd, Hint og Giv op er i vinduet paa 360 (knapper y 457-501, braet 147-451). Makker med ur: Hvid 5:00 og Sort 4:59 som to store felter ved siden af knapperne. Hint efter 1. e4 e5 mod computeren: "Hint: ingen fare lige nu. Kan hvids springer paa b1 komme i spil?" og feltet b1 faar en gul ring (`360x560-H1-hint-efter-e4.png`; ogsaa paa 1280). Laer skak fra "Jeg er ny": trin 1 siger tryk paa e4 med en ring paa braettet.

## 2. Hvad er stadig besvaerligt eller rodet paa lav telefon (360 x 560)

- **Uret:** tidsvalget er en raekke af runde knapper (y 488-540) lige under uret, ogsaa naar partiet er i gang (`360x560-A3-efter-2-traek.png`). Let at ramme ved et uheld.
- **Laer skak hopper:** 360: 235 -> 223 (12 px opad, naar teksten bliver kortere), 1280: 251 -> 233 (18 px), 390: 312 -> 314 (2 px). Braettet flytter sig under fingeren mellem trin 2 og 3.
- **Hovedet:** to raekker faner + "Undervisning" fylder ca. 100 px af 560, og paa 320 x 520 staar "Valg: ..." som en halvt skjult fold under braettet (fold y 461, vindue 520). Det er ranglistens nr. 1 og venter paa Marcs ja; det virker, men er tungt.
- **Gaade-siden er lang:** 2447 px paa 360, 2558 paa 390 (forklaring, Storm, statistik). Eleven behoever ikke rulle for at spille, men klassen skal rulle for at komme til alt andet paa siden.
- **Efter Giv op** (1280, makker): resultatkortet har Fortryd foerst og Nyt parti sidst, og "Tre steder hvor partiet vendte" er en overskrift over tomt rum, fordi partiet var for kort (`1280x800-U3-giv-op-slut.png`). Der er ET synligt Fortryd (`knap-resultat-fortryd`), saa dobbelt-Fortryd er ikke set.

## 3. Er mine seneste fund lukket? (927)

| 927-fund | Nu |
|---|---|
| 1. Ny elev lander paa Gaader uden vej til parti | **Lukket for forstaaelsen:** "Spil et parti" er paa foerste skaerm paa 320/360/390, forklaringen oeverst paa 1280. Landingsfanen er stadig Gaader (Marcs valg) |
| 2. Hint viser ingen brik efter e4 e5 | **Lukket** paa main (b1 lyser, 360 og 1280). Efter 924 ogsaa naar alle springere og loebere er ude (ikke gentestet i et langt parti) |
| 3. Laer skak-braettet hopper | **Ikke lukket paa main** (12 / 2 / 18 px). **Lukket paa grenen ordre-924:** 360: 235 -> 235, 390: 312 -> 314, 1280: 251 -> 251 i mit script |
| Giv op / slutskaerm paa 1280 (kunne ikke trykkes i 927) | **Set nu** (`knap-spil-giv-op`, `-bekraeft`): "Hvid gav op. Sort vinder." med Fortryd, Gennemse partiet, Nyt parti |

## 4. Hvad jeg ikke kunne / ikke naaede

- Ingen rigtig telefon og ingen born: headless Chromium, Playwrights `tap` som touch. Ingen maaling af trykfladernes stoerrelse under en finger.
- Ikke et helt parti til mat; kun niveau 1; ingen lyd.
- Grenen ordre-924 har uncommittede aendringer (`docs/MOD-LICHESS.md`, to skaermbilleder); jeg har kun set de committede filer og ikke koert testene.
- Laer skak er kun set gennem de foerste 8 trin ("Jeg er ny"), ikke hele kurset.

## 5. Hvad det betyder

Ingen betydning for Hara; intet skrevet til miljoevariabler, Supabase eller appens kode; ingen elev- eller atletdata. Til Dhruva/Marc: skakken kan tages i klassen paa main nu, men faa ordre 924 merget foerst (det er det eneste af mine fund, der ikke er lukket paa main), og proev en frisk telefon: aabn skak.html og se, om klassen finder "Spil et parti" (den staar nu paa foerste skaerm). Til Chaturanga: ret raekkefoelgen (1) 924 ind paa main, (2) tidsvalget vaek fra spillet, (3) resultatkortet efter Giv op; hovedet paa lav telefon og #29 venter stadig paa Marcs ja.
