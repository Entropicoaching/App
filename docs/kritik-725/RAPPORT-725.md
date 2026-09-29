Klar til klassen: ja, på computer, gåder, Lær skak og makker-parti uden ur; makker-parti med ur på en lav telefon er stadig besværligt. De tre ting Chaturanga retter næste gang: (1) urvalget i et makker-parti ligger 689 til 741 px nede på 360 x 560, og et tryk på "5+0" scroller siden, så brættet står -262 til 58 (uden for skærmen) (skærm: Spil, Mod en makker, ur 5+0, `360x560-A2-ur-5-0.png`; fil: `src/skak.template.html` `#segment-skakur`, `#spil-valg-fold`, samt mobil-CSS i `src/styles.css`); (2) med uret i gang står rækken Fortryd / Giv op 550-594 af 560, altså 34 px under kanten, fordi uret (500-544) ligger imellem (skærm: makker med ur efter to træk, `360x560-A3-efter-2-traek.png`; fil: `#ur-strimmel`, `#spil-strimmel`, `src/styles.css`); (3) Lær skak, første skærm på 360 x 560: de tre niveaukort fylder øverste halvdel, og brættet er kun 175 px synligt (385-665 af 560), så eleven ser ikke, hvad de skal øve (skærm: Lær skak, `360x560-30-laer.png`; fil: `#segment-laer-niveau` og `#fane-laer` i `src/skak.template.html`, `src/styles.css`).

Ordre 725, Bhishak, 29. sep. 2026. Skakken på `main` @ `9612da8` (710 og 719 er med). Set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk browserprofil, headless, syntetiske træk.

## Gren

`kritik-725`, lavet med `git checkout -b kritik-725 main` i `entropi-app-kritik`. Kun filer under `docs/kritik-725/` og `outputs/kritik-725/`. Skakken er hentet med `git archive main` til en midlertidig mappe og er ikke rørt. Ingen push, ingen merges, ingen sub-agenter.

- commit 1 (`03e97c67`): skærmbilleder og måletal (`maal-725.json`, `maal2-725.json`) i `outputs/kritik-725/` og tre måle-scripts i `docs/kritik-725/` (`elevtur-725.mjs`, `elevtur2-725.mjs`, `elevtur3-725.mjs`, genbrugt fra 718).
- commit 2: denne rapport.

## Hvad ændret

Intet i skakken. Dommen er skrevet ud fra det, der er committet på `main`.

**Kan en 11-årig komme i gang uden hjælp, og ser eleven altid brættet og det, der skal trykkes på?** Ja for det meste.
- Første skærm er Gåder med et bræt (280 px på 360 x 560, 374 på 390) og "Vis et hint" synligt uden at rulle (484-528 af 560).
- Et parti mod computeren: tryk e2, e4, computeren svarer e7-e5 og "Din tur". Brættet står 173-493 før og efter første træk på 360 x 560 (0 px hop), og rækken Fortryd / Hint / Giv op står 500-544, helt inde. På 390 x 844 står brættet 205-579 før og 224-598 efter første træk, så det hopper 19 px dér (rækken er inde, 605-649 af 844).
- Makker-parti uden ur: brættet 173-493 og Fortryd / Giv op 500-544, helt inde på 360 x 560.
- Gåde: et forkert træk giver "Ikke den vej. Tag trækket tilbage og prøv igen.", og rækken står 502-546 på 360 x 560 (inde) og 670-714 på 390.
- Lær skak, "Jeg er ny", trin 1: titel, en linje tekst ("Klik e4.") og en grøn ring på e4; brættet 207-487 på 360 x 560, 292-666 på 390, 210-709 på 1280.

**Hvad er stadig besværligt eller rodet på lav telefon (360 x 560)?**
- Makker med ur: se fund 1 og 2 i dommen. Urvalget er skjult i en fold ("Valg: ur 5+0") under rækken, og selve valget ligger under kanten; et barn, der åbner den og trykker, mister brættet af syne.
- Lær skak: "Vælg dit niveau" fylder øverste halvdel, og brættet er halvt under kanten første gang (fund 3). Man kan ikke tage fejl af, hvad man skal trykke på, men det ligner en rodet skærm.
- Gåder, Sort trækker: teksten "Sort trækker" står to gange (over brættet og i kortet med "Vi finder dit niveau"), og brættet er vendt (a-h fra højre). Uden fejl, men et barn kan tro, at det er en fejl.
- På 1280 x 800 starter Spil i "Mod en makker" (ingen startkort som på telefon). Et barn, der vil spille mod computeren, skal finde "Mod computeren" i sidepanelet. Uændret siden 718.

**Er mine seneste fund lukket?** (718 nævnte tre, 710 og 719 skulle lukke dem.)
- 718 nr. 1, "Giv op" i makker: lukket (710). "Giv op" står nu i rækken under brættet, 500-544 uden ur og 550-594 med ur (`#strimmel-giv-op`, synlig). Urvalget er ikke lukket (fund 1 ovenfor).
- 718 nr. 2, gåde-teksten på 360 x 560: lukket for den første fejltekst (502-546 af 560). Efter 719 er teksten "Ikke den vej. Løsningen er vist - tag trækket tilbage." ikke afprøvet igen af mig (se grænser).
- 718 nr. 3, brættet hopper ikke og rækken er inde: lukket på 360 x 560 (brættet 173-493 før og efter, rækken 500-544 af 560). På 390 x 844 hopper brættet 19 px (205 til 224), og 1280 x 800 er ikke målt for første træk i dette løb. 719 målte 390 x 664, hvor det ikke hopper; på 390 x 844, som de fleste telefoner har, er hoppet der endnu (kun ved højde over 700 px gælder reglen ikke).

## Testresultat

Ingen lint eller verify-scripts (jeg har ikke rørt kode). Målinger fra tre scripts, kørt mod `main` @ `9612da8` hentet med `git archive`. Ingen sidefejl i konsollen (`fejl []` på alle tre størrelser).

| Skærm | 360 x 560 | 390 x 844 | 1280 x 800 |
|---|---|---|---|
| Gåder, bræt | 198-478 | 290-664 | 237-774 |
| Spil mod computer, bræt før / efter 1. træk | 173-493 / 173-493 | 205-579 / 224-598 | 140-677 / 140-677 |
| Fortryd / Hint / Giv op (computer) | 500-544 | 605-649 | ikke målt |
| Makker med ur, Fortryd / Giv op | 550-594 (delvist ude) | 636-680 (inde) | ikke målt |
| Urvalg `#segment-skakur` | 689-741 (ude) | 775-827 (inde) | 430-478 (inde) |
| Brættet efter tryk på "5+0" | -262 til 58 (ude) | 205-579 (inde) | 140-677 (inde) |
| Gåde efter forkert træk, række | 502-546 | 670-714 | ikke målt |
| Lær skak trin 1, bræt | 207-487 | 292-666 | 210-709 |
| Lær skak, valgskærm, bræt | 385-665 | 425-799 | 246-744 |

Skærmbilleder: `outputs/kritik-725/` (`*-A2-ur-5-0.png`, `*-A3-efter-2-traek.png`, `*-30-laer.png`, `*-D1-gaade.png`, `*-B1-computer-traek.png` og flere, tre størrelser).

## Hvad er næste

Chaturanga (i denne rækkefølge):
1. Makker + ur på lav telefon: læg urvalget over eller lige under brættet (eller giv startkortet "Mod en makker" et ur-valg), og lad et tryk på "5+0" ikke scrolle brættet ud af syne.
2. Uret + Fortryd + Giv op i ét spor på 360 x 560 og 320 x 520, så alt er på skærmen med uret i gang (står allerede som nr. 3 på deres egen rangliste).
3. Lær skak på 360 x 560: gør niveaukortene kortere (én linje hver) eller vis brættet mindre under dem, så brættet er helt synligt fra første skærm.

Hvis det er tid bagefter: brættet hopper 19 px ved første træk på 390 x 844 (statuslinjen skifter fra én til to linjer; reglen fra 719 gælder kun op til 700 px højde), og "Sort trækker" står to gange i Gåder.

**Har arbejdet betydning for Hara** (Skole-planeten, skak-sporet): dommen "ja til klassen, men ikke med ur på en lav telefon" og de tre rester går til Duta.

## Ærlige grænser

- Kun tre størrelser, headless Chromium, touch som `tap()`, ikke en rigtig telefon. Ingen rigtige børn: "11-årig" er min vurdering af tydelighed, ikke en prøve.
- Ét makker-parti med to træk og ét ur-valg (5+0). Jeg lod ikke uret løbe ud og målte ikke uret i sidepanelet på 1280.
- Gåde: kun første forkerte træk er målt. Teksten "Ikke den vej. Løsningen er vist - tag trækket tilbage." (efter andet forkerte træk, rettet i 719) er ikke fremkaldt af mig, og på 1280 fandt scriptet intet lovligt mål, så der er ingen måling af forkert træk dér. Ingen gåde blev løst til ende.
- Lær skak: kun trin 1 fra "Jeg er ny". Trin 2 (e4) og de længste trin er ikke klikket igennem.
- På 1280 x 800 timede tryk på "Mod en makker" og "Mod computeren" ud i mine scripts (knapperne står i et sidepanel, som mine vælgere ikke ramte), så rækken Fortryd / Giv op, uret og forkert træk er ikke målt dér; nogle 1280-felter i `maal2-725.json` viser 0-0 (ikke fundet), ikke en fejl i skakken. Kun urvalget (430-478), Lær skak og brættet er målt på 1280.
- Ingen lint og ingen `verify:*`, da der ikke er ændret kode.
