# Coachens ugeevaluering v1

Frakoblet, ren model og React-visning. Importér `CoachWeek.mjs` og kald med
`{enabled: true, data}` ved en senere integration. OFF kræver ingen data og læser
dem ikke. Ingen queries, effekter, lagring, cyklusfelter eller skrivehandlinger.

`evaluateCoachWeek` tager samme argument og returnerer `state`, `sections`, `flags`
og `automaticChanges: false`. `data` er et **autoriseret, komplet snapshot for én
athletes.id**, ikke vilkårlige databaseobjekter. `state: 'loading'` viser indlæsning.
Kun `state: 'ready', complete: true, athleteId, asOf: 'YYYY-MM-DD'` beregnes.
Andre tilstande, delvise opslag og ugyldig kontekst giver fejl uden beregning.
`asOf` er valgt atletlokal kalenderdato, aldrig implicit dagsdato. Visningen
påstår ikke, at en igangværende uge er afsluttet.

Alle arrays er krævede for deres område; `[]` betyder et komplet tomt opslag,
udeladt/ugyldig samling betyder ukendt grundlag. Datodubletter afvises i vinduet.
Tal skal være endelige JavaScript-tal; intet decimalkomma eller numeriske strenge.
Adapteren skal afklare identitet, kilde, dato, enhed, dubletter og komplethed først.

| Felt | Normaliseret kontrakt |
| --- | --- |
| daily | `{day, source:'athlete_manual', sleepHours?, sleepQuality?, energy?, stress?, soreness?, sorenessLocation?, pain?, painLocation?}`. Mangler er null/udeladt, ikke 0. Sted kræves ved positiv ømhed/smerte. |
| loadDays | `{day, known:true, tonnageKg, restConfirmed?}`. kg × faktisk gennemførte reps af ikke-skipped bekræftede sæt. Kun målbar kg-tonnage, aldrig kropsvægtsskøn. 0 kræver eksplicit bekræftet hvile. Alle 28 dage kræves; C omfatter A. |
| strength | `{exerciseId, variantId, sets:[{id, day, exerciseId, variantId, unit:'kg', kg, reps, confirmed, skipped, deload}]}`. Samme løft og variant. Højeste Epley e1RM pr. dag; mindst 3 datoer i hver 28-dages endeblok i 84 dage. Midterblokken vises, men styrer ikke ændringen. Alle statusfelter er eksplicitte booleans. |
| nutritionDays | `{day, complete:true, proteinG, targetG, targetVersion}`. Kun eksplicit komplette dage med positivt mål gældende den dato. Mindst 21/28. Adapteren beviser målets dato; et nutidigt mål må ikke kopieres tilbage. |
| weightDays | `{day, kg}`. Én afklaret positiv måling pr. dato. Mindst 4 datoer i hver af to separate 7-dages vinduer. |
| compliance | `{complete:true, programVersion, plannedIds:[], completedIds:[], extraIds:[]}` for ugens daterede program. Gennemførte er unikke planlagte sessioner med alle krævede sæt bekræftet; skipped er ikke gennemført. Ekstra må ikke være planlagt. 0 planlagte giver notPlanned. |

Søvn/energi/stress/ømhed følger planens feltvise 4/7-regler. Én smerte ≥7 giver
prioritet, selv med øvrige datamangler. Trendflag passerer det eksisterende
`buildAthleteSignalList`; smerte og wellbeing lægges til uden at ændre det modul.
Sortering: smerte først, derefter stabil signal-ID-rækkefølge. Ingen samlet score.
Tærskelsammenligninger beskytter mod binær flydende-komma-støj ved lighed
(128 × Number.EPSILON relativt til størrelsen); visningsafrunding styrer aldrig flag.
`dataBasis` indeholder periode, antal, minimum, regel, formel og daterede
observationer. Output kopierer kun navngivne offentlige felter.

De nuværende load/strengthTrend/nutritionTrend/weightTrend-moduler har andre
minimumstal, vinduer eller målregler. Deres scalar-output er derfor ikke dette
snapshot. En senere kildeadapter skal levere ovenstående beviser eller lade
området være ukendt. Intet signal må opfindes ud fra en scalar alene.

Visningen er én kolonne: periode/status øverst, flag med tal og datoer, rågrundlag
under native `details`, øvrige områder samlet foldet nederst. Ingen flag gentages
i øvrige områder. Formler og tærskler står i grundlaget. Den indeholder ingen
inaktive knapper til noter eller planlægning; eksisterende flows kobles senere.
Private cyklusfelter accepteres eller vises aldrig som modelområde. Autorisation
og tilbagekaldelse skal stadig håndhæves i den senere kildeintegration.

Prøver: `node --test --test-concurrency=1 src/entropi2/tracking/coachuge/*.test.mjs`
(på Windows anvendes eksplicit filliste som scripts/test.mjs). React-prøven bruger
ægte `react` og `react-dom/server`, ingen loader. Appens npm test opdager begge.
