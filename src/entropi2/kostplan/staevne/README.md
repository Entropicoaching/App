# Stævnekost: beregning i coachens Stævne-fane

`StaevneTab.jsx` kobler `CoachWeightPlan.mjs` ind som den lukkede fold
»Vægt og vejning« under prognosen. Kun Entropi 2 ON, coachvisning og en gyldig
`athletes.competition_date` samt `athletes.weight_class` viser beregneren.
Ingen ny tabel, databasekald, fetch eller lagring. Entropi 2 OFF og atletvisningen
er uændrede. Der sendes eller aktiveres ingen plan.

Coachen indtaster en aktuel kropsvægt, vælger eksplicit 2/24 timers vejning og
bekræfter voksen atlet samt den krævede faglige vurdering. Intet er forudvalgt.
Den udaterede profilvægt bruges ikke som aktuel vejning. Indtastningerne gælder
kun denne beregning og nulstilles ved faneskift, OFF, atlet-, stævnetype-, dato-
eller vægtklasseskift. Dato og klasse kan kun ændres via profilens eksisterende
flow. `coachPlanInput.mjs` validerer produktionsgrundlaget og oversætter de
midlertidige input til modellens strikte kontrakt. Komponenten leverer dagens
lokale kalenderdato; modellen har fortsat ingen implicit klokke.

`buildCompetitionPlan({enabled, input})` fra `model.mjs` er en ren funktion.
Kun `enabled === true` læser input. OFF giver `{phase: 'off'}`. Aktivt kald uden
input giver `empty`; ugyldige tal/datoer giver `invalid`. `review` kræver faglig
vurdering, og `draft` er kun en foreløbig beregning, aldrig en godkendelse.

Input skal være et objekt med følgende eksplicitte felter:

| Felt | Betydning |
| --- | --- |
| `weightKg`, `weightClassKg` | Endelige numeriske kg, 25–350; ingen tekstkonvertering |
| `asOf`, `competitionDate` | Gyldige ISO-kalenderdage, 1900-01-01 til 9999-12-30 |
| `weighInHours` | Talværdien 2 eller 24; ingen standard |
| `adult` | Skal være boolean `true`; ukendt eller mindreårig giver ingen plan |
| `healthReviewed` | Skal være boolean `true` efter faglig vurdering af helbred, medicin og risiko for spiseforstyrrelser |

Modellen kan ikke selv foretage eller bekræfte en helbredsvurdering. Flagene er
callerens kontrakt, ikke medicinsk godkendelse, autentifikation eller adgangskontrol.
Den er ikke egnet til mindreårige, gravide, sygdom eller spiseforstyrrelser.

Modellen bruger kalenderdage, ikke præcise stævneklokkeslæt: ved 24 timer er
vejningsdatoen dagen før stævnet, ved 2 timer stævnedagen. På selve vejningsdagen
beregnes ingen ny plan. Et stævne omkring midnat kræver særskilt datovurdering;
denne kladde kan ikke bruges til at beregne et præcist væske- eller måltidsskema.
`asOf` leveres eksplicit; caller skal anvende den aktuelle lokale kalenderdato.

De sidste højst 28 dage indgår. Ved reduktion kræves mindst syv dage til vejning.
Et senere starttidspunkt markeres og kræver en ny aktuel vægt ved start. Hvert
interval er højst syv dage; en sidste deluge skaleres med dagantallet. Loftet er
1 % af intervallets startvægt pr. syv dage, sammensat som `0.99 ** (dage / 7)`.
Ved et nåeligt mål bruges en lavere ensartet rate, som ender på vægtklassen.
Ved en for stor forskel vises kun den begrænsede gradvise del og en tydelig
coachvurdering. Intet underskud i kcal foreskrives, og ingen frist hæver loftet.
Ved eller under vægtklassen foreslås hverken reduktion eller vægtøgning.

Ved 2 timer er akut vandtab altid udelukket. Ved 24 timer gives alene en
vurderingsgrænse på højst 1 % af den projekterede vægt efter gradvis reduktion,
afrundet ned til gram. En restforskel under grænsen giver stadig `review`.
`acute.prescribedWaterLossKg` er altid 0. Ingen automatisk dehydreringstilladelse
eller protokol findes. En rest over grænsen kræver vurdering af en anden
vægtklasse. 1 % er en konservativ produktregel og ingen dokumenteret sikker
dehydreringsdosis. Kilderne er virkelige publikationer med DOI; evidensens
begrænsninger er beskrevet ved hver kilde. Denne models præcise grænser og
ugemål er ikke klinisk valideret.

Efter vejning vises generelle trin for velkendte kulhydratholdige måltider og
fordelt væskeindtag med særskilt tekst for 2 og 24 timer. Der er ingen tvungen
væske- eller elektrolytdosis. Faktisk væsketab kræver individuel faglig hjælp.
Akutte faresignaler og opfordringen »Tal med din coach« er angivet.

`StaevneCoach.mjs` er den rigtige React-komponent, uden hooks eller effekter.
Props: `{enabled, role: 'coach', input}`. Den bygger selv modellen på ny; den tager
ikke imod et caller-fremstillet resultat. OFF eller anden/ukendt rolle giver
`null`, før input læses. Rolleflaget styrer kun visning; integrationen ligger i
den eksisterende coachportal. Visningen har ingen handlinger eller writes.
Ugemål og status er synlige; genopfyldning og sikkerhed/kilder er foldet i native
`details`. Den er flydende i bredden med 44 px summary-mål. Browserlayout er
ikke verificeret i denne hermetiske opgave.

Appens eksisterende `npm test` finder alle `.test.mjs`-filer i mappen.
`model.test.mjs` og `view.test.mjs` er hermetiske og importerer de faktiske
moduler. Element-fixturen er kun en strukturel test og tæller ikke som React.
`StaevneCoach.react.test.mjs` kræver rigtig `react` og `react-dom/server` uden
skip eller React-loader. `CoachWeightPlan.react.test.mjs` prøver også den faktiske
JSX-fane med rigtig React og kun syntetiske backend/style/flag-kanter.
`coachPlanInput.test.mjs` prøver den faktiske adapter og model.
`CoachWeightPlan.synthetic.test.mjs` er supplerende hooksimulering af faktisk
komponentkode; den erstatter ikke React-prøver eller browserlayout.
Kør alle mappeprøver med `node --test --test-concurrency=1`.
Fuld suite/build udføres af Dhurva i appens normale dependency-miljø.
