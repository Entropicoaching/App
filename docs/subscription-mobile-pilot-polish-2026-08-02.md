# Mobil-pilot polish — 2. august 2026

Scope: kun synlig kunderejse i abonnements-piloten. Ingen produktregler, programlogik, shadow-binding, database eller integrationer er ændret.

Audit ved 390 × 844 px:

- Startskærmen var visuelt klar, men den viste ikke, at e-mail blot er begyndelsen på en kort lokal pilotrejse.
- Programvalg og baseline-skærm havde ikke et fælles, synligt trinforløb.
- Under sætlogning viste topbaren kun øvelse-positionen; den samlede sessionstatus og betydningen af “Afslut pas” var først tydelig nederst.

Implementeret:

- Et diskret, konsekvent “Trin n af 4” på start, programvalg, baseline og den lokale uge-1-check-in.
- En levende, tekstlig passtatus (loggede og resterende sæt) samt semantisk progressbar i den normale træningslogger.
- Afslut-knappen siger nu eksplicit, hvor mange sæt der er logget. Den udfører præcis samme handling som før.

Verifikation:

- Lokal customer-journey indlæst ved 390 × 844 px; e-mail → programforslag skifter uden hvid skærm.
- Kør `npm run lint:subscription`, `npm run test:subscription` og `npm run build:subscription-pilot` før review.
