Klar til klassen: ja. Det virker på telefon og computer, og mine tre fund fra 762 er lukket. De tre ting Chaturanga retter næste gang: (1) "Hint" mod computeren gør ingenting, man kan se: svaret står i sidepanelet 1188 px nede på en skærm på 560, og når der ingen fare er, står der kun en linje tekst dér (skærm: Spil, Mod computeren, 1. e4 e5, tryk "Hint", `360x560-G5-hint-efter-2s.png`; fil: `visSpilHint` i `src/spil.js` og `#spil-hint-besked` i `src/skak.template.html`); (2) på 1280 x 800 står to lyd-afkrydsninger med næsten samme navn, "Lyd: træk, skak og partislut" og "Lyd ved tryk og lav tid", i samme panel, og en elev ved ikke, hvilken der tænder lyden (skærm: Spil, Mod en makker, `1280x800-A3-efter-2-traek.png`; fil: lyd-rækkerne i Spil-panelet i `src/skak.template.html`); (3) giver man op efter ét træk, står der i panelet "Motoren fandt intet træk, hvor du tabte meget. Godt spillet!", som lyder som ros for at tabe (skærm: Spil, Mod computeren, Giv op, `1280x800-H1-efter-giv-op.png`; fil: teksten under "Tre steder hvor partiet vendte" i `src/spil.js`).

# Ordre 777, Bhishak, 30. sep. 2026

Skakken på `main` (`5f2c6f0`, hentet med `git archive` til en midlertidig mappe uden for repoet, kørt derfra). Set som en 11-årig på 360 x 560 og 390 x 844 (touch) og 1280 x 800 (mus), frisk browserprofil, headless, syntetiske træk. Gren `kritik-777`. Filer kun under `docs/kritik-777/` (scripts `elevtur-777.mjs`, `elevtur2-777.mjs`, `hint-777.mjs`, `slut-777.mjs`) og `outputs/kritik-777/` (skærmbilleder og måletekst). Læst: Chaturangas to nyeste rapporter (770 og 773, "Hvad ændret" og "Hvad er næste"), ranglisten i `docs/MOD-LICHESS.md` og første linje af min egen seneste skak-kritik (762).

## Kan en 11-årig komme i gang uden hjælp?

Ja, og eleven ser altid brættet.
- **Parti mod computeren (360 x 560):** brættet står 148-452 af 560 med statuslinjen over ("Computeren spillede e7-e5. Din tur."), og Fortryd / Hint / Giv op ligger lige under, 459-503, og "Valg: Hvid, niveau 1" 506-550 (`360x560-B2-hint.png`). 390 x 844: brættet 228-602, knapperne 609-653. Alt er inde uden at rulle. "Giv op" spørger først ("Giv op? Modstanderen vinder partiet." med "Ja, giv op" og "Annuller"), og bagefter står "Gennemse partiet", "Nyt parti" og "Prøv niveau 1 igen" 455-549 (`360x560-H1-efter-giv-op.png`).
- **Makker-parti med ur:** efter et tryk på "Mod en makker" står valget "Valg: intet ur" lige under knapperne; efter 5+0 står Hvids og Sorts ur som store felter på hver side af Fortryd og Giv op (`360x560-A3-efter-2-traek.png`). På 1280 står urvalget (Intet, 3+0, 4+0, 5+0, 10+0, 5+3, Frit) og de to ur i sidepanelet (`1280x800-A3-efter-2-traek.png`).
- **Gåde:** brættet står inde på alle tre (198-478 på 360), "Hvid trækker" på én linje, "Niveau: 0 af 10" ved siden af "Storm", og "Vis et hint" under brættet (`360x560-D1-gaade.png`). Hintet virker: første tryk fremhæver brikken, andet viser trækket (`360x560-F2-gaade-hint.png`, "Hint: se den fremhævede brik." står øverst, brættet i billedet).
- **Lær skak, "Jeg er ny":** teksten øverst, brættet under, en grøn ring på e4; et tryk på e4 giver "Rigtigt! Det er e4: linje e, række 4." og "Videre ›" 183-227, og trin 2 er "Kongen" med stjerner at samle (`360x560-C1-laer-ny.png`, `360x560-E3-laer-trin2.png`). Det er tydeligt, hvad der skal trykkes på.
- Ingen sidescroll og ingen sidefejl på nogen størrelse (`elevtur2.txt`).

## Hvad er stadig besværligt eller rodet på lav telefon?

- **Hint i Spil er usynligt.** Tryk på "Hint" mod computeren: intet nyt på skærmen. Måling: `#spil-hint-besked` ligger 1188-1230 px nede på en side, der er 560 høj (`hint.txt`). Efter 1. e4 e5 står der "Ingen tydelig fare eller svaghed at pege på lige nu." dér, og ingen brik lyser. Eleven tror, knappen er i stykker. I Gåder virker hintet fint, så det er kun i Spil.
- Hovedet er stadig to rækker faner (Bibliotek / Lær skak / Taktik og Spil / Gåder / Opstil) plus "Undervisning" og fylder de øverste ca. 100 px af 560 (`360x560-A3-efter-2-traek.png`); på Spil er brættet derfor kun 304 px. Det er kendt (773 nr. 2 på ranglisten) og ikke et hængeparti.
- Statuslinjen brydes over to linjer, når computeren har trukket ("Computeren spillede e7-e5. Din tur.") og skubber brættet 30 px ned (`360x560-B2-hint.png`); brættet er dog stadig helt inde.
- På 1280 x 800 ligger Fortryd / Vis et hint / Start forfra og Giv op nederst i sidepanelet (Giv op ca. 737-780 af 800), lige på kanten, og navigationspilene under brættet ligger 730-800 (`1280x800-A3-efter-2-traek.png`); det virker, men er tæt. To lyd-afkrydsninger med næsten samme tekst står i samme panel.
- Efter Giv op på 1 træk står "Godt spillet!" (se dom, punkt 3).

## Er mine seneste fund lukket? (762)

- Fund 1, åben valgfold ruller brættet ud og ur-knapperne er trange: **lukket i praksis.** Valget "Valg: ur 5+0" står 506-550 på 360 x 560 med brættet inde, og et tryk på 5+0 giver to store ur (`360x560-A2-ur-5-0.png` og A3). Jeg målte ikke den åbne fold på ny denne gang; Chaturanga har målt den i 760, 770 og 773 (braet og ur begge inde), og jeg så, at folden åbner og virker.
- Fund 2, hjælpeknapper med voksensprog: **lukket.** Under brættet står "Vend brættet" og "Pile og streger: til" som kasser (`360x560-C1-laer-ny.png`); "Tavle" og "Hvad sker der" er skjult på telefon. "Tegnelag" og "Udseende" er omdøbt.
- Fund 3, "niveau: 0 af 10" og to-linjet "Hvid trækker": **lukket.** Én linje, "Niveau: 0 af 10" (`360x560-D1-gaade.png`); på 1280 "Vi finder dit niveau: 0 af 10 gåder".
- Chaturangas egne to rester fra 773 (noten "sort nederst" på 320, og siden der hopper til toppen, når folden lukkes) har jeg ikke målt, da ordren siger 360, 390 og 1280.

## Testresultat

Ingen kode ændret (skakkens `main` ikke rørt), så `npm test` er ikke relevant. Målescripts kørt uden sidefejl på alle tre størrelser (`elevtur2.txt`, `hint.txt`, `slut.txt`). Locators der ikke ramte, og ikke er fejl i skakken: `#strimmel-*` findes kun på telefon (på 1280 bruger sidepanelets `#knap-*`), min første Giv op-runde ramte bekræftelsesdialogen med samme knap to gange, og `#knap-hint` er skjult i Spil på 1280 (Spil-hintet hedder `#knap-spil-hint`). De er rettet i scripts, hvor det var min fejl; på 1280 blev Spil-hint ikke trykket, kun Giv op (`slut.txt`).

## Hvad er næste og ærlige grænser

Chaturanga: (1) gør Hint i Spil synligt: vis teksten som en linje lige under brættet (eller i statuslinjen) og lad en brik lyse, også når der ingen fare er ("Ingen fare lige nu, spil dit plan"); (2) slå de to lyd-afkrydsninger på 1280 sammen eller navngiv dem forskelligt ("Lyd i partiet" og "Lyd fra uret"); (3) ret teksten efter Giv op til noget, der passer til et opgivet parti ("Partiet er slut. Vil du se, hvad du kunne have gjort?"). Det støtter Hara-delmålet "Appen mærkbart bedre" (skolen): Marcs klasse kan spille nu, og det der er tilbage, er små ting på lav telefon og sprog. Grænser: headless Chromium, touch som `tap()`, "ja" er min vurdering; ingen rigtig telefon og ingen børn; jeg har ikke spillet et parti til mat i denne runde (kun 1. e4, Giv op, ur 5+0 og to træk), og ikke Lær skak ud over trin 1-2 af 32; gåde set med hint, ikke løst; 320 x 520 ikke målt (ikke bedt om); den åbne valgfold målt ikke på ny. Den midlertidige kildemappe (`%TEMP%\skak777`) ligger uden for repoet.
