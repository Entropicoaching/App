# Kritik — ordre 314 (Dagens pas: "hvilket sæt er jeg på"), før push

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Anbefaling: push, fordi intet fund er en sikker fejl

Jeg har logget fire sæt i træk som en atlet der ikke læser (roder med plus/minus, godkender uden at kigge, retter et allerede klaret sæt midt i øvelsen, går til næste øvelse, går tilbage via Program-fanen, prøver offline) på 390×844 og 360×780. Intet af det jeg fandt får en atlet til at logge et forkert sæt, miste data eller sidde fast. To touch-target-fund og én bekræftet (men allerede kendt) grænse — ingen af dem bør blokere push.

## Fund, sorteret efter alvor

1. **"ret"-knappen på et klaret sæt er 22×20 px (ret efter push, moderat).** Ny i 314 (`DagensPasCard`, linje 399-404 i `src/AthleteView.jsx`). Den sletter log-rækken og genåbner sættet MED ÉT TRYK — ingen bekræftelse, ingen fortryd-af-fortrydet. På en ~310 px kortflade med tre-fire klarede sæt-linjer stablet tæt, med en atlet der har kridt på fingrene, er 22×20 px under det halve af 44 px-reglen appen selv følger andre steder (Godkendt, plus/minus, Fortryd er alle ≥44 px). Et fejltryk er billigt at rette (sættet skal bare logges igen), men det sker uden varsel. Skærmbillede: `outputs/kritik-314/atlet-390x844-03-efter-godkendt-saet3.png` (tre "ret"-knapper synlige).
2. **"Vis næste sæt"-checkboxen (label 84×23 px, selve boksen 13×13 px) er også under 44 px (kosmetisk/lav).** Ny i 314. Lav frekvens (slås til/fra højst én gang, ikke pr. sæt), så alvoren er lav — men labelen kunne nemt få `minHeight: 44px` som resten af kortet. Skærmbillede: `outputs/kritik-314/atlet-390x844-00-start.png`.
3. **Bekræftet, IKKE nyt: "ret" på et tidligere sæt gemmer et senere sæt "usynligt", og gen-godkendelse springer stille forbi det (kosmetisk).** RAPPORT-314's "Ærlige grænser" beskriver dette teoretisk — jeg har nu klikket det igennem: log sæt 1-3, tryk "ret" på sæt 2 → kortet viser "Sæt 2/4" og sæt 3's linje er væk (ingen antydning af at den stadig findes). Tryk "Godkendt" igen på sæt 2 → kortet springer direkte til "Sæt 4/4", uden at atleten nogensinde ser sæt 3 bekræftet igen. Data er ikke tabt (sæt 3 ligger stadig i basen), men en atlet der bruger "ret" midt i en øvelse kan blive forvirret over det tilsyneladende spring. Samme begrænsning i `nextSetInSession`, ikke noget Vaidya indførte eller kan nå i denne ordre. Skærmbilleder: `outputs/kritik-314/atlet-390x844-04a-efter-ret-saet2.png` og `...-04b-efter-gen-godkendt-saet2.png`.

**Holdt (målt, ikke gættet):**
- **F4 (rækken der brækkede) er lukket** — `document.documentElement.scrollWidth` oversteg aldrig viewport-bredden på noget tidspunkt i gennemgangen, på hverken 390 eller 360 px, heller ikke efter roderi med plus/minus eller efter "ret".
- **Kun det aktuelle sæt har felter** — bekræftet ved hvert af de fire sæt; klarede sæt stod som kompakte linjer, næste sæt som højst én dæmpet linje.
- **"Sæt N af M" fulgte altid det aktuelle sæt**, også efter "ret" og efter skift til ny øvelse.
- **Fortryd sidste sæt virker** — knappen er 314×44 px (opfylder selv 44 px-reglen), sletter og genåbner korrekt, ingen dublet-række bagefter (verificeret via mockens `exercise_logs`-tabel).
- **Offline-køen fra 293 virker stadig på Dagens pas.** "Godkendt" mens offline viser sættet med det samme (optimistisk), og "☁ 1 sæt gemt lokalt" dukker op efter ca. 4 sekunder (queueWrite's fire forsøg med backoff — IKKE med det samme, min første, hurtigere probe fejlagtigt rapporterede "ikke set", men det var min egen for korte ventetid, ikke en app-fejl). Online igen → sendes automatisk, én række i basen, ingen dublet. Skærmbilleder: `outputs/kritik-314/offline-01/02/03-*.png`.
- **Ingen tekst klippet** — headless-scan af `scrollWidth > clientWidth` på alle tekstelementer gav ingen fund på nogen af de ni faser jeg screenshottede.
- **Gå til næste øvelse og tilbage:** Da Squat var færdiglogget, gik kortet automatisk til Bænkpres (egen udvidet mock, ikke en del af den faste seed). Program-fane → Hjem-fane igen viste korrekt samme sæt/øvelse, uændret. Skærmbilleder: `outputs/kritik-314/atlet-390x844-07/08a/08b-*.png`.

## Hvad jeg IKKE kunne teste

- Ægte finger/tommel på en fysisk telefon — kun headless klik, ingen ægte touch-latenstid eller ægte kridtede fingre.
- Frontal-plan (knævalgus, fodens vridning) — figurerne og appens skærmbilleder er kun set fra siden/skærmen, ingen video af en ægte atlet.
- Fremgang (F2 fra KRITIK-288, `.limit(4000)`) er stadig uafklaret — ordren bad mig kun læse "Anbefaling"-afsnittet i KRITIK-288, ikke gense hele kritikken; jeg har ikke testet Fremgang i denne ordre.
- Coach-siden er slet ikke rørt i denne kritik (ordren peger kun på Dagens pas).

## Yantra 315 — den nye løfterfigur, coach-øjne (input til næste Yantra-ordre, ikke rettet her)

Set i `entropi-loeftmodel/outputs/figur/` (5 stillinger, før/pindfigur og efter/silhuet):

- **Stang/arm ser forkert ud i ALLE fem stillinger.** Armen tegnes som en skarpt bøjet, flag-lignende form der ender oppe ved øret/tindingen — ikke en stang der hviler på ryggen/nakken med hånden ude ved siden. Ser ud som om atleten bærer noget over hovedet, ikke en squat-opstilling.
- **Ryggen folder for meget frem ved bund og sticking point.** Torso-vinklen går fra ~8° (opstilling) til ~45° (bund/sticking point), og silhuetten viser en tydelig rund forlæns bøjning, hovedet langt foran knæet — ligner en "good morning"-fold mere end en presset, relativt oprejst squat-ryg.
- **Foden er en tynd, spids kile** ved bund/sticking point — hælsiden ser tynd/løftet ud frem for fladt plantet; svært at se om hælen holdes nede.
- **Knæet ser fornuftigt ud** i sagittalplan (sporer frem over foden uden at se overstrakt ud) — men kan ikke vurdere indadfald (valgus), da figuren kun er set fra siden.

## Verificering

Én ubrudt `npm run proever`, port 8991 checket først (fri): **84/84 grønne** (0 fejl, 0 sprunget over) — uændret fra Vaidyas egen kørsel i RAPPORT-314. `npm run lint`: ren.

Intet rettet i denne ordre. Ingen atletdata, ingen push.
