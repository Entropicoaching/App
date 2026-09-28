NYT-I-APPEN klar til at Marc kan sende den: ja

Bhishak, ordre 648 blok 2, 28. sep. 2026. Vaidyas `NYT-I-APPEN.html` (ordre 644), kun læst.

**Kort sagt.** Alle seks punkter og den lille linje nederst passer med appens kode på `main` @ `391144e`, hvert citat står ordret i koden, og siden er rolig: første sætning siger "det meste er som før", ingen salg, ingen fagsprog uden forklaring. Den kan sendes, som den er. To billeder bør dog skiftes eller beskæres, før Marc sender den, fordi en atlet vil undre sig over dem (N1, N2). Det tager Vaidya ti minutter.

## Hvad jeg målte

- Filen: `C:\Users\Entropi\Desktop\NYT-I-APPEN.html`, 309 810 byte, sha256 `15a6bc8645d4...` (hele hashen i `nyt-648.json`; verify tjekker, at filen ikke er ændret siden).
- `outputs/kritik-648/nyt-648.mjs`: file:// i headless Chromium (playwrights), 390 × 844 touch og 1280 × 900 mus, lys og mørk, alt net blokeret. I alle fire: 324 ord, 6 punkter, 6/6 billeder vist, 0 px sidelæns, 0 net-kald, 0 JS-fejl, 17 px brødtekst, ingen tankestreg i Vaidyas tekst. 4,7 skærme på 390, 4,4 på 1280. Mørk tilstand har mørk baggrund (`rgb(21, 20, 18)`).
- Hvert citat fra appen (de fede tekster) slået op med `git grep` på `391144e` i `src` og `public`. Resten læst i koden (linjerne nedenfor). Appen er ikke kørt; Vaidyas skud-644 (12/12) kørte den mod mocken.
- Billeder: `N648-390-hel.png`, `N648-390-top.png`, `N648-390-billede-1.png`, `N648-390-billede-5.png`, `N648-1280-hel.png`, `N648-*-moerk-top.png`.

## Punkt for punkt mod koden

| Punkt | Siden siger | Koden på 391144e | Passer |
|---|---|---|---|
| Øverst | samme forside, samme faner, sæt logges med Godkendt i Dagens pas | `NavItems.jsx` uændret siden før pushet (Hjem, Program, Volumen, Fremgang, Kost, Mobilitet, Beskeder); knappen `Godkendt` `DagensPasCard.jsx:399` | ja |
| 1 Virker uden net | "☁ sendes når du har net", sendes af sig selv, én gang, med tidspunktet for Godkendt; åbner uden net efter brug med net | `DagensPasCard.jsx:309/415`; `offlineSetQueue.js:131-137` (`logged_at` = tidspunktet for Godkendt); service worker registreret i `index.html:11-12` (`/sw.js`) | ja |
| 2 Rekorder | 🏆 på sættet; "højere beregnet max eller flere gentagelser på en vægt, du har løftet før"; under Fremgang med dato | `DagensPasCard.jsx:163`, `rekorder.js:59-60` (e1RM eller reps), `FremgangTab.jsx:274` "Dine rekorder" med `kortDato` | ja; fejringen står 5 s (N3) |
| 3 Din uge | "Hvordan gik det?" 1 til 5 eller spring over; Din uge på forsiden efter ugens sidste pas; en linje til coachen | `DagensPasCard.jsx:132-154`, `DinUgeKort.jsx` (Pas, Tonnage, Rekorder, Dine vurderinger, "Vil du skrive noget til din coach om ugen?") i `HjemTab.jsx:152` | ja; spørgsmålet kommer kun fra Dagens pas (N4) |
| 4 Fremgang | "Squat e1RM 117 kg, +9 kg siden uge 37"; e1RM forklaret; større tal i grafen | `FremgangTab.jsx:59-64` `fremgangLinje` | ja |
| 5 Kvittering | "Video modtaget ✓", står et par sekunder | `videocoach.html:7135-7137`, står i 8 s | ja |
| 6 Danske datoer | "28. sep"; coachen ser dansk dato på den rigtige dag | `FremgangTab.jsx:114-115` (`MDR`, `kortDato`), `danskDato.js` | ja |
| Nederst | vægtfeltet starter på coachens anbefaling; RPE og note på sættet | `DagensPasCard.jsx:278` "Anbefalet", 504-535 (RPE, "Note til coachen") | ja |

Intet på siden lover noget, der ikke er i koden, og intet fra `kaede-klar` (ikke merget) er med.

## Tonen

- **Rolig:** ja. Første sætning tager frygten ("Det meste er som før"), og sidste er Marcs egen dør ("Driller noget, så skriv til Marc."). Ingen udråbstegn, ingen "nu kan du endelig".
- **Kort:** næsten. 324 ord og 4,7 skærme på telefonen for seks punkter. Punkt 4 og 6 er små og kunne være én linje hver; anden sætning i punkt 6 handler om coachens side, ikke atletens (N5).
- **Marcs tone:** du-form, korte sætninger, ingen fagord uden forklaring (e1RM forklares). Det lyder som en coach, ikke som en app-butik.
- **Forvirrer det atleterne?** Teksten ikke. To billeder kan: punkt 5 viser et tv-prøvebillede med farvebjælker som "videoen" (N1), og punkt 1 har overskriften "Mandag · Dag 1 · Squat" (med appens tankestreg) over en bænkpres (N2). Begge er mockens testdata, og en løfter ser det.
- **Ville Marc skamme sig?** Nej over teksten. Farvebjælkerne i punkt 5 ville han nok ikke selv have valgt.

## Fund

| Fund | Alvor | Hvad | Hvad Vaidya kan gøre |
|---|---|---|---|
| N1 | middel | Billede 5 viser farvebjælker (et testbillede) bag "Video modtaget ✓". Det ligner en fejl eller en ødelagt video (`N648-390-billede-5.png`). | Beskær til banneret, eller tag billedet med en syntetisk løftevideo (løftmodellens figur). |
| N2 | lav | Billede 1: "Mandag · Dag 1 · Squat" (med appens tankestreg) over "Bænkpres" (mockens pas). En løfter undrer sig (`N648-390-billede-1.png`). | Giv mockens pas en titel, der passer, eller vælg et squat-sæt. |
| N3 | lav | "står det lige på sættet med en 🏆": fejringen forsvinder efter 5 s (`saetSkrivning.js:74`). Den, der kigger efter bagefter, finder den kun under Fremgang. | "står der et øjeblik en 🏆 på sættet". |
| N4 | lav | "Når et pas er klaret, spørger appen Hvordan gik det?": kun når passets sidste sæt logges i Dagens pas på forsiden (`HjemTab.jsx:120`), ikke fra Program-fanen. | "Når du klarer et pas i Dagens pas, ...". |
| N5 | lav | 324 ord; punkt 6's anden sætning (coachens side) er ikke til atleten. | Stryg den sætning. |

Ingen af fundene gør siden forkert. Derfor **ja**: Marc kan sende den nu, og bedre efter N1.

## Ærlige grænser

- Punkterne er tjekket i koden og med `git grep`, ikke ved at køre appen. At de virker i appen, er Vaidyas skud-644 (mod mocken, ikke en rigtig telefon) og tidligere kritikker (446, 456).
- "Marcs tone" er mit skøn ud fra hans ordrer og tidligere tekster til atleterne; ingen atlet har læst siden.
- Service worker-delen ("åbner uden net") er læst i koden og i Vaidyas måling, ikke målt af mig.
- Kun læst: `NYT-I-APPEN.html` og Vaidyas filer er ikke rørt, og intet er sendt til nogen.
