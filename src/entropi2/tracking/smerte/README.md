# Smertehistorik til coachen

Ny, ukoblet komponent: `PainHistory.mjs`. Modellen `buildPainHistory` er ren og
udfører ingen læsning, skrivning eller automatisk ændring af træning.
Begge kræver `enabled: true`; OFF læser ikke `data`.

```js
const data = {
  state: 'ready', complete: true,
  athleteId: 'synthetic-athlete', asOf: '2026-11-04',
  daily: [{ day: '2026-11-04', source: 'athlete_manual',
    pain: 7, painLocation: 'Testknæ' }],
}
// React.createElement(PainHistory, { enabled: true, data, weeks: 6 })
```

Dette er den eksisterende normaliserede dagsformkontrakt fra
`tracking/coachuge/evaluate.mjs` og dens README, ikke en ny tabel.
Caller skal levere et komplet, autoriseret snapshot for én atlet.
Eventuelle `athleteId`/`athlete_id` på rækker skal stemme med snapshot.
`asOf` er sidste inkluderede kalenderdato, eksplicit valgt af caller.
`weeks` er et heltal 4–8 (standard 6), inklusive slutdato og de foregående
`weeks * 7 - 1` dage. Vinduer er kalenderdage, også over sommertid.

Rå legacy `readiness_logs` har `soreness_level` (1–5) og `sore_zones`.
De felter dokumenterer ømhed, ikke smerte 0–10, og må ikke konverteres.
Denne leverance tilføjer hverken indtastning, persistens eller forespørgsler.
Uden faktiske smerteobservationer viser modellen derfor tomt datagrundlag.
Den normaliserede kontrakt findes i basen; det er ikke bevis på, at en
produktionslæser allerede leverer dens smertefelter.

En række pr. dato, højst 10000 inputrækker. Manglende `pain` betyder ukendt.
Kendt `pain` skal være et heltal 0–10. Positiv smerte kræver `painLocation`
(1–120 tegn, ikke kun mellemrum). 0 uden område tælles særskilt og tilskrives
aldrig alle områder. Områdenavne trimmes, men slås ikke sammen på tværs af
stavemåder. Modstridende/dobbelte datoer afvises; ingen vilkårlig vinder.
Udenfor perioden ignoreres værdier efter kontrol af dato og evt. atlet-id.

Flag 7+: mindst én observation ≥7 i den viste periode, med alle udløsende
datoer og værdier altid synlige. Det er historik, ikke en påstand om aktuel smerte.
Stigende tendens: de seneste 14 kalenderdage mod de foregående 14;
middelstigning ≥2 point og mindst 3 registrerede dage i hvert vindue for
samme område. Begge vinduer og alle deres værdier vises ved flaget.
Ugemidler bruger kun indtastede værdier. Huller udfyldes ikke.

Fejl: `state: 'error'`, ufuldstændigt snapshot eller ugyldige værdier.
Indlæsning: `state: 'loading'`. Valgfri `onRetry` kaldes kun ved brugerklik.
Ingen rå fejldata eller ekstra metadata sendes videre til visningen.

Alle `.test.mjs` opdages af appens eksisterende `npm test`-runner.
`painReact.test.mjs` kræver ægte React/react-dom og springes ikke over.
`painView.test.mjs` bruger den snævert afgrænsede syntetiske loader til at
undersøge den faktiske komponents elementtræ; det beviser ikke ReactDOM,
browserlayout eller hjælpemiddelfunktion. Ingen browser/server er nødvendig.
