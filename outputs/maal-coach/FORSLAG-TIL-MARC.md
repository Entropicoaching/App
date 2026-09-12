# Forslag til Marc (Ordre 130)

Højst ti linjer der kræver din dom — resten er rettet eller ligger i EFTER.md.

1. **Kontrast** — hver coach-skærm har 3-16 "serious" kontrast-fund (axe), formentlig den lyseste grå tekst (#4a4844/#7a7770) på mørk bund (#141410/#1c1c18). Bruges i hele appen, ikke kun coach-siden — at hæve den kræver en designbeslutning om nye farvetokens, ikke bare mere padding.
2. **Video-review-knapperne** (Godkend/Ugyldig/Del i analyse-fanen) er 25-29px høje i en tæt række af 2-3 knapper. At løfte dem til 44px uden at ramme hinanden kræver at rækken lægges om (fx to linjer eller større kort) — ikke kun mere padding.
3. Samme mønster for "Åbn"-knappen pr. video i køen (53×29px) — 3 tilfælde stadig tilbage i EFTER.md.
4. Dashboard-chunken er nu 241 KB (var 342 KB) efter at videoer/program/indbakke blev lagt i lazy-chunks. Skal 'log'/'stævne'/'kost'-fanerne (mindre, men stadig et par hundrede linjer hver) også splittes, eller er 241 KB fint som coachens faste bundlinje?
5. Ordren nævner "Coach Briefing" som ét af de tre tunge skærmbilleder — jeg har tolket det som Indbakken (coachPriority/coachInboxState), men den er kun ~170 linjer og langt fra så tung som video/program. Er det den rigtige skærm, eller mangler der en egentlig "briefing"-visning?
