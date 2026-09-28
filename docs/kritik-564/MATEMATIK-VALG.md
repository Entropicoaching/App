Marc kan vælge ud fra siden: ja

# Kritik 564, blok 2: Marcs valg-side i matematik (Ganita 557)

Læst: `C:\Users\Entropi\Desktop\MARCS-VALG-MATEMATIK.html` (kun læst; magen til kopien i matematik main `af963d8`, `outputs/557/`), `docs/MARCS-VALG-542.md` og `outputs/RAPPORT-557.md`, hentet med `git archive`. Siden er åbnet headless på 360 og 390 px med touch (lyst og mørkt tema) og 1280 px, uden net. Et tal pr. valg er holdt op mod koden og mine egne elev-552-kørsler. Script: `outputs/kritik-564/valg-564.mjs`, 20 af 20 tjek grønne; tallene står i `valg-564.json`, siden i `M-*.png`.

Dommen er **ja**: de to valg er forklaret i almindeligt sprog, hver mulighed siger, hvad eleven mærker, N6 og N7 står der tydeligt, og tallene passer med koden. Det, der mangler (N9-N12), gør ikke valget forkert, men M2 A bør sige, hvad der sker med tallene hos elever, der allerede spiller, før det bygges.

## Læst som en lærer på telefonen

- Siden er 3,9 skærme på 390 px (4,0 på 360), ingen vandret rulning, ingen scripts eller eksterne filer, intet net. Skrift 16 px, mindst 12,8 px ("MIT FORSLAG"), kontrast mindst 5,1 i lyst og 6,1 i mørkt tema.
- **M2** er forklaret uden fagord: "en ny figur har 1 i alle tre. Ét af tallene stiger, hver gang figuren stiger et niveau, men tallene åbner ikke noget." En lærer forstår det. Men telefonsiden siger ikke *hvilket* tal der stiger (stedet bestemmer: Møllen og Sporvognen Hoved osv.; det står kun i den lange udgave), så "7-1-1" er uforklaret (N12).
- **N1** er forklaret: den travle trykker "Fortsæt", hjælper ingen og når niveau 7; følgeren hjælper tre og når 5; titlerne står med deres niveauer.
- Ord, en lærer må gætte: "forløb" (3 gange) og "mestrede" (ikke forklaret på siden; den lange udgave siger "3 af 3 rigtige i første forsøg"), "model-elev", og tre navne uden forklaring: Bhishak (2), Ganita (4) og Dhruva (1, "i én linje til Dhruva"). For Marc er de kendte; for en lærer er de ikke (N11). "M2", "N1" og "N8" er koder, men står som overskrifter med en forklarende titel og bruges i svaret, så de er i orden.

## Hvad eleverne mærker

Alle syv muligheder (M2 A, B, C; N1 A, A+, B, C) har "Eleven mærker:".

- **N6 (titler der forsvinder):** står i en rød boks under N1 A: "en elev, der i dag er Svend eller Mester uden at have hjulpet nogen, **mister titlen**. Næste gang hun åbner spillet, står der "Lærling" igen." Tydeligt. A+ er forklaret som "ingen rykker ned".
- **N7 (Hjerte starter på 1):** står i M2 A med fed: "Alle tre starter stadig på 1 ... Hjerte 1 = har ikke hjulpet nogen endnu", og "M2 A0" er der for den, der vil starte på 0.
- **Men M2 A siger ikke, hvad der sker med tallene hos en elev, der allerede spiller** (N9). Regnes Hoved, Hånd og Hjerte om ud fra det, hun har gjort, eller tæller de videre herfra? Regnes de ikke om, har følgeren, der har hjulpet tre, stadig Hjerte 1, og siden siger samtidig, at Hjerte er "de folk, du har hjulpet". Regnes de om, kan Hoved eller Hånd falde (Hoved og Hånd tæller i dag også hjælp, fordi et halvt niveau fra en quest løfter stedets tal). Og med **A0** falder den travles Hjerte fra 1 til 0; siden siger "den travle har Hjerte 0", men ikke at det er et tal, der falder. Det er samme slags ting som N6, bare mindre.
- N1 B og C siger heller ikke, om de gælder bagud (får følgeren, der har hjulpet tre, 1,5 niveau med det samme under C?). Det er mindre vigtigt, fordi Ganita ikke foreslår dem.

## Forslag og fakta

- Forslaget er **mærket**: "MIT FORSLAG" og grøn baggrund på M2 A og N1 A+, én pr. valg. "I dag"-linjerne (grå) er fakta; mulighederne er beskrevet ens for alle. Det er adskilt nok til at vælge.
- Tre ting skubber let mod forslaget (N10): (1) eksemplet på et svar, `matematik: M2 A, N1 A+`, er præcis forslaget; (2) siden siger ikke, hvem "mit" er, før foden ("Ganita, ordre 557"); (3) grundene til forslaget ("den mindste ændring", "ingen oplever at få en titel taget") står kun i den lange udgave, så telefonsiden viser *hvad* Ganita foreslår, men ikke *hvorfor*.
- "Eleven mærker"-linjerne er forudsigelser, ikke målinger (fx "følgeren når niveau 6-7" under N1 C er regnet, og "Hun mister intet, hun kunne bruge" er en vurdering). Siden siger øverst, at tallene er fra en model-elev; det er nok til at læse dem som gæt.
- Tallene "den travle når niveau 7, følgeren 5" er én kørsel (terning 525). Over mine fire terninger når den travle 7, 8, 9 og 7 (to gange Mester) og følgeren 5, 4, 8 og 4 (N12). Konklusionen "det betaler sig at springe over" holder i alle fire; men N1 A's advarsel rammer flere Mestre, end "niveau 7 (titel Svend)" får det til at lyde.

## Siden mod koden

Et tal pr. valg, holdt op mod matematik main `af963d8`:

| valg | sidens tal | koden | passer |
|---|---|---|---|
| M2 | ny figur 1-1-1 | `nyFigur`: hoved 1, haand 1, hjerte 1 | ja |
| M2 | den travle 7-1-1 | seks mestrede forløb ved Møllen med `givNiveauPoint(..., 'hoved')`: niveau 7, 7-1-1, "Svend" | ja |
| M2 | følgeren 3-3-1, niveau 5 | tre forløb og tre quests: niveau 5 med et halvt niveau i vente, Hjerte 1 (elev-552: "hjælp én person mere") | ja |
| M2 B | Bigården åbner i dag på opgaver og personer | `bistaderne` kræver Møllens forløb 6 og Anes æbleskiver | ja |
| N1 | titler fra niveau 3, 5, 8, 11 | `titelForNiveau` | ja |
| N1 C | at hjælpe giver i dag et halvt niveau | `NIVEAU_POINT.quest` 1 af 2 | ja |
| N8 | Hans' opgave åbner efter Grusgravens første forløb | `sten-til-diget` kræver `stenbrud` 1 | ja |
| N8 | følgeren ventede 4-9 min, én gang over 10 | min kritik 552 (terning 42, 525, 1234; terning 7 over 10) | ja |

## Fund

Fortsat fra N8 (kritik 552).

| id | alvor | fund |
|---|---|---|
| N9 | middel | M2 A (og A0) siger ikke, hvad der sker med Hoved, Hånd og Hjerte hos en elev, der allerede spiller: regnes de om, eller tæller de videre? Uden omregning har følgeren, der har hjulpet tre, Hjerte 1, mens siden siger, at Hjerte er de folk, hun har hjulpet; med omregning kan Hoved eller Hånd falde, og med A0 falder den travles Hjerte fra 1 til 0. Det er N6's spørgsmål for M2. Bør stå på siden, før Marc vælger A eller A0. |
| N10 | lav | Forslaget skubber let: eksemplet på et svar er præcis forslaget, "mit" forklares først i foden, og grundene til forslaget står kun i den lange udgave. |
| N11 | lav | En lærer møder "forløb", "mestrede" (ikke forklaret på telefonsiden) og navnene Bhishak, Ganita og Dhruva uden forklaring. |
| N12 | lav | Telefonsiden siger ikke, hvilket tal der stiger (stedet bestemmer), så "7-1-1" er uforklaret; og niveauerne er fra én terning (525), mens den travle over fire terninger når 7-9 og to gange Mester. |

## Ærlige grænser

- Jeg har læst siden som en lærer, men jeg er ikke en lærer, og ingen lærer har læst den.
- Headless Chromium på Windows (Georgia er der), ikke en rigtig telefon. Mørkt tema er målt på 390.
- "Tal mod koden" er ét tal pr. valg regnet med spillets egne funktioner; jeg har ikke spillet A, A+, B eller C, for de er ikke bygget.
- Om Hoved og Hånd faktisk falder ved omregning under M2 A, afhænger af hvordan Ganita bygger det (mestrede forløb, der ikke gav niveau, tæller måske med); jeg påstår kun, at siden ikke siger det.
- Elev-tallene er min model-elev fra kritik 552 (efter 542, før 557); 557 ændrede ikke reglerne, og Ganitas elev-557 gav samme tider for terning 525.
