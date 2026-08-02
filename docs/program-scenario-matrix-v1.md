# Programmotor: scenariematrix v1

Status: lokal regression- og reviewartefakt. Den tilføjer ingen coachinglogik,
databaseadgang, konto, programtildeling eller deployment.

## Formål

`src/subscription/programScenarioMatrix.js` genererer alle kombinationer i den
nuværende inputflade (576 scenarier): mål, 2/3/4 dage, niveau, de to tydelige
udstyrsmiljøer, squat- og
dødløftvariant. Hvert scenarie køres gennem den samme resolver, som previewet
bruger. Det gør ændringer i templates, matcher eller exercise catalogue synlige
som en regression før en pilot.

## Hårde grænser

- Kun `review`-templates kan blive reviewklare.
- Der findes i dag kun full-gym-templates. Hjemmetræning stopper til manuelt
  review, indtil et konkret hjemmeudstyrsprofil er valgt; motoren lover ikke et
  halvt program.
- Fire dage kræver øvet eller erfaren, fordi det er den eneste canonical template-
  dækning.
- Styrkeløftfundament kræver et eksplicit high-/low-bar-valg og et eksplicit
  conventional-/sumo-valg. `not-sure` giver `manual-review`, aldrig en default.
- For generel styrke er en manglende variant en named canonical review choice, ikke
  et gæt om atletens teknik. Et eksplicit valg respekteres.

## Brug

1. Kør `npm run test:subscription`.
2. Åbn `program-scenarios.html` i den lokale Vite-server.
3. Filtrér frem til den ønskede kombination og læs enten det konkrete output eller
   stopårsagen.

En ny template, variant eller udstyrsvej må først tilføjes sammen med en ny
forventet scenarietest og et eksplicit fagligt review.
