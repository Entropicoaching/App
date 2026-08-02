# Entropi programmotor v1

Status: produktdefinition til shadow-pilot. Ikke implementeret, ikke deployet og
ikke en erstatning for individuel coaching.

## Formål

En ny bruger skal kunne give få, relevante oplysninger og modtage et konkret,
versionslåst styrkeforløb. Motoren vælger mellem Marc-definerede byggesten; den
opfinder ikke øvelser, progression eller sundhedsråd med en sprogmodel.

## Første målgruppe og afgrænsning

- Kerne: voksne, der vil bygge styrke med squat, bænkpres og dødløft som mulige
  hovedløft.
- V1 håndterer almindelig opbygning, ikke stævnepeak, skadeforløb, sygdom,
  graviditet, unge eller rehabilitering.
- Stævnedato vises som et senere spor. Den må ikke ændre programmet i v1.
- Brugeren kan altid beholde, ændre manuelt eller afslutte et foreslået program.

## Onboarding: kun de input, motoren faktisk bruger

1. Primært mål: generel styrke, begynde styrkeløft eller bygge mod styrkeløft.
2. Erfaring: begynder, øvet eller erfaren.
3. Træningsdage: 2, 3 eller 4 pr. uge.
4. Udstyr: hjemme, basis-gym eller fuldt gym.
5. Mulige hovedløft og nuværende omtrentligt niveau: valgfrit i v1 og kun brugt
   til startbelastning, aldrig til adgang eller segmentering.
6. En enkel stopvej: "Min situation passer ikke til disse rammer". Den giver ikke
   en automatisk løsning, men peger på afklaring/coaching.

## Programbyggesten

Hver byggesten er data, der er skrevet og reviewet af Marc:

- `template`: 2-, 3- eller 4-dages uge med faste bevægelsesroller.
- `exercise_slot`: hovedløft, variation eller assistance; hver rolle har godkendte
  øvelsesmuligheder og udstyrskrav.
- `prescription`: sæt, rep-område, ønsket RPE og progressionstrin.
- `progression_policy`: én navngiven, begrænset regel pr. hovedløft.
- `programme_version`: det konkrete output med motorversion, input og valgspor.

Motoren filtrerer først efter mål, erfaring, dage og udstyr. Derefter vælger den
det bedst egnede Marc-godkendte template deterministisk. Samme input og samme
motorversion giver samme program. UI'et forklarer kort: "Du træner 3 dage med
fuldt gym; derfor valgte vi en tre-dages base med to eksponeringer af ...".

## Adaptiv del: v1

Den adaptive motor læser kun strukturerede, loggede data for den samme øvelse i
den aktive programversion: planlagt og faktisk vægt, sæt, reps, RPE og om passet
blev gennemført. Fritekst fortolkes aldrig som træningsgrundlag.

Efter mindst to sammenlignelige, gennemførte eksponeringer kan v1 foreslå én
ændring til *næste* samme øvelse: højst ±2,5 % eller ét mindste vægtspring,
højst ét arbejdssæt, eller en ændring inden for et allerede defineret rep-område.
Belastning og volumen stiger aldrig samtidig. Manglende eller usikre data betyder
altid: behold planen.

Forslaget er ikke skjult automatik. Det viser registreringen, den udløste regel,
gammel og ny plan samt ændringens størrelse. Brugeren vælger "Accepter", "Behold
nuværende plan" eller "Bed om manuel vurdering". Beslutningen gemmes med
regelversion og kan fortrydes.

## Ikke automatiseret i v1

- Vurdering af smerte, skade, sygdom, søvn, psykisk trivsel eller medicin.
- Stævneplanlægning, vægtcut eller peak.
- Store spring i volumen/intensitet eller automatisk deload.
- Justering ved smerte, skade, sygdom, svimmelhed, usædvanlig træthed,
  afbrudte pas, modstridende data eller gentagne store præstationsfald.
- Generering af nye øvelser eller fritekstprogrammer.
- Automatisk overgang til coaching eller deling af data med Marc.

## Pilotens succesmål

En tester skal kunne: gennemføre onboarding, forstå hvorfor programmet blev
valgt, logge ét pas og se ét afgrænset, begrundet forslag til næste eksponering.
Feedback måles på forståelighed og friktion, ikke på træningsresultater.

## Implementeringsrækkefølge

1. Lås de første templates og progressionstrin som reviewede data.
2. Byg deterministic matcher og gem `programme_version` + valgspor.
3. Vis program og log et pas uden adaptive ændringer.
4. Tilføj én begrænset progresionsregel pr. hovedløft efter særskilt regelreview.
5. Shadow-test med én bruger; kun derefter udvides bibliotek og adaptivitet.
