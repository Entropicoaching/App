# Entropi abonnement — mandags-roadmap

Dato: 1. august 2026. Målet er et afgrænset, ærligt pilotforløb for én testperson — ikke en offentlig lancering.

## Den vigtige skelnen

Der er to forskellige ting, der kan ske mandag:

1. **Lokal brugstest:** Testpersonen gennemfører den browserlokale demo med fake e-mail og lokal data. Det kan bekræfte forståelse, flow og friktion, men ikke konti, sikker lagring eller medlemsadgang.
2. **Lukket shadow-pilot:** Testpersonen logger ind, får en tidsbegrænset adgang og gemmer sin egen træning i shadow-projektet. Det er det rigtige pilotmål, men det må kun ske efter alle nedenstående backend- og mobilgates er grønne.

Betaling er **ikke** et krav for én gratis, lukket pilot. Medlemsadgang kan sættes manuelt med udløb. Betaling, checkout og offentligt signup kommer først efter piloten.

## Status nu

| Status | Hvad det konkret betyder |
| --- | --- |
| Færdigt lokalt | Onboarding, variantvalg, e1RM fra 1RM eller tungt sæt + RPE, uge 1-logning, forsigtigt uge-2-forslag og reset/reload er samlet i browseren. |
| Færdigt afgrænset | Full gym er den eneste automatiske lane. 2 og 3 ugentlige dage er det rigtige første testområde. Hjemmetræning er ikke falsk automatiseret. |
| Ikke færdigt | Rigtig konto, serverdata, entitlement, assignment, mobiltest på fysisk telefon, og den live persistence som en testperson forventer. |

Lokal evidens: 83 unit tests, 20 smoke checks, 160 review-ready scenarier. 416 af 576 kombinationer går bevidst til manuel review.

## Hvad baseline allerede gør — og hvad den endnu ikke gør

Baseline er ikke kun et enkelt 1RM-felt. Den kan tage et repræsentativt tungt sæt med vægt, reps og RPE, udlede e1RM og beregne en konservativ, afrundet startvægt pr. hovedløft. Den kræver også eksplicit high-/low-bar og conventional/sumo ved styrkeløft.

Det adaptive næste trin er ikke at lade én god eller dårlig dag skrive programmet om. Det skal baseres på to komplette, sammenlignelige eksponeringer med faktiske reps, RPE, ingen skip og rimelig afvigelse fra planen. Derefter må appen kun foreslå: **behold**, **lille stigning** eller **mere data kræves**. Atleten accepterer aktivt forslaget.

## Mandag: den mindst risikable, værdifulde afgrænsning

**Testpersonens scope:** full gym · general strength eller powerlifting · 2 eller 3 træningsdage · én tydelig squat- og dødløftvariant · ét repræsentativt baseline-sæt pr. hovedløft.

Det er nok til at teste den egentlige medlemsværdi: om systemet kan omsætte input til en forklarlig startplan, indsamle brugbar data og komme med et forsigtigt næste forslag. Det er ikke endnu et løfte om at programmere alle.

## Hvad skal være grønt før en rigtig testperson mandag

### A. Produkt og progression

- [ ] Golden cases for baseline: 1RM, flerrepssæt, RPE, afrunding og ugyldige data.
- [ ] Golden cases for uge 2: behold, lille stigning, mere data og afvisning efter manglende sæt, skip eller høj RPE.
- [ ] Én valgt pilottemplate er fagligt gennemgået fra uge 1 til uge 2 — ikke kun genereret.
- [ ] UI siger klart, hvorfor planen foreslår behold/stigning/mere data.

### B. Shadow, identitet og data

- [ ] Bekræft at kun shadow-projektet `maxhsefxbrvsgolscqwh` er bundet; forkert eller manglende binding skal fejle lukket.
- [ ] Kør og verificér den eksisterende DRAFT migrationsti kun i shadow, én trinvis gate ad gangen.
- [ ] Bevis RLS for anonym, ejer, anden bruger og en bruger der selv har sat `profiles.role='coach'`.
- [ ] Invitation, tidsbegrænset `member`-adgang og præcis én programassignment til testpersonen.
- [ ] Frontend bruger kun subscription-sessionen og kan genindlæse/teste historik fra shadow.

### C. Test på fysisk mobil

- [ ] iPhone- og Android-gennemgang: onboarding, nummerfelt/tastatur, zoom, aktivt sæt, RPE, afslutning og genindlæsning.
- [ ] Test mindst én langsom/offline overgang. Appen må sige "afventer", aldrig lade som om noget er gemt.
- [ ] Test som anden bruger i samme browser: ingen lokale drafts eller historik må krydse konto-grænsen.

Hvis ét punkt i B eller C ikke er grønt, bliver mandag en **lokal brugstest**, ikke en rigtig shadow-pilot.

## Kan bevidst fake-løses i første pilot

| Funktion | Pilotløsning | Ikke tilladt at påstå |
| --- | --- | --- |
| Betaling | Ingen betaling. Marc giver én gratis, tidsbegrænset member-adgang manuelt. | At abonnement, fornyelse eller opsigelse er klar. |
| Support | Direkte kontakt til Marc, og export af lokal feedback. | Skalerbar kundesupport. |
| Programudvalg | Én verificeret full-gym lane med 2–3 dage. | Automatisk program til alle mål, hjemmegym eller 4 dage. |
| Progression | Forslag med eksplicit accept og forklaring. | Autoregulerende træner eller garanti for styrkefremgang. |
| Design | Mobilreview af udvalgt flow. | PWA/offline-app eller App Store-klar app. |

## Blokeret af beslutning, credential eller database

| Blokering | Ejer | Hvad der skal ske |
| --- | --- | --- |
| Korrekt shadow-binding | Marc + autoriseret backend-opgave | Bekræft lokal binding til `maxhsefxbrvsgolscqwh`; eksisterende `.env.local` må ikke bruges, hvis ref er forkert. |
| Migrationer og RLS | Autoriseret backend-opgave | Kør DRAFT-stien i shadow og dokumentér hver gate. Ingen produktionsdatabase. |
| Testkonto og adgang | Marc/Auth-operatør | Opret én testkonto, giv member til 31.12.2026 og tildel én konkret programversion. |
| Betaling | Marc | Bevidst udsat. Ikke en blokering for gratis pilot, men blokering for salg. |
| Offentligt hostnavn/deploy | Marc | Ikke nødvendigt for lokal brugstest; nødvendigt før en ekstern, stabil beta. |

## Efter mandag

1. Sortér pilotfund: P0 (stop), P1 (data/forvirring), P2 (friktion), P3 (forbedring).
2. Ret kun fund fra reelle observationer; behold en stabil baseline, så læringen kan sammenlignes.
3. Udvid én lane ad gangen: først den valgte full-gym template, derefter flere frekvenser/erfaringsniveauer. Hjemmetræning først efter præcis udstyrsprofil.
4. Før betaling: lifecycle (udløb/opsigelse), eksport/sletning, supportgrænse, programversionering og driftsmonitorering.

## Mandagsbeslutning

Mandag kan med fordel være et konkret mål, men ikke en dato der tvinger en falsk release frem:

- Hvis A + B + C er grønne: **én lukket shadow-pilot**.
- Hvis B eller C mangler: **én lokal brugstest med samme testscript**, mens backend-gates færdiggøres.

Den rigtige næste handling er at gøre den adaptive baseline/progression helt testbar og forklarlig, samtidig med at shadow-gaten afklares. Det er den korteste vej til et produkt, der giver mere end et statisk program.
