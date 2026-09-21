**main kan pushes: ja**

# Rapport — ordre 301: Indbakken viser automatiseringsfejl uden atlet (to blokke)

Planet: coaching · Spor: spor-check-in-bevist-over-en-hel-blok-56aed8

## Det Marc mærker i appen efter push

1. **Coach Briefing viser nu, når en automatisering fejler.** n8n's Error Monitor skriver en metadata-række i `automation_alerts`; appen viser hver uløst række som "Automatisering fejlede" med workflow-navn, node og hvor længe siden ("for 2 timer siden"). Før droppede Indbakken dem stille, fordi de ikke har en atlet. Mailen er nu kun sikkerhedsnet.
2. **De tæller med** i "Kræver dit blik" på forsiden (antal og de øverste rækker). Et tryk på en fejl dér fører til Indbakken.
3. **"Markeret som set"** på rækken fjerner den. **Det virker først, når SQL-filen er kørt** (se "Hvad er næste"). Indtil da bliver rækken stående, og der står ved rækken: "Kunne ikke markere som set: databasefunktionen findes ikke endnu. Fejlen står stadig i indbakken."
4. **Rækkefølge:** under atletsignaler med afvigelse (alert) og ventende beskeder/videoer, over de øvrige træningssignaler (fx "Ingen logs"/træningsmængde). Med ingen fejl ser Indbakken ud som i dag.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja. Det lukker et hul, hvor en fejlet automatisering var usynlig for coachen, og gør Indbakken til det ene sted at se, hvad der kræver blik.

## Gren

Gren `indbakke-automation-alerts`, forgrenet fra `main` (`918815f`).

- `dd13bad` blok 1: signalet og visningen (hentning, række-type, "Markeret som set", SQL-filen)
- denne commit: blok 2 (mock-udvidelse, enhedstest, headless prøve, `proever.mjs`, en venstrejustering af rækken og denne rapport)

Arbejdstræet er rent. Ingen push, ingen migration koert, ingen ny tabel, ingen atletdata, ingen skrivning mod Supabase. Eneste kontakt med produktion var ét skrivebeskyttet skema-opslag (kolonnenavne og typer for `automation_alerts`, ingen rækker) for at sikre, at SQL-filen passer (`id` er `uuid`).

## Hvad ændret

**Blok 1**
- `src/automationAlerts.js` (ny): filtrering af uløste rækker, dansk relativ tid ("lige nu", "for 1 time siden", "for 3 dage siden", dato efter to måneder), detaljelinjen ("Node: … · for 2 timer siden") og en læsbar fejltekst, også når RPC'en mangler (`PGRST202`/`42883`).
- `src/coachPriority.js`: `buildCoachPriorityItems` tager `automationAlerts` og laver rækker af typen `automation` **uden** atlet-opslaget, som de andre typer kræver. Rang 2 (alert-signaler 0, beskeder/videoer 1, øvrige signaler 3). "Næste opgave" (`coachPriorityQueueContext`) og mailens `?focus=next` (`coachInboxFocusDecision`) springer dem over, fordi de ikke har en profil at åbne.
- `src/Dashboard.jsx`: `fetchAutomationAlerts` (uløste rækker via `resolved_at is null`, nyeste først, højst 50) kører med i hver Indbakke-opdatering; `handleAutomationAlert` kalder `resolve_automation_alert_v1`. Rækken fjernes først, når kaldet lykkes; ved fejl står den, og fejlen vises både ved rækken og som flash. Fejl ved hentning giver samme "delvist opdateret"-signal som de andre kilder.
- `src/dashboard/IndbakkeView.jsx`: egen række (workflow, chip "Automatisering fejlede", node og tid, knappen "Markeret som set"). Lange navne ombrydes.
- `supabase/sql/resolve-automation-alert-v1.sql` (ny, **ikke kørt**): `resolve_automation_alert_v1(alert_id uuid) returns boolean`, `SECURITY DEFINER`, kun `authenticated` (anon og public tilbagekaldt, tjekket i filen), kun uløste rækker. Den kræver desuden at kalderen er coach (`profiles.role = 'coach'`), se "Ærlige grænser".

**Blok 2**
- `e2e/mock-supabase.mjs`: RPC-handleren `resolve_automation_alert_v1` (samme adfærd som SQL-filen) og en ny fejlmode `missing-function` (PostgREST's 404 `PGRST202`).
- `src/automationAlerts.test.js` (ny, 9 tests): en række uden `athlete_id` droppes ikke længere for denne type, men stadig for signal/video; løste rækker skjules; rækkefølgen alert → besked → automatisering → øvrigt signal; ældste først; uændret kø uden fejl; "Næste opgave" og fokus-link springer dem over; relativ tid; fejltekst.
- `e2e/coach-automation-alerts.spec.mjs` (ny) + `npm run e2e:coach-automation-alerts`, og som nr. 12 i `scripts/proever.mjs`.

## Testresultat

- `npm run lint`: ren. `npm run build`: ok.
- `npm run verify:coach-priority` og `verify:coach-inbox-flow`: grønne (køens eksisterende rækkefølge og livscyklus er uændret).
- `node --test src/automationAlerts.test.js`: 9/9.
- **Headless prøve** (`e2e/coach-automation-alerts.spec.mjs`, mod mock-Supabase og lokal vite, 390×844 og 1280×900): mock-tabellen har to uløste fejl og én løst.
  - Forsiden viser "2 åbne ting"; Indbakken viser de to uløste rækker med rigtig tekst ("Node: Upload til lager · for 2 dage siden", "… for 2 timer siden"), aldrig den løste.
  - Målt i pixels: ingen overlap mellem rækkerne, intet indhold uden for sin række, ingen vandret rulning.
  - "Markeret som set" fjerner rækken, og mockens `resolved_at` er sat på præcis den række; den anden er urørt.
  - Med en injiceret "funktionen findes ikke"-fejl bliver rækken stående, fejlen læses ved rækken, og intet er skrevet. Næste tryk lykkes.
  - Efter den sidste kvittering er Indbakken ordret den samme (tekst, uden klokkeslæt og flash) som mod en mock hvor tabellen aldrig har haft rækker. Ingen browserfejl på nær den ene bevidst injicerede 404.
  - Jeg så skærmbillederne igennem; det afslørede, at teksten i rækken var centreret i stedet for venstrejusteret som de øvrige rækker. Det er rettet, og prøven er kørt igen.
- **Én ubrudt `npm run proever`: 82/82 grønne** (0 fejl, 0 sprunget over), inkl. den nye prøve og de 9 nye tests.

## Hvad er næste

1. **Marcs ja til SQL-filen**, så kører Dhruva `supabase/sql/resolve-automation-alert-v1.sql` mod produktion. Først derefter virker "Markeret som set" i den rigtige app. Filen er kun en funktion (ingen tabel, kolonne eller policy ændres) og har en indbygget kontrol af rettighederne.
2. Marc merger og pusher `indbakke-automation-alerts`.
3. Efter SQL og push: åbn Indbakken med en rigtig fejlrække i `automation_alerts` og tryk "Markeret som set" én gang. Det er den ene ting, der ikke kan bevises mod mocken.

## Ærlige grænser

- **"Markeret som set" er ikke prøvet mod den rigtige funktion.** Mocken spejler SQL'en, men SQL-filen er ikke kørt og ikke prøvet mod Postgres. Tabelkolonnerne er tjekket mod skemaet, men RLS og selve funktionen er ikke afprøvet.
- **Tilføjelse ud over ordren:** funktionen kræver, at kalderen er coach. Ordren sagde "kun for authenticated"; da tabellen er læsbar for alle authenticated (også atleter), ville en atlet ellers kunne kvittere en fejl. Vil Marc have den løsere, er det ét `if` i SQL-filen.
- **Rækkefølgen er min tolkning.** Ordren sagde "under atletsignaler med afvigelse, over 'Ingen logs'". Jeg har lagt fejlene på rang 2: under alert-signaler og under ventende beskeder/videoer, over øvrige træningssignaler. Ønsker Marc dem over beskeder, er det ét tal i `coachPriority.js`.
- **"To fejl, én løst"** har jeg læst som to uløste og én løst række, så prøven kan vise flere rækker ad gangen og bevise, at den løste ikke vises.
- **Ingen mail fra appen, og ingen ændring af n8n.** Appen læser kun tabellen; jeg har ikke set rigtige rækker i den (kun skemaet).
- **Tiden er relativ til, hvornår Indbakken sidst er tegnet.** Den opdateres ved hver opdatering (fokus, 5-minutters-intervallet, "Opdater"), ikke sekund for sekund.
- **Hentes højst 50 uløste rækker.** Er der flere, ses de nyeste 50, og resten dukker op, efterhånden som de kvitteres.
- Alt er kørt headless mod mock-Supabase og lokal vite, ikke på en rigtig telefon og ikke mod produktion. `proever` regenererer tre sporede skærmbilleder under `outputs/ugen-faar-dato/`; dem har jeg rullet tilbage, så de ikke er med i commit'en.

main kan pushes: ja
