Klar til klassen: ja, på computer, gåder og Lær skak; men makker-partiet med ur på en telefon er stadig besværligt. De tre ting Chaturanga retter næste gang: (1) Skakurets valg i et makker-parti ligger 701 til 753 px nede på 360 x 560, og et tryk på "5+0" flytter siden, så brættet ryger ud af syne (brættet -136 til 208), og "Giv op" findes ikke i rækken under brættet i et makker-parti på telefon (skærm: Spil, Mod en makker, ur valgt; fil: `src/skak.template.html` `#segment-skakur`, `#spil-valg-fold`, `#strimmel-giv-op`, samt mobil-CSS i `src/styles.css`); (2) Gåder på 360 x 560 efter et forkert træk med teksten "Ikke den vej. Løsningen er vist på brættet ..." (tre linjer): rækken "Vis et hint / Tag trækket tilbage" står 522-566 af 560, altså 6 px under kanten (skærm: Gåder efter forkert træk; fil: `src/skak.template.html` `#gaade-tur-tekst`, `#gaade-strimmel`, `src/styles.css`); (3) Spil mod computeren: det første træk flytter brættet 19 px ned (161 til 180 på 360 x 560, 205 til 224 på 390), fordi statuslinjen bliver to linjer ("Computeren spillede e7-e5. Din tur."), og rækken Fortryd / Hint / Giv op ender 531-575 af 560, 15 px under kanten (skærm: Spil mod computeren efter første træk; fil: `src/skak.template.html` `#status`, `#spil-strimmel`, `src/styles.css`).

Ordre 718, Bhishak, 29. sep. 2026. Skakken på `main` @ `7165ca0` (706 og 707 er med). Set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk browserprofil, headless, syntetiske træk.

## Gren

`kritik-718`, lavet med `git checkout -b kritik-718 main` i `entropi-app-kritik`. Kun filer under `docs/kritik-718/` og `outputs/kritik-718/`. Skakken er hentet med `git archive main` til en midlertidig mappe og er ikke rørt. Ingen push, ingen merges, ingen sub-agenter.

- commit 1 (`2f06a7ba`): 65 filer i `outputs/kritik-718/` (skærmbilleder og måletal `maal-718.json`, `maal2-718.json`) og tre scripts i `docs/kritik-718/` (`elevtur-718.mjs`, `elevtur2-718.mjs`, `elevtur3-718.mjs`).
- commit 2: denne rapport.

## Hvad ændret

Intet i skakken. Dommen er skrevet ud fra det, der er committet på `main`.

**Kan en 11-årig komme i gang uden hjælp, og ser eleven brættet og det, der skal trykkes på?** Ja for det meste.
- Første skærm er Gåder med et bræt (280 px på 360 x 560) og "Vis et hint" synligt uden at rulle. Spil-fanen viser "Mod computeren / Mod en makker" over et helt bræt (340 px), og efter et valg er brættet det, man ser (161-505 af 560).
- Et parti mod computeren: tryk e2, e4, computeren svarer e7-e5 og "Din tur". Uden fejl, brættet er hele tiden i vinduet på alle tre størrelser.
- Lær skak, "Jeg er ny": trin 1 viser titel, en linje tekst og en grøn ring på e4; brættet 207-487 på 360 x 560, 292-666 på 390, 210-709 på 1280. Uden hjælp at følge.
- Gåde: et forkert træk giver "Ikke den vej ..." og viser løsningen; "Tag trækket tilbage" er den store knap.

**Hvad er stadig besværligt eller rodet på lav telefon (360 x 560)?**
- Makker med ur (fund 1): "Farve, niveau og ur" er en fold lige under brættet (558-602, halvt uden for skærmen), og selve urvalget ligger 701-753. Et tryk på "5+0" scroller siden, så brættet er 344 px højt men står -136 til 208 (uden for skærmen). Uret (Hvid 5:00 / Sort 5:00) står 511-555 lige under brættet, men Fortryd-rækken 562-606 er uden for skærmen. På 390 x 844 er alt inde i vinduet, så det er en lav-telefon-ting.
- "Giv op" er skjult (display none) i rækken under brættet i et makker-parti på 360 og 390; i et computer-parti er den der. Uden Giv op må eleverne trække sig ved at trykke "Start forfra" eller lade uret løbe ud.
- Computer-parti (fund 3): rækken under brættet er halvt uden for skærmen efter første træk (531-575 af 560), og brættet hopper 19 px, når statuslinjen skifter fra én til to linjer. Et barn, der trykker på felt e4, kan komme til at trykke på et andet felt, hvis siden skifter under fingeren.
- Gåde efter forkert træk (fund 2): 6 px under kanten, se dommen.
- Lær skak, første skærm på 360 x 560: "Vælg dit niveau" fylder hele skærmen, og brættet er kun 175 px synligt under valgkortene (385-665). Man kan ikke tage fejl af, hvad der skal trykkes, men det ligner en rodet skærm første gang.
- På 1280 x 800 starter Spil i "Mod en makker" (ingen startkort som på telefon), så et barn, der vil spille mod computeren, skal finde "Mod computeren" i sidepanelet. Ikke en fejl, men uens med telefonen.

**Er mine seneste fund lukket?** (704 nævnte tre, 706 og 707 skulle lukke dem.)
- 704 nr. 1, Spil-valgene under brættet: lukket for computer-partiet (folden står lige under brættet, 558-602 på 360). Urvalget i et makker-parti er ikke lukket (fund 1 ovenfor).
- 704 nr. 2, Gåder på 360 x 560: lukket for den normale skærm (bræt 280 px, række 484-528). Ikke lukket for teksten "Ikke den vej. Løsningen er vist ..." (522-566, 6 px under kanten). 707 målte den længste fejltekst med en anden ordlyd og fik 496-540.
- 704 nr. 3, Lær skak på 1280: trin 1 er helt synligt (210-709 af 800). Jeg gik ikke videre til trin 2 (e4) på 1280 (se grænser).

## Testresultat

Ingen lint eller verify-scripts (jeg har ikke rørt kode). Målinger fra tre scripts, kørt mod `main` @ `7165ca0` hentet med `git archive`:

| Skærm | 360 x 560 | 390 x 844 | 1280 x 800 |
|---|---|---|---|
| Gåder ved start: bræt / række | 198-478 (280 px) / 484-528 | 290-664 / 670-714 | 237-774 / i sidepanel |
| Computer efter e4: bræt / række | 180-524 / 531-575 (uden for) | 224-598 / 605-649 | 140-677 / i sidepanel |
| Makker + ur: urvalg | 701-753 (uden for), bræt ryger til -136 | 775-827 (inde), bræt 205-579 | 430-478 (inde) |
| Gåde efter forkert træk: række | 522-566 (6 px uden for) | 692-736 (inde) | i sidepanel |
| Lær, "Jeg er ny", trin 1: bræt | 207-487 | 292-666 | 210-709 |
| Vandret rulning | ingen | ingen | ingen |

Skærmbilleder: `outputs/kritik-718/360x560-*`, `390x844-*`, `1280x800-*` (`00-foerste`, `02-computer-start`, `04-efter-e4-og-svar`, `A2-ur-5-0`, `A3-efter-2-traek`, `E1-gaade-efter-traek`, `E2-laer-trin1`, og flere). Konsolfejl er ikke målt (første script opsamlede dem, men udskriften blev ikke gemt).

## Hvad er næste

Chaturanga (i denne rækkefølge):
1. Makker + ur på lav telefon: læg urvalget over eller lige under brættet (eller giv startkortet "Mod en makker" et ur-valg), lad et tryk på uret ikke scrolle brættet ud, og vis "Giv op" i makker-rækken.
2. Gåde-teksten "Ikke den vej. Løsningen er vist ...": kort den ned til to linjer eller giv den samme mindre skrift som 707 gav den anden fejltekst, så rækken ender højst 500 px nede på 360 x 560.
3. Reservér plads til to linjer i statuslinjen i Spil, så brættet ikke hopper 19 px efter første træk, og få rækken Fortryd / Hint / Giv op helt ind i 560 px.

Hvis det er tid bagefter: Lær-skak-niveauvalget på 360 x 560 kunne vise brættet mindre under valgkortene, og 1280 kunne starte med startkortet som telefonen.

**Har arbejdet betydning for Hara** (Skole-planeten, skak-sporet): dommen "ja til klassen" og de tre rester går til Duta.

## Ærlige grænser

- Kun tre størrelser, headless Chromium, touch som `tap()`, ikke en rigtig telefon. Ingen rigtige børn: "11-årig" er min vurdering af tydelighed, ikke en prøve.
- Ét makker-parti med to træk og ét ur-valg (5+0). Jeg lod ikke uret løbe ud og prøvede ikke ur på 1280 (uret står i sidepanelet dér; jeg har set det i skærmbilledet `1280x800-A3-efter-2-traek.png`, men ikke målt det).
- Kun ét gåde-forkert-træk pr. størrelse, valgt automatisk (første felt med et lovligt mål). Andre fejltekster kan give andre højder. Ingen gåde blev løst rigtigt til ende.
- Lær skak: kun trin 1 fra "Jeg er ny". Trin 2 (e4) og de længste trin er ikke klikket igennem, så "Rigtigt!"/fejltekst-vækst på Lær-kortet (707's opfordring) er ikke afprøvet, og 704 nr. 3 er kun delvist genmålt.
- Første målescript (`elevtur-718.mjs`) genbrugte browserprofilen mellem faner, så makker-skærmen viste et gemt parti; tallene for makker + ur kommer fra `elevtur2-718.mjs` med frisk profil pr. scenarie.
- "Giv op" i makker er målt som `display: none` på 360 og 390; jeg har ikke undersøgt, om det er med vilje (fx fordi Start forfra findes).
- Ingen lint og ingen `verify:*`, da der ikke er ændret kode.
