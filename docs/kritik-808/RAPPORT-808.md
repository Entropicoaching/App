Klar til klassen: ja, paa telefon og computer (main, 5713ab0, ordre 801 merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) efter Giv op i et laengere parti staar "Vil du se, hvad du kunne have gjort?" som en overskrift med tomt rum under sig (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-808/360x560-L2b-giv-op-langt-hel.png`; fil: `src/partitalui.js` og `src/spil.js`; vis spoergsmaalet kun naar der er noget at svare med, eller skriv "Ingen fejl fundet i aabningen") og kortet siger "Du tabte mod niveau 1" over tallene "100 % noejagtighed, 0 fejl" (skaerm: samme billede; fil: samme; skriv "Du gav op" i stedet for "Du tabte"); (2) skakur-valget ligger under kanten paa 360 x 560 (620-672 mod vindue 560): en 11-aarig skal aabne "Valg: ur 5+0" for at finde det (skaerm: Spil, Mod en makker, `360x560-A1-makker-efter-valg.png`; fil: `src/skak.template.html`, folden `#spil-valg-fold`; giv folden navnet "Skakur og valg" og aaben som standard i makker-parti); (3) hovedet fylder 148 px af 560 paa 360 x 560, altsaa over en fjerdedel, foer braettet begynder (skaerm: alle `360x560-*.png`; fil: `src/skak.template.html` og `src/styles.css`, to raekker faner; kraever Marcs ja til nye navne, som i 795 og 801).

## Gren

`kritik-808` fra `main`. Skakken hentet med `git archive main` fra `C:\Users\Entropi\Desktop\skak` (5713ab0) til en midlertidig mappe og koert derfra headless (Playwright, touch paa 360 x 560 og 390 x 844, mus paa 1280 x 800). Scripts: `docs/kritik-808/elevtur-808.mjs` og `laengere-808.mjs`; udskrifter og 39 filer i `outputs/kritik-808/`. Kun syntetiske data, skakken er ikke aendret.

## Hvad ændret

Intet i skakken (min rolle). Siden 802 har Chaturanga merget 795 og 801. Jeg har maalt det paa main:
- Forhaandstraek er fra som standard paa alle tre stoerrelser (802 fund 3 lukket; set i `360x560-L0-spil-start.png` og de andre).
- Efter Giv op staar der kun eet saet knapper paa 360 (Gennemse partiet, Nyt parti, Proev niveau 1 igen ved 455-530) og paa 390 (686-730); Vend braettet og de andre valg venter (802 fund 2 lukket).
- Efter et helt kort parti (e4, Giv op) er foldens overskrift rettet (801). Et laengere parti er nyt her og viser en ny fejl, se naeste afsnit.

## Hvad der ikke holder

1. **Giv op efter fire traek pr. side.** Overskriften "Vil du se, hvad du kunne have gjort?" staar paa 595-655 paa 360 (under kanten 560), og selv naar man ruller derned, staar der kun et tomt rum under den, foer stillingsgrafen og "Philidors forsvar". Kortet siger "Du tabte mod niveau 1. Det kommer. Proev igen." samtidig med "Noejagtighed 100 % / 98 %, 0 fejl". Et barn faar to signaler, der ikke passer sammen: jeg tabte, men gjorde ingen fejl? Paa 1280 staar spoergsmaalet med svaret "Motoren fandt intet enkel..." lige ved siden af braettet (508-574), saa computeren er fin; det er telefonen, der halter.
2. **Skakur paa lav telefon.** `#segment-skakur` ligger 620-672 paa 360 x 560; paa 390 x 844 ligger det 771-823 og er synligt. Folden "Valg: ur 5+0" er synlig ved 506-550, men navnet siger ikke, at det er her man vaelger tid.
3. **Hoved og faner.** Paa 360 x 560 begynder braettet ved 148 px; statuslinjen ligger ved 101-144. Med `#strimmel-*` knapperne ved 459-503 er der intet spildt under braettet, saa det er hovedet, der er dyrt. Paa 390 x 844 er det uden betydning.
4. **Smaat:** paa 1280 ligger "Giv op" nederst i panelet (758 af 800), og Kongebondeparti-navnet med "Hvad spiller man her?" ligger under braettet (709+); begge er naaet med mus uden problemer.

## Hvad der holder

- **Komme i gang uden hjaelp: ja.** Spil, Mod computeren, tryk e2 og e4: computeren svarer inden 2,5 s i alle tre stoerrelser og statuslinjen siger "Computeren spillede h7-h6. Din tur." Braettet ligger 148-452 (360), 228-602 (390) og 140-677 (1280), og tommelknapperne Fortryd/Hint/Giv op (459-503 paa 360) er altid i foerste skaerm. Ingen sidescroll paa nogen stoerrelse.
- **Makker-parti med ur:** Vaelg 5+0 (paa 1280 ligger valget i panelet), to traek, og uret Hvid/Sort staar under braettet paa telefon og til hoejre paa computer, med "Hvid traekker." over braettet (`360x560-A3`, `1280x800-A3`).
- **Gaade:** braettet 198-478 paa 360 med "Find det bedste traek." og "Vis et hint" under (484-528); sort nederst er vendt rigtigt, og der staar "Sort traekker". 
- **Laer skak, Jeg er ny:** "Trin 1 af 32, Braettet: Klik e4" med en groen ring paa e4 (`360x560-C1-laer-ny.png`); braettet er hele vejen synligt (207-487), teksten er kort og siger hvad man skal trykke paa.
- **Er mine seneste fund lukket?** 802 fund 1 (kort parti) og 2 (dobbelte knapper) og 3 (forhaandstraek): ja, alle tre. 802's hint og ur-valg var ikke fejl.

## Ærlige grænser

Headless Chromium, ingen rigtig telefon, ingen boern; jeg har spillet som et boern ville, men ikke set et boern. Makker-partiet er kun spillet to traek, og uret er ikke koert ned. Gaaden er set, men ikke loest; lektionen er kun proevet paa trin 1 (32 trin findes). Paa 1280 traf mit script "Giv op" og "Hint" med de telefon-vaelgere `#strimmel-*` (skjult paa computer), saa de kom ikke med i makker-touren; Giv op paa computer er set i `laengere-808.mjs` (`1280x800-L2`). Kun Giv op i eet laengere parti (fire traek pr. side) er maalt; matt eller remis i et laengere parti er ikke spillet. Computer-svartider er maalt med 2,2 s ventetid, ikke stopur.

## Hvad er næste

Chaturanga: de tre ting i dommen. Har det betydning for Hara? Nej, intet Hara-relevant er aendret eller skrevet. Bhishak boer proeve naeste gang: et parti spillet til mat paa 360 x 560, Giv op efter otte traek, og Lær skak trin 2-6 (Kongen og forbi).
