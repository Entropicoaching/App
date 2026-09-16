# Valg — Ordre 256, commit 2: "Gemmes på din konto" ikke afprøvet mod live

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Grænsen der stoppede commit 2

Commit 2 beder om en headless, indlogget tur mod produktionen
(`app.entropicoaching.dk`) med "Marcs egen coach-rolle i e2e": åbn Volumen
pr. muskelgruppe, bekræft "Gemmes på din konto", lav én rettelse på en
opdigtet øvelse, åbn i en ny, ren browserkontekst, bekræft at den er der,
slet den igen.

Der findes ingen produktions-login-legitimationsoplysninger noget sted i
dette træ, i `.env.e2e`/`.env.local` (som `AGENTS.md` under alle
omstændigheder forbyder at læse, vise eller ændre), i miljøvariabler, eller
som en gemt Playwright `storageState`. Det er ikke en ny opdagelse — ordre
131, 210, 228 og 248 har hver for sig allerede bekræftet det samme: **der
findes ingen testkonto mod produktion**, og at oprette én ville selv være en
Supabase-skrivning mod produktion (en ny bruger/rolle), som ingen ordre —
denne iberegnet — har mandat til uden Marcs eksplicitte, navngivne
godkendelse. `e2e`s egen "testrolle" (`e2e/fixtures.mjs`) er en seedet rolle
i mock-Supabase (`e2e/mock-supabase.mjs`), ikke en ægte produktionsbruger —
den findes ikke på `app.entropicoaching.dk`.

Ordrens egen regel for netop denne situation: "Kan det ikke gøres uden
rigtig atletdata, så sig præcis hvad der mangler og stop dér." Det er hvad
denne commit gør. Intet login er forsøgt, ingen produktions-Supabase-skrivning
er lavet, ingen opdigtet øvelse er nogensinde nået at blive oprettet.

## Et andet fund undervejs: er migrationen overhovedet kørt?

`docs/OVERLEVERING.md` (skrevet ordre 239, samme dag som migrationen
angiveligt blev kørt) siger udtrykkeligt migration 209
(`exercise_muscle_overrides`) er **"IKKE kørt mod produktion — venter på
Marcs direkte, navngivne godkendelse"**. Ordre 256 selv antager den ER kørt
("kørt 15. sep"). Begge kan være sande (godkendelsen kan være kommet efter
`OVERLEVERING.md` blev skrevet, senere samme dag) — men intet i dette træ
bekræfter det ene eller det andet, og uden produktionslogin (se ovenfor) er
der ingen måde at bekræfte det herfra. Dette er en selvstændig grund til at
"Gemmes på din konto"-linjen ikke kan bekræftes nu, uafhængigt af
login-blokaden.

## Hvad der blev set (tabellen ordren beder om)

| Trin | Set |
| --- | --- |
| Login som coach mod produktion | Ikke forsøgt — ingen legitimationsoplysninger findes (se ovenfor) |
| Åbn "Volumen pr. muskelgruppe" | Ikke nået — kræver login |
| Bekræft linjen ("Gemmes på din konto" vs. "...på denne enhed") | Ikke nået — kræver login, og uafklaret om migrationen er kørt (se ovenfor) |
| Lav én rettelse på en opdigtet øvelse | Ikke nået — kræver login |
| Åbn i ny, ren browserkontekst, bekræft rettelsen er der | Ikke nået — kræver login |
| Slet rettelsen igen | Ikke nået — kræver login |

## Hvad der mangler, præcist

En ægte produktions-coach-konto (e-mail + adgangskode, eller en gemt
Playwright `storageState` fra et ægte login) som en ordre eksplicit må
bruge til headless test mod `app.entropicoaching.dk`. Den findes ikke i dag.
Oprettelse af én kræver Marcs direkte godkendelse (jf. `AGENTS.md` og
CLAUDE.local.md's Supabase-grænse) — en fremtidig ordre kan navngive det
eksplicit, hvis Marc ønsker denne klasse af tjek gjort fast.
