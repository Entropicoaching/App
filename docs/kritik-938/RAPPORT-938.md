Klar til klassen: ja (skak main 246f0ff, inkl. ordre 924 og 931). De tre vigtigste ting Chaturanga retter naeste gang: (1) skakuret i makker-partiet: tidsvalget "Intet 3+0 4+0 5+0 10+0 5+3 Frit" staar stadig fremme under uret, naar partiet er i gang, saa en elev kan skifte tid ved et uheld (skaerm: `outputs/kritik-938/360x560-M2-ur-efter-2-traek.png`; fil: `#segment-skakur` i `skak.html` / `src/spil.js`; skjul valget, naar foerste traek er spillet, eller lig det i "Valg"-folden); (2) Laer skak: braettet flytter sig stadig 13 px nedad paa 360 x 560 ved overgangen fra "Kongen" til "Dronningen" (242 -> 255; boksen er kun reserveret til det stoerste trin, der er set foer, ikke til det naeste; skaerm: `outputs/kritik-938/360x560-L-trin7.png`, maal: `outputs/kritik-938/laer-938.txt`; fil: `forudmaalBoksHoejde` i `src/laerskak.js`); (3) resultatkortet efter Giv op: "Nyt parti" staar stadig sidst (paa 1280 ligger det under Fortryd og Gennemse partiet), og paa 360 er det nu en fyldt knap, men stadig til hoejre for to mindre knapper (skaerm: `outputs/kritik-938/360x560-M3-giv-op-slut.png`, `1280x800-M3-giv-op-slut.png`; fil: `slut-nyt-parti` / `knap-spil-nyt-parti` i `skak.html`; saet "Nyt parti" foerst).

# Rapport 938: skakbraettet set med en 11-aarigs og en laerers oejne

Maalt paa `skak.html` fra `git archive main` (246f0ff) i en midlertidig mappe, headless Chromium (Playwright), frisk profil pr. scenarie, touch paa 360 x 560 og 390 x 844, mus paa 1280 x 800, kun syntetiske partier (e4/e5, d4/d5, giv op). Laest: Chaturangas to nyeste rapporter (RAPPORT-931 og 924, "Hvad aendret" og "Hvad er naeste"), `docs/MOD-LICHESS.md` og foerste linje af min kritik 932. Scripts: `docs/kritik-938/` (elevtur-938, laer-938, hint-938, pageerror-938). Maal og skaermbilleder: `outputs/kritik-938/`.

## 1. Kan en 11-aarig komme i gang uden hjaelp?

Ja. Braettet ses altid: paa 360 og 390 staar det lige under hovedet (top 147-270 px), paa 1280 til venstre med sidepanelet til hoejre (bredde 481-537 px). Paa foerste skaerm paa 360 x 560 staar "Vis et hint" og en stor "Spil et parti" under gaade-braettet (`360x560-E0-foerste.png`). Computer-parti: Spil, "Spil mod computeren", tryk e2 og e4, computeren svarer e7-e5 og status siger "Computeren spillede e7-e5. Din tur." (`A3`). Hint efter e4 e5 lyser b1 og siger "Hint: ingen fare lige nu. Kan hvids springer paa b1 komme i spil?" (`360x560-H1-hint-efter-e4.png`). Makker-parti med ur: uret staar over og under braettet (Hvid 5:00 / Sort 5:00), og Giv op spoerger foerst (`M2`, `M3`). Gaade: "Vis et hint" og "Spring over" staar i bunden af foerste skaerm (`G1`, `G2` efter rul). Laer skak: titel og tekst staar oven over braettet, og "Videre" staar stort (`360x560-L-trin3.png`). Jeg har ingen maaling af, hvor hurtigt en rigtig 11-aarig finder "Spil et parti"; det skal proeves paa en frisk telefon.

## 2. Hvad er stadig besvaerligt eller rodet paa lav telefon (360 x 560)

- **Uret:** tidsvalget (runde knapper, y ca. 490-540) staar stadig lige under uret og under braettet og uret i selve partiet, ogsaa efter to traek (`360x560-M2-ur-efter-2-traek.png`, `segment-skakur` synlig: true paa alle tre stoerrelser i `elevtur-938.txt`).
- **Laer skak hopper stadig lidt paa 360:** braettet staar paa 242 px i trin "Braettet" og "Kongen", men 255 px fra "Dronningen" (13 px nedad; to teksttrin har forskellig hoejde). Paa 390 og 1280 flytter braettet sig ikke i de tre trin, jeg naaede (335 / 255 px hele vejen). Bunden af braettet er 535 px af 560 paa 360, saa det er stadig helt inde i vinduet. Det er en forbedring fra 932 (12 px opad -> 13 px nedad, men kun en gang).
- **Laer skak, fejlbesked:** "Dertil kan dronningen ikke gaa. Dronningen gaar saa langt den vil - lige ud eller paa skraa." staar i staerk roed tekst (`L-trin7`); den er klar, men rigtig alarmerende for en elev, der proever sig frem.
- **Resultatkort efter Giv op** (`M3`): paa 360 staar Fortryd, Gennemse partiet og en fyldt "Nyt parti" i en raekke; "Nyt parti" er nu den tydelige knap (forbedring), men staar stadig sidst. Paa 1280 staar Fortryd og Gennemse partiet over "Nyt parti". "Tre steder hvor partiet vendte" blev ikke vist paa det korte parti (intet tomt rum set denne gang).
- **Hovedet** fylder 90 px paa 360 x 560, 134 px paa 390 x 844 og 48 px paa 1280 (uaendret siden 931, rangliste nr. 1, venter paa Marcs ja).
- **Gaade-siden er lang:** 2447 px paa 360, 2558 paa 390 (`elevtur-938.txt`, `sideH`), altsaa som i 932.
- **Een konsolfejl:** paa 360 x 560 kom een gang en sidefejl i konsollen (`Invalid regular expression: /[Ì€-Í¯]/g`, tegnene ser ud som en fejllaest kopi af `/[̀-ͯ]/g`, som ligger i `src/aabningslinjer.js` linje 60 som `.replace(/[̀-ͯ]/g, '')`). Jeg kunne ikke gentage den (`pageerror-938.mjs`, tre koersler uden fejl, og ikke paa 390 og 1280), saa den kan vaere en tilfaeldighed i min opsaetning. Men regexen staar med rigtige kombinationstegn i kilden; den boer skrives som `̀-ͯ`, saa den ikke kan laeses forkert.

## 3. Er mine seneste fund lukket? (932)

| 932-fund | Nu |
|---|---|
| 1. Ordre 924 kun paa gren (Laer skak-hop, hint sent) | **Lukket:** 924 og 931 er merget paa main (246f0ff). Laer skak-hoppet er mindre: 13 px en gang paa 360, 0 px paa 390 og 1280 i de tre trin jeg naaede (foer 12 / 2 / 18 px) |
| 2. Tidsvalget staar fremme midt i partiet | **Ikke lukket** (se ovenfor) |
| 3. Resultatkort: Nyt parti sidst + tom overskrift | **Delvist:** "Nyt parti" er nu en fyldt knap paa 360, men stadig sidst; tom overskrift ikke set paa det korte parti |

Ogsaa aabent fra tidligere (ikke mit at rette): hovedet paa en lav telefon og #29 "Kan ikke sammenlignes" venter paa Marcs ja.

## 4. Hvad jeg ikke kunne / ikke naaede

- Ingen rigtig telefon og ingen boern; headless Chromium og Playwrights `tap` som touch. Ingen maaling af trykfladernes stoerrelse under en finger.
- Laer skak: mit script kom kun gennem de tre foerste trin ("Braettet", "Kongen", "Dronningen"); paa Dronningen-trinnet sad scriptet fast, fordi det flyttede dronningen som en konge (jeg loeser kun stjernetrin med en brik i et skridt ad gangen). De 12 trin i ordren er derfor ikke naaet; hoppet er kun maalt i de tre trin.
- Kun niveau 1; ikke et helt parti til mat; ingen lyd; ingen gaade loest (kun hint set).
- 320 x 520 er ikke maalt denne gang (ordren nævner 360, 390 og 1280).

## 5. Hvad det betyder

Ingen betydning for Hara; intet skrevet til miljoevariabler, Supabase eller appens kode; ingen elev- eller atletdata. Til Dhruva/Marc: skakken kan tages i klassen nu. Til Chaturanga i raekkefoelge: (1) skjul tidsvalget, naar partiet er i gang; (2) reserver Laer skak-boksen efter det stoerste trin i hele kurset, ikke kun det set hidtil (13 px paa 360); (3) saet "Nyt parti" foerst paa resultatkortet, og skriv regexen i `src/aabningslinjer.js` med `̀-ͯ`.
