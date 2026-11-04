# Intensitet pr. uge — isoleret modul

Ingen entry, skærm, flagkonfiguration, CSS, query eller persistens ændres.
`IntensityView({ entropi2: true, exerciseLogs, asOf })` er en ukoblet React-leaf.
Alt andet end strikt `true` returnerer null før data/dato læses.

`weeklyIntensity(exerciseLogs, asOf)` er ren. `asOf` er obligatorisk: en gyldig
YYYY-MM-DD (hele den danske dag), eksplicit tidszonet ISO-tid eller Date (øjeblik).
Fire mandag–søndag-uger i Europe/Copenhagen vises, ældste først.

Caller leverer et autoritativt snapshot for præcis én atlet. Hver række bruger
exercise_logs-felterne id og/eller exercise_id + set_number, logged_at, weight,
reps_completed, skipped, _optimistic samt det **nye adapterfelt reference_e1rm**.
exercise_id er en programmeret øvelsesinstans; katalog-ID må ikke bruges.
Uden sætposition bruges id; uden id bruges øvelse + tidspunkt konservativt.
Identiske gentagelser tælles én gang; modstridende kopier udelades.

reference_e1rm er en eksplicit, uafhængig reference for samme øvelse/variant og
vægtenhed, kendt på sættets tidspunkt. Caller ejer referencevalg, datadækning,
atletafgrænsning, enheder og sammenfletning af lokal undo/historik. Dette modul
slår intet op og gætter hverken løftematch eller reference. Feltet findes ikke i
den nuværende logprojektion: ved senere kobling skal adapteren berige rækkerne.
Der beregnes ikke e1RM ud fra hvert sæts egne reps, da det ville gøre zonen til
en afledt repzone. Ingen historikreference opdateres med fremtidige resultater.

Hvert bekræftet, dateret sæt i perioden tæller i totalen. Positiv endelig vægt og
reference samt positivt helt antal gennemførte reps kræves for en zone.
Zoner: [0,70), [70,80), [80,90), [90,uendelig) procent; præcis 90 er øverste zone.
Vægt nul (fx kropsvægt) er ukendt; procenter over 100 bevares. Spring over,
optimistiske, fremtidige og ugyldigt daterede rækker udelades. Der filtreres ikke
på hovedløft, tunge sæt eller deload: fordelingen beskriver alle leverede sæt.

Andele har kun klassificerede sæt som nævner. Ukendte vises særskilt; ingen
klassificerede sæt giver null-andele. Tomt indlæst array er forskelligt fra
manglende data. Caller skal levere undefined under loading/error, ikke et
ufuldstændigt array. Ingen behandlingsråd, progression eller parathed udledes.

Test: node --test src/entropi2/analysis/intensitet/*.test.mjs
Testen importerer den faktiske model og visning; kun React-elementfabrikken
substitueres af den eksisterende syntetiske fixture. Ingen browser/layouttest.
