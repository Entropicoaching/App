MMORPG-foelelse: halvvejs. Rodet: nej (opgaveskaermen 76 ord, men svaerebjoeblikket paa 390 er tungt). De tre vigtigste ting Ganita retter naeste gang: (1) Hoved staar stadig stille paa 9 fra opgave 40 til 60, mens niveauet stiger 10 til 15, og Hjerte staar paa 1 (femtende gang aabent, Marcs valg: spoerg ham i dag) (skaerm: `E943-nu-390-9-aerlig-efter-60.png` og `elev-nu.json` under `m.390.sim.aerlig`; fil: Hoved-reglen og niveau-reglerne i `src/spil-app.js`; vis "Hoved er fuldt, nu vokser Haand" ved loftet og giv Hjerte en synlig stigning); (2) "Ane" er stadig en person, eleven ikke har moedt, og "Haand er at maale" forstaas som lineal; forklaringen er kun en linje "Tryk paa ? for mere" efter foerste svar (skaerm: `E943-nu-390-2-ny-foerste.png` og `E943-nu-390-4-opgave.png`; fil: `renderHhhKort` og `#hhh-forklaring` i `src/spil-app.js`; skriv "Hjerte: hjaelp en i landsbyen, fx Ane, moellerens ven" og "Haand: maale, vaege og gaa afstande", og opdater de tests der laaser ordlyden); (3) Ved et rigtigt svar staar erfaring tre steder paa een skaerm ("32 erfaring", "+10 erfaring"-kassen og bjaelken "32 erfaring"), og "+10"-kassen skubber Hoved/Haand/Hjerte ned, saa glimtet i Hoved-kassen er lige ved kanten af det, der skal ses (skaerm: `E943-nu-390-5-svar-150ms.png`; fil: erfarings-kassen og `egenskabGlimt` i `src/spil-app.js`, `src/spil.css`; behold kun "+10"-kassen og Hoved-glimtet, fjern det andet erfaringstal mens svaret vises).

## 1. Hvad jeg goerte og maalte

Spillet hentet med `git archive main --format=zip` fra `Desktop\matematik` (main = `84b5c81`, Ganitas ordre 929 merget) til en midlertidig mappe og koert lokalt, headless Chromium, uden net (0 netkald, 0 sidefejl, ingen vandret rulning). Mit elev-script (`docs/kritik-943/elev-943.mjs`, kopi af 937) med den syntetiske elev "Tulle": 390 touch og 1280 mus; en helt ny elev, tre-fire opgaver, et rigtigt svar fanget efter 150/650 ms/slut, spillet til Niveau op, Min helt og 60 opgaver aerligt mod 60 gaet (kun 390). Laeste Ganitas to nyeste rapporter (929 og 921: "Hvad aendret" og "Hvad er naeste") og foerste linje af min egen seneste matematik-kritik (937). Skaermbilleder og `elev-nu.json` i `outputs/kritik-943/` (`E943-nu-390-*`, `E943-nu-1280-*`).

Maalt (synlige ord / tal / knapper / skaermhoejder):
- Ny elevs foerste skaerm: 390 104/19/7, 1,10 hoej; 1280 113/16/5, 1,24.
- Opgaveskaerm: 390 76/21/7, 1,92; 1280 76/21/7, 2,08 (66 ord i 937; de ti ekstra er reminderlinjen fra 929).
- Niveau op-siden: 390 100/9/8, 1,83; 1280 124/15/8, 2,18.
- Min helt: 390 139/15/5, 1,47 (130 ord i ro); 1280 205/23/9, 1,18.

## 2. Foeles det som et MMORPG? Halvvejs

Det der virker og er blevet bedre siden 937: Hoved-kassen glimter nu groen og hopper ved hvert rigtigt svar (`E943-nu-390-5-svar-150ms.png`: Hoved 2 med groen ramme, "+5" over figurens hoved, "+10 erfaring" i en stor kasse). Niveau op er en rigtig begivenhed: "NIVEAU OP! Niveau 3 . Laerling ... Hoved er nu 3" med et trae-skjold, som figuren baerer paa Min helt; ved niveau 15 (`-9-aerlig-efter-60`) har figuren banner, mange stjerner og skjold, og helten ser tydeligt staerkere ud end paa niveau 2. Det er MMORPG.

Hvor det stadig er halvt: (a) Loftet: 60 aerlige opgaver giver niveau 15 og 600 erfaring, men Hoved staar paa 9 fra opgave 40; Haand 1 til 7; Hjerte 1 hele vejen og 124 indbyggere. Tallet holder op uden forklaring, og Hjerte, som Marc siger skal betale sig ("det betaler sig at vaere et godt menneske"), er det eneste tal eleven aldrig ser vokse. (b) Glimtet sker kun i den egenskab, opgaven traener (Hoved i Moellen); Haand-glimtet er kodet men set i intet skaermbillede (929 siger det selv). (c) Gaetter mod aerlig er tydelig: 60 gaet giver niveau 1, 325 erfaring, Hoved 1 og Haand 1, 0 forloeb mestret, mod niveau 15 og 14 forloeb aerligt. Det betaler sig at vaere aerlig, og det er rigtigt.

## 3. Rod

Skaerm for skaerm paa 390 (synlige elementer, talt paa skaermbillederne):
- Opgaveskaermen (`-4-opgave`): ca. 24 ting (figur, navn, niveau, to cirkler + hint, erfaring, tre kasser + "?", reminderlinje, Min helt-bjaelke med "1 ny", kortets overskrift, titel, stjerner, opgave, Broeker-chip, tre svar). Roligt at laese; svarene staar i en klar raekke.
- Svaerebjoeblikket (`-5-svar-150ms`): ca. 29 ting, det mest overfyldte: "+5" over hovedet, erfaring tre gange, Hoved-kassens glimt, reminderlinjen, Rigtigt!, "Videre". Det er kun et oejeblik, men 11-aarige laeser det uden at naa "Videre".
- Niveau op-siden (`-6-niveauop`): ca. 10 ting (banner, klaret-kort med figur, "Naeste hos ...", to knapper). Den roligste og bedste skaerm i spillet.
- Min helt (`-8-helt`): ca. 27 blokke; den laengste side, og "Journalen" og "Questbogen" oeverst er to knapper uden forklaring. Den 11-aarige naar ikke ned til udstyr og titler.
- Ny elevs foerste skaerm: 1,10 skaerm, kun forklaring og foerste opgave; kortet venter. Roligt.
Marcs "stadig lidt rodet" rammer mest svaerebjoeblikket og Min helt. Derfor "Rodet: nej" paa selve skaermene, men med de to undtagelser.

## 4. Forstaar en 11-aarig Hoved, Haand og Hjerte foerste gang? Halvt

Foerste skaerm har tre korte linjer, og kasserne har et ord under sig hele tiden (regn/maale/hjaelpe). Efter foerste svar staar der "Hoved regner, Haand maaler, Hjerte hjaelper. Tryk paa ? for mere." til 100 erfaring (fra 929). Det er en klar forbedring siden 937 (fund 3 delvist lukket). Men: (a) "Ane" forklarer ikke, hvem hun er eller hvorfor det gaelder; (b) "maale" forstaas som at maale med lineal, mens Haand ogsaa er skridt og maalestok; (c) reminderen forsvinder ved 100 erfaring, og derefter er der kun "?"; (d) paa Min helt staar Hjerte-forklaringen ("Hjaelp Ane med hele hendes opgave-raekke") men kassen siger ikke, hvor langt der er til naeste, kun en prik-raekke.

## 5. Er mine seneste fund lukket? (937) og hvad jeg ikke kunne

- Fund 1, Hoved-loftet og Hjerte paa 1: aaben (Marcs valg, femtende gang; Ganita maa ikke roere reglen uden hans svar).
- Fund 2, kasserne roerer sig ikke ved rigtigt svar: lukket for Hoved (glimt og hop i `-5-svar-150ms`, ordre 929); Haand-glimtet ikke set.
- Fund 3, forklaringen: delvist lukket (reminderlinje efter foerste svar; Ane og "maale" er uaendret).
- Nyt fund (3 ovenfor): erfaring tre gange i svaerebjoeblikket.
- Kunne ikke: scriptets "klaret"-maaling gav `false` paa begge bredder igen (klaret-kortet ses kun inde i Niveau op-siden, `E943-nu-390-6-niveauop.png`), saa klaret-siden er ikke maalt for sig. Kun stillbilleder af animationer (150/300/650 ms); ikke set paa rigtige elever eller skole-pc. Element-tallene under afsnit 3 er taelt paa skaermbillederne (ca.); ord/tal/knapper er maalt af scriptet. Ordre 935 (kortet skjules under klaret-kortet, ny elev uden Min helt-knap) ligger paa en gren i matematiktraeet, ikke paa main, og er derfor ikke vurderet.

Betydning for Hara: ingen.
