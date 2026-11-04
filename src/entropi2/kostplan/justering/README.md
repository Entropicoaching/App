# Ugens kostjustering · KOST-JUSTERING1

Nye, frakoblede moduler til Entropi Coach. Intet importerer dem fra appens
indgange. Atletvisningen, trackeren og Entropi 2 OFF er derfor uændrede.
Der er ingen lagring, netværk, implicit klokke eller automatisk aktivering.

`evaluateAdjustment({enabled, plan, nutrition})` er den rene model.
Kun `enabled === true` læser input; ellers returneres `{phase: 'off'}`.
`plan: null` giver en ærlig tom tilstand. Ugyldigt input kaster `TypeError`;
caller skal vise fejl og forhindre beslutninger, indtil et nyt grundlag er hentet.

`plan` er en versionsmærket **energibasis**, ikke et måltidsskema:

```js
{
  id: 'synthetic-plan', athleteId: 'synthetic-athlete', coachId: 'synthetic-coach',
  status: 'active', version: 1, kcal: 2800, createdOn: '2026-10-07',
  // lastAdjustedOn?, evaluatedThrough?, lastReviewedOn?: ISO-dage
}
```

`nutrition` følger `../beregning.mjs`: eksplicit dato, bekræftet voksen,
kropsvægt, bulk/maintain/cut, intensitet, vægtmålinger, komplette kostdage,
træningskategori og eventuelt dagsform, stævne og individuelt energigulv.
Alle rækker skal allerede tilhøre samme atlet. Modellen kan ikke verificere
identitet på anonyme dagsrækker. `nutrition.currentPlan` ignoreres til fordel
for den aktuelle versionsmærkede basis. kcal er før dagens træningstillæg.

Modellen bruger den eksisterende beregnings vægttrend, ønskede ugentlige
procentændring, kostdækning, energigulve, tolerance, restitution og cooldown.
Der kræves 14–28 dage, mindst ti vejninger med fem i hver ende og mindst
70 % komplette kostdage i samme periode. Trin er højst 150 kcal og 5 %.
Manglende indtag/trend er ukendt, aldrig nul. Datagrundlaget viser periode,
gyldige/frasorterede dage, faktisk gennemsnitsindtag, ønsket/observeret trend,
træningsvolumen/-intensitet, dagsform og eventuelt stævne.

Dette flow kræver eksplicit træningskategori før en ændring; manglende
træning vises som ukendt. Høj volumen eller intensitet stopper reduktioner,
men tillader et begrundet forslag om mere energi. Træningsdagens makrogulv
beskytter også basis: max(basisgulv, dagsgulv minus træningstillæg).
En plan under gulvet kræver rettelse, også under cooldown. Der er ingen
ny fysiologisk model eller påstand om individuel klinisk sikkerhed.

`decideAdjustment(proposal, {plan, nutrition, actor, decision, on})` kræver
frisk basis og frisk beregningsgrundlag. Forslaget genberegnes og skal matche
det viste snapshot præcist. Kun planens betroede coach-id/rolle kan bruge
`decision: 'accept' | 'reject'`, og beslutningen skal træffes på vurderingsdagen.
Caller bør bevare det oprindelige objekt; nøglernes rækkefølge indgår i
sammenligningen. Gemte/rekonstruerede snapshots med ændret rækkefølge kan
afvises konservativt og må da erstattes af en ny vurdering.

Returværdien er `{plan, record, snapshot}`: en kandidatbasis, kvittering med
begrundelse/datagrundlag og lokal visningsstatus. Accept sætter foreslået basis
og `lastAdjustedOn`; afvisning bevarer kcal. Begge øger versionen og sætter
`lastReviewedOn` og `evaluatedThrough`. Også afvisning forbruger syv hele dage;
genkald med gammel tilstand kan ikke forhindres uden adapterens atomiske
versionskontrol. Tidligste næste dato alene garanterer ikke nyt datagrundlag.

Returneret `plan` indeholder kun basisfelterne ovenfor. Caller må ikke erstatte
en komplet aktiv måltidsplan med dette objekt. Adapteren skal anvende basis
til en revideret kladde, genberegne kompatible dagsmål/måltider og kontrollere
alle gulve. En ugentlig delta må aldrig lægges oven i beregningens allerede
nykalibrerede `targets.kcal`.

`KostJustering.mjs` er en kontrolleret React-visning uden hooks/effekter.
Props: `enabled`, `snapshot`, `onDecision(decision, snapshot)`, `pending`, `error`.
Coachen ser forslagets energiændring og begrundelse først; datagrundlag og
grænser ligger i lukket native `<details>`. Accept/afvis har mindst 44 px højde,
kan ombrydes og er deaktiveret ved `pending` eller manglende callback. Fejl
skjuler alle handlinger. Et lokalt accepteret/afvist snapshot siger udtrykkeligt
»i kladden«; det er ikke en kvittering for lagring eller aktivering.

Adapteren ejer loading, fejlhåndtering, dobbeltklikslås og atomisk compare-and-swap
af planversion, ny basis og kvittering. Identitet/adgang skal håndhæves uden for
denne rene model. Hold `pending` fra klik til bekræftet resultat; ved ukendt
udfald: vis `error: true`, genhent basis/kvittering og tillad ikke blind gentagelse.
En accepteret revision skal gennem coachens eksplicitte aktivering, før atleten
ser ændringer. Der er ingen adapter til database eller tracker i denne pakke.

Appens `npm test` finder de tre `.test.mjs`-filer. `model.test.mjs` importerer
det faktiske modul og den kopierede beregning. `view.synthetic.test.mjs` bruger
en navngivet elementfixture til hændelser; det tester ikke rigtig React eller DOM.
`KostJustering.react.test.mjs` kræver rigtig React/ReactDOM uden erstatning eller
skip og kontrollerer serverrendering og de faktiske hændelsesfunktioner.
React skal findes i appens normale afhængigheder. Ingen installation er nødvendig
for model- og fixtureprøverne. Dhurva kører fuld suite og build ved fletning.
