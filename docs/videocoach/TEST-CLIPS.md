# Test-klip til trackeren

Vil du se hvordan trackeren rent faktisk klarer sig på en RIGTIG video (ikke det
tegnede testklip)?

1. Læg en videofil i `test-clips\` (mp4 eller mov — telefonens eget format er
   fint, den konverteres automatisk om nødvendigt).
2. Kør `npm run verify:videocoach-clip`.
3. Læs tabellen: frames sporet/sprunget over, ms pr. frame, tid mod afspillet
   varighed, afvigelse (mean/max px) og antal hop — pr. gentagelse.

Ingen JSON, ingen koordinater. Stangens startpunkt og gentagelserne findes
automatisk. Skriver du alligevel en `<samme-navn>.meta.json` ved siden af
klippet, vinder dens felter over automatikken (se toppen af
`scripts/verify-videocoach-clip.mjs` for formatet) — det er kun nødvendigt
hvis automatikken gætter forkert.

Et sæt på 3-5 gentagelser giver et mere sigende svar end ét enkelt løft: med
kun én gentagelse er der intet "første/midt/sidste" at sammenligne — bænken
tester så det samme vindue igen. `test-clips\` er git-ignoreret — klippet
bliver aldrig committet.
