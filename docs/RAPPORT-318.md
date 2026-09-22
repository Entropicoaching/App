**Anbefaling: push.** Ingen sikker fejl fundet i Dagens pas efter 314. To touch-target-fund (ret-knappen 22×20 px, "Vis næste sæt"-checkboxen) og én bekræftet — men allerede kendt — grænse ved "ret" af et tidligere sæt. Se `docs/KRITIK-314.md`.

# Rapport — ordre 318: kritiker på Dagens pas (314) før Marcs push, og et blik på den nye løfterfigur (to blokke, intet rettet)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `kritik-314`, forgrenet fra `main` = `34f0b23` (314 er merget af Vaidya, ikke pushet). Ordrens to blokke, hver sin commit:

- `ab740da` blok 1: skærmbilleder fra den headless gennemgang (`outputs/kritik-314/`, 31 billeder, fiktive data, egen mock med en ekstra fiktiv øvelse for at kunne teste "gå til næste øvelse")
- denne commit blok 2: `docs/KRITIK-314.md` og denne rapport

Arbejdstræet er rent. Ingen push, ingen kode rettet, ingen migration, ingen Supabase-forbindelse mod produktion, ingen atletdata. Port 8991 var fri hver gang; jeg lukkede ingen andres processer.

## Hvad ændret

Intet, kritik. Kun skærmbillederne og de to dokumenter er nye.

Det jeg fandt (alle detaljer og skærmbilleder i `docs/KRITIK-314.md`):

- **Ret efter push (moderat):** "ret"-knappen på et klaret sæt er 22×20 px — sletter og genåbner sættet med ét tryk, ingen bekræftelse, under halvdelen af appens egen 44 px-regel.
- **Kosmetisk/lav:** "Vis næste sæt"-checkboxens label er 84×23 px, selve boksen 13×13 px.
- **Bekræftet, ikke nyt:** "ret" på et tidligere sæt (fx sæt 2), mens et senere sæt (sæt 3) allerede er logget, gør sæt 3's linje midlertidigt usynlig, og en gen-godkendelse af sæt 2 springer stille direkte til "Sæt 4/4" uden at atleten ser sæt 3 igen. Data er ikke tabt — kun visningen springer. Allerede beskrevet teoretisk i RAPPORT-314's "Ærlige grænser"; jeg har nu bevist det med klik.
- **Holdt:** F4 (rækken der brækkede) er lukket — ingen vandret overflow målt på 390 eller 360 px i hele gennemgangen. Kun det aktuelle sæt har felter. "Sæt N af M" fulgte altid det rigtige sæt. Fortryd sidste sæt virker (44×314 px, ingen dublet-række). Offline-køen fra 293 virker stadig på Dagens pas (optimistisk straks, "gemt lokalt" efter ca. 4 s, sender automatisk uden dublet ved online igen). Ingen klippet tekst. Overgang til næste øvelse og tilbage via Program-fanen virker.

For Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): 314 lukker den konkrete forvirring Marc selv fandt på telefonen ("hvilket sæt er jeg på"), og F4 fra forrige kritik er bekræftet lukket. Jeg fandt ingen ny blokerende fejl denne gang — kritikerrollens fund er denne gang forbedringer til den næste ordre, ikke en stopklods for denne.

## Testresultat

- `npm run lint`: ren.
- Én ubrudt `npm run proever`, port 8991 checket først (fri): **84/84 grønne** (0 fejl, 0 sprunget over) — samme facit som Vaidyas egen kørsel i RAPPORT-314.
- Min egen gennemgang: headless Chromium, 390×844 og 360×780, egen udvidet mock (Squat + en ekstra fiktiv øvelse, "Bænkpres", kun for at kunne teste "gå til næste øvelse" — findes ikke i den faste `e2e/fixtures.mjs`-seed). Fire sæt logget i træk med plus/minus-roderi, "ret" på et klaret sæt midt i, offline+online, Program-fane og tilbage, plus automatisk måling af touch-target-størrelser (`getBoundingClientRect` på alle knapper/checkbokse) og klippet tekst (`scrollWidth` vs. `clientWidth`) på ni faser. `outputs/ugen-faar-dato/` blev igen overskrevet af `proever` og rullet tilbage med `git checkout`, samme kendte adfærd som i RAPPORT-314.

## Hvad er næste

1. Marc pusher 314 — ingen fund her bør stoppe det.
2. "ret"-knappen (22×20 px) og "Vis næste sæt"-checkboxen kan samles i en lille opfølgende ordre efter push, sammen med resten af F6–F14 fra KRITIK-288.
3. Springet forbi et sæt efter "ret" (se ovenfor) er en eksisterende begrænsning i `nextSetInSession`, ikke ny — tages op hvis den bliver et reelt problem for Marc, ikke noget der haster.
4. Yantra 315's løfterfigur (se `docs/KRITIK-314.md`s sidste afsnit) har et par ting der ser forkerte ud (armen/stangen, rygfoldet ved bund) — input til næste Yantra-ordre, ikke rettet her.

## Ærlige grænser

- Headless Chromium mod mock, ikke en rigtig telefon — ingen ægte touch-latenstid, ingen ægte kridtede fingre, ingen iOS/WebKit.
- "Gå til næste øvelse" er testet med en øvelse jeg selv tilføjede til min egen mock (findes ikke i den faste seed andre specs deler) — ikke en regression mod den faste seed, kun min egen probe.
- Løfterfigur-kritikken er ren visuel vurdering af fem SVG'er renderet til PNG, ikke en biomekanisk analyse — jeg kan ikke afgøre om tallene (grader, cm) er korrekte, kun om formen ser rigtig ud med trænerøjne.
- Målescripts lå i scratchpad og er ikke committet, samme mønster som ordre 292's kritik. Coach-siden, Fremgang og VideoCoach er slet ikke rørt i denne ordre.
