skakken stadig klar til Marcs klasse: ja

**Ja.** Det virker, som Chaturanga siger:
- "Denne uge / sidste uge" står rigtigt ved Find feltet, åbningen og de kendte partier over to rigtige uger, spillet med tryk i appen på 360, 390 og 1280.
- Koden er den samme med og uden ugerne.
- Der er 0 netkald og 0 JS-fejl.
- Lærersiden med den lukkede fold er kortere, og folden er let at finde nederst.

Mit ene nye fund af betydning er **S7 (middel)**: for "Find feltet" måler ugen procent rigtige, men øvelsen er på tid. En elev, der bliver hurtigere, får ingen ros. Bliver hun hurtigere og laver 2 fejl, får hun at vide, at hun "gik lidt ned … Øv det igen". Det stopper ikke klassen, men det bør rettes, før Marc peger eleverne på ugesætningen.

# Kritik 610, blok 2: skakken efter Chaturangas 604

Bhishak, 28. sep 2026. Ordre 610.

**Skakken:** `C:\Users\Entropi\Desktop\skak` `main` @ `246fe59` (merge af ordre-604), hentet med `git archive`. Træet er ikke rørt. Chaturangas `outputs/RAPPORT-604.md` er læst.

## Hvad jeg målte

`outputs/kritik-610/skak-610.mjs` giver **16/16 grønne tjek** (`skak-610.json`, `skak-610.log`, `S-*.png`).

- Playwrights Chromium headless: 360 og 390 med touch, 1280 med mus. `file://`, alt andet net er afbrudt.
- Elevens tid går på Playwrights falske ur, og appens egne timere (modstanderens svar, 30 s i Find feltet) kører på det.
- Alt elevens er spillet i appen med tryk. Intet er lagt i lageret på forhånd, i modsætning til Chaturangas eget tjek.
- Åbningens linje og de kendte partiers løsning læser mit script fra skakkens rene moduler (`aabningsbog.js`, `kendtepartier.js`). Siden får kun trykkene.

## Chaturangas punkter

### Uger over to rigtige uger

Eleven, 12 år:
- **Uge 1** (mandag 21. sep. 2026):
  - en langsom runde Find feltet: 8 rigtige, 0 forkerte
  - Italiensk parti med ét forkert træk (Sf3 først)
  - Partiet i operaen med ét forkert træk og Fortryd
- **Uge 2** (uret skruet til mandag 28. sep.):
  - Find feltet igen, nu 18 rigtige på de samme 30 s
  - Italiensk uden fejl
  - et andet kendt parti uden fejl

| Hvornår | Find feltet | Italiensk parti | Kendte partier |
|---|---|---|---|
| uge 1 | denne uge: 100 % i 8 forsøg · sidste uge: ikke øvet | denne uge: 0 % i 1 forsøg · sidste uge: ikke øvet | som åbningen |
| mandag uge 2, før hun øver | denne uge: ikke øvet · sidste uge: 100 % i 8 forsøg | … sidste uge: 0 % i 1 forsøg | som åbningen |
| uge 2 | denne uge: 100 % i 18 forsøg · sidste uge: 100 % i 8 forsøg | denne uge: 100 % i 1 forsøg · sidste uge: 0 % i 1 forsøg | som åbningen |

**Alt står rigtigt**, på alle tre bredder. Lageret har kun ugens nummer, fx `{"2960":[8,8],"2961":[18,18]}`, og ingen dato.
- Ugerne tælles fortløbende fra 1970, så nytår er intet problem: uge 53 og uge 1 er naboer (28. dec. 2026 og 4. jan. 2027).
- Koden er den samme med og uden ugerne (`8000-001J-5KHK-0000-01SZ`).

**Sætningen over listen** er i uge 2: "Denne uge har du øvet 1 åbning, 1 koordinatøvelse og kendte partier i 20 forsøg." Mandag i uge 2, før hun øver, står der: "Du har ikke øvet noget denne uge endnu. Sidste uge står ved hver øvelse."

**Kan en 11-12-årig forstå den?** Delvis:
- "1 koordinatøvelse" er et voksenord. Eleven har trykket på "Find feltet", ikke på en "koordinatøvelse". "Find feltet" eller "1 feltøvelse" ville hun kende.
- Sætningen med gådetemaer ("Denne uge blev du bedre til gafler: 80 % mod 60 % sidste uge.") er klar.

**Men se S7:** det, hun faktisk blev bedre til, står ingen steder.

### Blandede forsøg ("i N forsøg")

"i 20 forsøg" er 18 tryk på et felt, 1 åbning og 1 kendt parti. Med en runde Find feltet, 3 gåder og 1 åbning bliver det "i 17 forsøg", hvor 13 er feltsvar.

**Er det misvisende nok til at rette?** Lidt:
- Tallet vokser mest med det letteste (et felttryk tager et sekund, en gåde et minut). En elev, der vil have et stort tal, trykker felter.
- Men tallet dømmer ikke. Det er en optælling, og ingen elev bliver snydt af den.

Mit forslag er at fjerne tallet eller dele det: "Denne uge har du øvet 1 åbning, Find feltet (18 felter) og 1 kendt parti." Det er S8, og den er lav.

### Lærersiden som Marc

25 syntetiske koder (20 udgave 2, 5 udgave 1) på 360, 390 og 1280:

| Bredde | Lukket | Åben | Folden står |
|---|---|---|---|
| 360 | 2.977 px (3,8 skærme) | 4.526 px | 3,7 skærme nede |
| 390 | 2.902 px (3,4 skærme) | 4.451 px | 3,3 skærme nede |
| 1280 | 2.339 px (2,9 skærme) | 3.655 px | 2,8 skærme nede |

- "Øvet af under halvdelen (11 kompetencer)" står lukket nederst med trekant. Tryk-feltet er 71 px på telefonen og 46 px på 1280.
- **Finder Marc det tema, klassen ikke har øvet?** Leder han efter "Mat i 3" (5 af koderne er fra før temaet fandtes), står det ikke i "Svagest først", men i folden. Folden er det sidste på siden og siger "under halvdelen", så han finder den. Men overskriften siger kun antallet, ikke hvilke.
- **Er siden kort nok?** Ja, for en lærer: 3-4 skærme er i orden, fordi det vigtigste ("Svagest først") står øverst.
- Om Chromes Ctrl+F åbner en lukket fold af sig selv, har jeg ikke kunnet prøve headless.

Ingen vandret rulning, 0 netkald og 0 JS-fejl (`S-390-laerer-fold-lukket.png`).

## Fund

| Nr. | Vægt | Hvad | Ret |
|---|---|---|---|
| S7 | middel | Find feltet er en øvelse på tid, men ugen måler procent rigtige. 8 → 18 fundne felter på 30 s giver "100 % mod 100 %" uden pil, og sætningen siger intet. 10/10 → 20 af 22 (dobbelt så mange, 2 fejl) giver: ""Find feltet" gik lidt ned denne uge: 91 % mod 100 % sidste uge. Øv det igen." "Skriv feltets navn" og "Hvor står brikken?" har samme runde på tid og bruger samme regel (ikke målt i browseren). | Chaturanga: for de tre koordinatøvelser, gem også hvor mange rigtige pr. runde (det højeste eller gennemsnittet i ugen), og lad "denne uge / sidste uge" og sætningen bruge det: "Find feltet: 18 felter på 30 s mod 8 sidste uge." Procenten kan stå ved siden af. Lad ikke procenten alene sige "gik ned", når antallet gik op. |
| S8 | lav | "i N forsøg" lægger felttryk og gåder sammen (18 af 20). "1 koordinatøvelse" er ikke et ord, eleven kender fra appen. | Chaturanga: skriv navnet ("Find feltet") og tæl pr. slags, eller fjern tallet. |
| S9 | lav | Lærersidens fold siger antallet, ikke hvilke. En lærer, der leder efter ét tema, skal åbne den. | Chaturanga, hvis Marc vil: de tre første navne i overskriften ("Mat i 3, Forvandling, … (11)"). Ikke nødvendigt. |
| S5 | lav | Står fra 598 (temaer med lille pulje). Chaturanga har den øverst på sin rangliste. | Chaturanga |
| S6 | lav | Står fra 598. | Chaturanga |

## Ærlige grænser

- **Ingen telefon:** headless Chromium på Windows. Touch er Playwrights, og uret er falsk. "To rigtige uger" er to mandage på det falske ur, ikke to uger i en klasse.
- **Én elev, spillet af mig:** mine valg (8 og 18 felter, ét forkert træk) er mine. Hvor mange felter en rigtig elev finder på 30 s, ved jeg ikke. Pointen i S7 gælder, så snart hun bliver hurtigere.
- **Hvad en 11-12-årig forstår**, er min vurdering, ikke prøvet på en elev.
- **Lærersiden** er målt med 25 syntetiske koder, ikke en rigtig klasse.
- **Åbningsbiblioteket gemmer `sidst` som et tidspunkt i sekunder** (fra 538, ikke nyt i 604). Det bliver på maskinen og er ikke i koden.
- **Chaturangas tests er ikke kørt.** Kun mine egne scripts.
- **Grænserne:** ingen rigtige elever, ingen net, og skak-træet er ikke rørt.
