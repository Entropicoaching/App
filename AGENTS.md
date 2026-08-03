# Entropi-app: faste arbejdsregler

Dette repository er Entropicoachings produktionsapp. Arbejd roligt, afgraenset og bevisbaseret.

## Roller

- Sol planlaegger risikofyldte opgaver, fastlaegger acceptkriterier og reviewer resultatet.
- Den lokale Ollama-worker udfører kun det konkrete opgavekort, der er givet til den.
- Marc tester brugeroplevelsen. Marcs visuelle vurdering er facit for flow og design.

## Ufravigelige regler

1. Udfør kun én afgraenset ændring ad gangen. Udvid ikke opgaven på eget initiativ.
2. Kør kun `git commit`, `git push` eller deploy efter Marcs udtrykkelige godkendelse. Supabase-migrationer og ændringer af secrets kræver fortsat særskilt, eksplicit godkendelse.
3. Rør aldrig `.env*`, credentials eller produktionsdata.
4. Bevar eksisterende og ukendte ændringer. Brug aldrig destruktive git-kommandoer.
5. Start skrivearbejde på en arbejdsbranch, aldrig direkte på `main`.
6. Kør de tests, der står på opgavekortet. Gæt ikke, at en ændring virker.
7. Atletoplevelsen skal være enkel, mobilvenlig og ført trin for trin. Avancerede værktøjer er coach-only.
8. Atlet- og brandtekst er kun udkast i Marcs menneskelige tone; Marc godkender den endelige ordlyd.

## VideoCoach

- `public/videocoach.html` er den version, der ligger i app-repositoryet.
- Der findes også en historisk udviklings-master i `C:\Users\Entropi\Desktop\entropi-agent\videocoach.html`.
- Antag ikke, at den ene automatisk er nyere end den anden. Sammenlign dem før arbejde og følg opgavekortets eksplicitte kildefil.
- Overskriv eller synkronisér aldrig de to filer automatisk.
- Ændringer i bartracker/computer vision skal først reproduceres og bevises i en Node-rig. Alle eksisterende relevante rigs skal stadig være grønne før portering.
- Efter hver ændring i den selvstændige HTML skal scriptblokken syntakstjekkes med `node --check`.
- Intet VideoCoach-arbejde deployes, før Marc har testet og udtrykkeligt sagt go.

## Supabase og identitet

- `athletes.id` er ikke det samme som `athletes.user_id`.
- RLS, migrationer og datakontrakter er vurderingstungt arbejde og kræver en Sol-plan og særskilt godkendelse.
- En lokal worker må gerne analysere eller skrive et uanvendt migrationsudkast, når opgavekortet siger det, men må aldrig køre migrationen.

## Standardverifikation

- React-app: kør de fokuserede checks fra opgavekortet og som minimum `npm run build`, når kode er ændret.
- Brug målrettet ESLint på ændrede filer, hvis den fulde lint har kendte baseline-fejl.
- VideoCoach: kør opgavekortets rigs plus script-udtræk og `node --check`.
- Rapportér præcist, hvad der blev kørt, resultatet og hvad der ikke kunne verificeres.

## Aflevering

Afslut altid med:

1. Ændrede filer og hvorfor.
2. Kørte checks og deres resultat.
3. Kendte risici eller antagelser.
4. Hvad Sol skal reviewe.
5. Bekræftelse på, at intet er committed, pushed, deployet eller migreret.
