# Entropi abonnement — produktkort v1

Status: samlet kort over den lokale prototype, shadow-piloten og de åbne
produktbeslutninger. Det er ikke en go-live-plan. Ingen produktionsdata,
betaling eller 1:1-data må bruges, før de respektive punkter nedenfor er lukket.

| Del af kunderejsen | Lokal prototype / demo | Klar til shadow-pilot | Marc skal beslutte |
| --- | --- | --- | --- |
| **Gratis** | Ét startprogram, logning og simpel historik findes i den lokale app. | `sub_entitlements`/RLS-udkast afgrænser `free` til `start-2`; det skal køres og verificeres i shadow før det tæller som adgangskontrol. | Er gratisprogrammet permanent, tidsbegrænset eller kun en prøve? |
| **Member** | Programbibliotek, detaljehistorik og det lokale programvalg findes. Kunderejsedemoen viser e-mail → valg → uge 1 → uge-2-forslag. | Kun et gyldigt, tidsbegrænset `member`-entitlement må åbne member-programmer. Programversion og tildeling skal oprettes serverstyret; klienten må ikke gøre et preview til et program. | Hvilket bibliotek, hvilke priser/trial-regler og hvem vedligeholder versionerne? |
| **1:1 coaching** | Kun en tydelig produktgrænse: den eksisterende atletportal er et andet produkt. | Ingen abonnementstabel eller policy må bruge `profiles.role`; overgang gemmes ikke og deler ingen log/data automatisk. | Hvornår en frivillig overgang må tilbydes, og hvilke data der må deles efter særskilt samtykke. M8 (eksisterende rolle-eskalering) skal være løst før coach-adgang bygges. |
| **E-mail og konto** | `customer-journey.html` validerer kun en e-mail i hukommelsen; den sender og gemmer intet. Den lokale medlemsapp har separat konto-onboarding. | Pilot-appen har login mod separat shadow-klient og lokal session. Den bruger i dag e-mail + adgangskode, ikke magic link. | Endeligt login: magic link eller adgangskode, og hvilken invitation/udløbsoplevelse testeren skal have. Ingen åben signup i piloten. |
| **Onboarding** | Matcher deterministisk på mål, erfaring, 2–4 dage, udstyr samt squat-/dødløftvariant. Generel styrke respekterer et valgt variantvalg; styrkeløftfundament blokerer, hvis varianten er ukendt. | `sub_members` og versionslåst `match_input` er specificeret, men onboarding skriver endnu ikke sikkert til shadow. | V1’s endelige afvisningsgrænse: unge, skade/sygdom, graviditet, stævnepeak og rehab skal have stopvej — ikke automatisk program. |
| **Programlevering** | 2-, 3- og 4-dages reviewpakker og recepter er lokale. Kunden kan se passene, men demodatasættet er ikke en godkendt fjern-tildeling. | `sub_programs` + `sub_assignments` er designet til én uforanderlig konkret version pr. atlet. Kun en kontrolleret service-procedure må publicere/tilddele; RLS/immutability-migrationen er fortsat draft. | Godkend den første publicerbare programversion, dens progressionstekst og hvilke templates der reelt åbnes ved launch. |
| **Logning** | Den almindelige app logger hvert sæt på samme måde som Marcs arbejdsflow: én øvelse ad gangen, vægt/reps/RPE, forudfyldt fra sidste relevante sæt, fortryd sidste sæt, og et afbrudt pas ligger lokalt. | Pilot-repository kan læse eget program, synkronisere afsluttede pas idempotent og holde en lokal outbox ved netfejl. `sub_workouts`/`sub_workout_sets`-udkastet skal være kørt og verificeret i shadow. | Skal medlemmet også logge kropsvægt, readiness eller noter i v1? De må ikke snige sig ind som fortolket sundhedsdata. |
| **Uge 2 / adaptivitet** | Demoen beregner ét synligt forslag: først efter to sammenlignelige logs for samme hovedløft, repmål nået og RPE ≤ 7; ellers beholdes planen. Forslaget er +2,5 kg og kræver aktivt valg. | DRAFT `sub-09` gemmer forslag og append-only accept/afvisning separat fra den låste programversion; den er ikke migreret eller frontend-integreret. | Godkend den konkrete progression pr. hovedløft, mindste spring, hvornår et sæt tæller, og om alle forslag skal gennem en menneskelig reviewperiode i piloten. |
| **Samtykke og sikkerhed** | V1-afgrænsningen siger ingen automatisk vurdering af smerte, skade, sygdom, søvn, trivsel, medicin, peak eller rehab. Der findes endnu ikke et egentligt samtykke-/stopskærmbillede. | Shadow-testen har stopregler: forkert data, mistede færdige data, forkert projekt eller variantkonflikt stopper testen. | Godkend kort samtykketekst, databehandlingsgrundlag, minimumsalder og en kontaktvej ved “min situation passer ikke”. |
| **Opsigelse og eksport** | Ikke bygget. Lokal cache kan ryddes, men det er ikke kontoopsigelse eller dataeksport. | Ikke bygget. Efter udløb skal eksisterende tildelt program stadig kunne læses ifølge RLS-designet, mens member-biblioteket lukkes. | Retention efter opsigelse, eksportformat/tidsramme, sletning og om adgang til aktivt forløb fortsætter eller stopper ved periodens udløb. |

## Hvad kunden reelt kan afprøve nu

1. **Lokalt:** `customer-journey.html` viser den fulde oplevelse uden konto eller
   fjernlagring: e-mail-skærm, programmatch, uge-1-pas og et begrundet uge-2-valg.
2. **Shadow, når migrations og tildeling er kørt:** inviteret konto → sikkert login
   → én allerede tildelt programversion → eget pas/historik → idempotent synk.
3. **Ikke endnu:** selvbetjent registrering, betaling, reelt programvalg der
   tildeler, vedvarende adaptiv ændring, coaching-overgang, opsigelse eller eksport.

## Næste produktmæssige rækkefølge

1. Lås testens første programversion og progression med Marc.
2. Kør og verificér `sub-01`–`sub-11` **kun i shadow** efter
   `subscription-shadow-backend-safe-path.md`, inkl. invitation/login-gate,
   immutability, serverstyret tildeling og atomisk workout-persistens.
3. Forbind den eksisterende login/logning med den tildelte version og test én
   person gennem ét helt pas.
4. Først derefter: forbind den allerede specificerede DRAFT-persistens for et
   eksplicit accepteret/afvist uge-2-forslag.
5. Betaling, åben registrering, eksport/sletning og 1:1-overgang er separate
   launches — ikke skjulte konsekvenser af piloten.
