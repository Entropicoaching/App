# Proteinfordeling — ren, ikke tilkoblet model

`planProteinDistribution` fra `model.mjs` fordeler et **eksisterende** proteinmål
over 3–5 eksplicitte måltidspladser. Intet importerer modulet i produktflowet.
Det læser hverken log, klokke, lager, brugeridentitet eller netværk.

```js
import { planProteinDistribution } from './model.mjs'

const proposal = planProteinDistribution({
  weightKg: 80,
  dailyProteinG: 128,
  meals: [
    { id: 'slot-1', name: 'Morgenmad', timing: 'daytime', proteinG: 10 },
    { id: 'slot-2', name: 'Frokost', timing: 'daytime', proteinG: 30 },
    { id: 'slot-3', name: 'Aftensmad', timing: 'daytime', proteinG: 30 },
    { id: 'slot-4', name: 'Før søvn', timing: 'before-sleep', proteinG: 20 },
  ],
})
```

Resultatet har 32 g som mål pr. plads, 24 g som markeringstærskel og 32 g som
øvre vejledende reference. Morgenmad og før søvn markeres under tærsklen.
Højere eller lavere dagsmål ændres aldrig for at passe til referenceintervallet.
Mål fordeles i tiendedele; sidste plads beholder en eventuel mindre rest.
Brug formatering ved visning af flydende tal.

`proteinG` er måltidets komplette kendte total i gram; null/udeladt er ukendt,
0 er kendt nul. `totalProteinG` er kun kendt, når alle pladser har kendt protein.
`knownProteinG` er ellers alene en delsum. Manglende vægt, mål eller måltidsliste
giver `unavailable`; en eksplicit tom liste giver `empty`. Ugyldige kendte værdier
giver TypeError. En plan er ikke dokumentation for en komplet registreret dag.

Navne bruges aldrig til gruppering eller udledning af tidspunkt. Før søvn indgår
i de 3–5 pladser og i dagsmålet, når kalderen eksplicit angiver den plads. Modellen
tilføjer ingen ekstra portion eller plads. `beforeSleepIncluded` viser valget.

Kun kendte måltider under tærsklen kan få fødevareforslag. Forslag bruger det
eksisterende katalogs id, tilberedning, makroer og kilde med uændret
verifikationsstatus. Hvert forslag er en alternativ **tilføjelse**, ikke en
erstatning: højst 150 g fødevare og 15 g protein, i trin på 5 g fødevare. Højst
ét alternativ må vælges pr. måltid. Selv de største alternativer tilsammen
overskrider ikke dagens kendte resterende proteinmål. De kan efterlade et hul;
modellen lover ikke at nå tærsklen eller dagsmålet. Energitilføjelsen vises som
`energyKcal`; intet energimål justeres eller valideres her.

`allowedFoodIds` begrænser forslag til kalderens eksplicitte katalogvalg. `[]`
giver ingen forslag. Standardvalget er katalogets eksisterende proteinprioritet.
Der udledes ingen allergier, tolerancer, kostpræferencer eller produktsikkerhed.
Ukendt dagstotal giver ingen tilføjelsesforslag (`incomplete-day`), fordi dagens
resterende mål ikke kan fastslås. Der opfindes ingen produktionstilgængelige data.

Kommentarerne i modellen angiver evidensstyrke og den allerede fastlåste
ISSN-kilde (Jäger et al., 2017, DOI 10.1186/s12970-017-0177-8). Intervallet
0,3–0,4 g/kg er ordrens planlægningsheuristik, ikke en klinisk grænse. Kilden
er ikke efterkontrolleret via net i denne opgave. Modellen er et forslag til
voksenplanlægning, der kræver individuel vurdering før en eventuel tilkobling.

Alle mappens tests bruger `node:test`, importerer den rigtige model og det rigtige
kopierede katalog og opdages af `scripts/test.mjs` i appens eksisterende npm test.
Der er ingen React-komponent, React-erstatning eller ny dependency.
