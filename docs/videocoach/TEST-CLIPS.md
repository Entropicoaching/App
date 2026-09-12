# Test-klip til trackeren

Vil du se hvordan trackeren rent faktisk klarer sig på en RIGTIG video (ikke det
tegnede testklip)?

1. Læg én eller flere videofiler i `test-clips\` (mp4 eller mov — telefonens
   eget format er fint, den konverteres automatisk om nødvendigt).
2. Kør `npm run verify:videocoach-clip` — kører ALLE klip i `test-clips\`
   (ikke kun det alfabetisk første), én fuld rapport pr. klip plus én
   sammenfatningslinje pr. klip til sidst.
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

## To klip der lukker resten (ordre 127)

To optagelser, lagt i `test-clips\`, kører automatisk med ovenstående:

1. **Lyst sæt**: 3-5 reps, almindelig (lys) skive - facit for den normale bane.
2. **Mørkt sæt**: sort skive på sort gulv - navet/nav-vagten (ordre 127 ·
   commit 1) og mørk-skive-detektionen (ordre 120) skal bekræftes på ægte
   optagelse, ikke kun det syntetiske testtilfælde.
3. Telefon i hoftehøjde, 3-4 m fra skiven, liggende (landskab).
4. Skiven fri af rack/stativ i begge klip - ingen kant der kan forveksles med
   skivens egen (se `docs/videocoach/SKIVEN-FINDES-IKKE.md`).
5. Hele løftet i billedet, skiven synlig fra start til slut.
6. Ingen atletdata i filnavn eller metadata - kun løfteart, fx `dodloft-mork.mp4`.

## Et syntetisk multi-reps-klip (identiske kopier limet sammen)

Har du (endnu) kun et 1-reps-klip, kan `ffmpeg` klippe rep-vinduet ud og lime
flere kopier sammen til et multi-reps-klip (se ORDRE 121 · commit 3's
fremgangsmåde: `tpad=stop_mode=clone` forlænger hver kopi med et frosset
sidste-frame-ophold, concat-demuxeren limer dem sammen). Sæt i så fald
`"repeatedIdenticalWindows": true` i sidecar-filen ud over `"windows"`
(sidste vindues rigtige start/slut-tider, som ellers) — ORDRE 124 · commit 3
fandt at UDEN dette felt bliver facit for vindue 2+ misvisende: uden feltet
er facit ÉT globalt spor fra den fulde analyses egen, sammenhængende
seek-baserede tracking hen over HELE det sammensatte klip, og det spor er
kun troværdigt frem til FØRSTE klip-samling — en kontinuerlig tracker møder
der et hårdt spring tilbage til rep-vinduets egen begyndelse (næste kopi
starter forfra), kan miste punktet, og HELE resten af det globale spor
drifter væk fra virkeligheden (målt: 120-310px "afvigelse" på vindue 2/3,
der reelt var en facit-fejl, ikke en sporingsfejl). Med feltet sat bruger
verify-videocoach-clip.mjs i stedet vindue 1's EGET (ubeskadigede) spor,
tidsforskudt, som facit for hvert senere vindue — korrekt, fordi indholdet
rent faktisk ER identisk, bare forskudt i tid.
