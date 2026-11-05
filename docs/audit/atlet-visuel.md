# Entropi Coach — atletens visuelle gennemgang ved 390 px

Billet: E2-UI-GENNEMGANG1. Base: `3082dfb3545e60942834c0e094c730e320b68d5b`.
Metode: statisk gennemgang af de fastlåste offentlige kildekopier, CSS-kaskaden og aktive ruter. Ingen browser, skærmbilleder eller produktionsdata. Beskrivelserne nedenfor er kodeafledte forventninger; faktisk linjebrydning, skrifttypeindlæsning og tastaturoverlap er ikke visuelt verificeret. Fil:linje henviser til basen, ikke til dette dokument.

390 px betyder CSS-viewport, normal tekstskalering og rodskrift på 16 px (`src/index.css:28`). `#root` har to sidekanter på tilsammen 2 px (`src/index.css:57`). Der regnes derfor med ca. 388 px til appens indhold før padding. Ingen viewporthøjde antages.

Aktive indgange: Hjem og dagens pas via `src/AthleteView.jsx:819` og `src/entropi2/home/HomeSession.mjs:18`; Program via den eksisterende lazy-indgang i `src/AthleteView.jsx:896`; Analyse/Mine tal via `src/AthleteView.jsx:925`; kost via `src/AthleteView.jsx:944`; beskeder via `src/AthleteView.jsx:978`; profil via `src/AthleteView.jsx:802`. Program bruger `src/athlete/ProgramTab.jsx`, hvis Entropi 2-standard kommer fra `src/athlete/ProgramTab.jsx:304` og `src/entropi2/flag.mjs:4`. De selvstændige `ProgramEntry.mjs` og `KostplanAtlet.mjs` er ikke koblet til disse ruter i den leverede base og tælles ikke som synlige skærme. Kostens eksisterende gramfelter indgår; en ny kostplanintegration gør ikke.

Prioriteter: P1 = hindrer læsning eller tydelig fejlretning; P2 = mærkbar forbedring af daglig brug; P3 = afsluttende visuel polering. De 15 punkter er grupperet efter skærm, og hvert punkt er én selvstændig billet på 30–90 minutter. Estimater omfatter målrettet kontrol, ikke fuld suite/build. Begynd med 03 og 09, derefter 01, 02 og 08.

Fælles ramme for kommende rettelser: kun præsentation inden for Entropi 2-atletens namespace; eksplicit OFF og andre roller bevares. Ingen nye læsere, datakilder, beregninger, lagringsnøgler eller skrivninger. Brug kun allerede tilgængelige data. Skjul valgfrie koblinger, når datagrundlaget mangler; indlæsningsfejl skal fortsat kunne skelnes fra bekræftet tomme data. Tal må ikke erstattes med opdigtede nuller. Fold kun sekundære oplysninger; gemmefejl og vigtige forbehold skal være synlige.

## Fælles visuel ramme

### 01 · Én vandret sideafstand på de indlejrede skærme — P2 · 60–90 min

- Kilde: `src/AthleteView.jsx:817`, `src/athleteShared.js:71`, `src/entropi2/home/homeStyles.mjs:3`, `src/entropi2/analysis/Analysis.mjs:55`, `src/entropi2/conversation/ConversationView.mjs:134`, `src/entropi2/nutrition/nutrition.css:9`.
- Nu: værten giver 16 px på hver side, og Hjem, Analyse, Samtale og kostens main tilføjer 20 px. Indholdet bliver ca. 316 px bredt; et hjemmekort med 20 px padding og kanter efterlader ca. 274 px til tekst. Profil ligger uden for denne vært. De forskellige indryk får skærmene til at hoppe vandret ved navigation.
- Rettelse: lad én E2-afgrænset wrapper eje 20 px sideafstand. Fjern det ekstra vandrette lag på de berørte indgange, og behold den eksisterende bundplads til navigation. Brug samme indholdsstart på Program; behold dialogens selvstændige ramme. Rør ikke den delte OFF-stil globalt.
- Accept ved 390 px: skærmenes overskrift og første kort begynder 20 px fra appkanten; lange syntetiske øvelsesnavne ombrydes uden vandret scroll. Kortets indre padding er fortsat 20 px. Profilens tilbageknap håndteres særskilt i 15.

### 02 · Venstrestil læsestoffet på Hjem, kost og profil — P2 · 30–45 min

- Kilde: `src/index.css:61`, `src/entropi2/home/homeStyles.mjs:3`, `src/entropi2/nutrition/nutrition.css:9`, `src/entropi2/profile/profileStyles.mjs:2`, `src/entropi2/entropi2.css:17`, `src/entropi2/conversation/ConversationView.mjs:136`.
- Nu: rodens `text-align: center` arves af Hjem, kost og profil. Analyse og Samtale overstyrer den allerede til venstre. Afsnit, lister og feltetiketter får derfor forskellig læseretning mellem fanerne.
- Rettelse: sæt eksplicit venstrestilling på de tre E2-skærmes indholdsrod. Behold centrering af knaptekst og dedikerede talfelter, hvor det hjælper aflæsning. Ingen global ændring af `#root`.
- Accept ved 390 px: et coachafsnit på tre linjer, kostetiketter og profilens feltværdier har samme venstrekant som deres overskrift. Primære handlingsknapper har fortsat centreret tekst.

## Profil: læsbarhed

### 03 · Gør profilens overskrifter læsbare i lyst systemtema — P1 · 30–45 min

- Kilde: `src/index.css:3`, `src/index.css:69`, `src/entropi2/profile/profileStyles.mjs:5`, `src/entropi2/profile/profileStyles.mjs:7`, `src/entropi2/profile/Profile.mjs:17`, `src/entropi2/profile/ProfileGoalsView.mjs:21`, `src/entropi2/entropi2.css:2`.
- Nu: profilens titel og h2-stil angiver ikke farve. Den globale h1/h2-regel bruger `--text-h`, som er `#08060d` i lyst systemtema. Profilen ligger stadig på appens mørke baggrund. Parentens lyse tekstfarve vinder ikke over en farve sat direkte på h1/h2, og E2-overskriftsreglen omfatter ikke profilen. Titelkontrasten mod `#141410` er beregnet til ca. 1,09:1.
- Rettelse: angiv `#edeae2` i profilens egne titel- og overskriftsstile eller under dens E2-selector, også for målsektionen. Behold systemtemaets øvrige adfærd.
- Accept ved 390 px: “Mig”, “Mine kostmål” og “Mine mål og stævne” er lyse og læsbare i både lyst og mørkt systemtema. Manglende kostmål opretter ikke et tomt kort.

## Hjem

### 04 · Flyt Start frem foran den lange pasbeskrivelse — P2 · 45–60 min

- Kilde: `src/entropi2/home/AthleteHome.mjs:90`, `src/entropi2/home/AthleteHome.mjs:95`, `src/entropi2/home/AthleteHome.mjs:97`, `src/entropi2/home/AthleteHome.mjs:98`.
- Nu: alle navngivne øvelser og alle coachnoter står før Start-knappen. Et syntetisk pas med otte øvelser og lange noter skubber den vigtigste handling langt ned i kortet.
- Rettelse: vis titel, dato og eksisterende sætstatus efterfulgt af Start. Læg den fulde øvelsesliste og noter i ét lukket “Se passets indhold”-fold nedenunder. Behold den eksisterende startfunktion og synlige forklaring ved forældet uge eller manglende startadgang.
- Accept ved 390 px: Start kommer før den første øvelsesliste uanset listens længde. Alle oprindelige noter kan åbnes. Hviledag, ferie og manglende program får ingen falsk aktiv Start-knap.

### 05 · Hold seneste coachbesked kort på Hjem — P2 · 30–45 min

- Kilde: `src/entropi2/home/AthleteHome.mjs:119`, `src/entropi2/home/AthleteHome.mjs:122`, `src/entropi2/home/AthleteHome.mjs:124`, `src/entropi2/home/homeStyles.mjs:8`.
- Nu: hele den seneste coachtekst vises med bevarede linjeskift. En lang besked kan fylde mange skærmlængder, selv om “Se besked og video” allerede fører til samtalen.
- Rettelse: brug en kort forhåndsvisning på højst ca. 180 tegn med ellipse ved afkortning, og behold den eksisterende navigationsknap til fuld tekst. Behold tidspunktet, når det findes. Ændr ikke markering som læst.
- Accept ved 390 px: en syntetisk besked på 2.000 tegn optager kun et kort uddrag; korte beskeder vises fuldt. Ingen besked giver intet coachkort, og fuld besked kan fortsat læses via den eksisterende knap.

## Dagens pas

### 06 · Komprimer planens lodrette plads før registreringen — P2 · 45–60 min

- Kilde: `src/entropi2/session/sessionView.mjs:150`, `src/entropi2/session/sessionView.mjs:154`, `src/entropi2/session/sessionView.mjs:173`, `src/entropi2/session/sessionStyle.mjs:13`, `src/entropi2/session/sessionStyle.mjs:37`.
- Nu: gentagelser og planvægt vises som separate 26 px-linjer i et kort med 20 px padding og 20 px top/bundmargin. Derefter kommer et nyt kort til “Dit sæt”. Meget lodret plads bruges før de faktiske felter.
- Rettelse: saml de eksisterende gentagelser og vægt på én ombrydelig planlinje; brug 16 px indre padding i planens kompakte variant og 12 px afstand til registreringen. Behold plan og indtastning som tydeligt adskilte grupper. Manglende gentagelser og coachens fokus må ikke gemmes i et fold.
- Accept ved 390 px: korte recepter kan stå på én linje; lange recepter ombrydes. De eksisterende 56 px vægt-/gentagelsesfelter, 48 px RPE-knapper og 52 px godkendelsesknap bevarer deres størrelser. Ingen ændring af gemning eller timer.

### 07 · Vis tydeligt, når sættets kontroller er låst — P2 · 30–45 min

- Kilde: `src/entropi2/session/sessionStyle.mjs:5`, `src/entropi2/session/sessionView.mjs:174`, `src/entropi2/session/sessionView.mjs:181`, `src/entropi2/session/sessionView.mjs:234`, `src/entropi2/session/sessionView.mjs:23`.
- Nu: disabled-knapper får eksplicit opacity 1 og beholder ellers deres udseende. Under afventning ligner stepknapperne derfor fortsat aktive kontroller, selv om teksten på godkendelsesknappen ændres og statuslinjen forklarer tilstanden.
- Rettelse: giv låste sessionknapper en tydelig, læsbar inaktiv flade og kant, uden at gøre hele formularen svag. Behold status som “Afventer svar” og “Venter på net” i tekst; farve alene er utilstrækkelig. Fejltilstandens genforsøg skal være tydeligt aktivt igen.
- Accept ved 390 px: idle, saving, waiting, queued og error kan skelnes med syntetiske tilstande. Tal og fejltekst bevarer læsbar kontrast, og låsningen får ingen nye trykbare handlinger.

## Program

### 08 · Løft ugevalg og kontekst op i læsbar tekststørrelse — P2 · 45–60 min

- Kilde: `src/athlete/ProgramTab.jsx:612`, `src/athlete/ProgramTab.jsx:623`, `src/athlete/ProgramTab.jsx:625`, `src/athlete/ProgramTab.jsx:633`, `src/athlete/ProgramTab.jsx:651`.
- Nu: Forrige/Næste uge og ugens dato bruger 0,58 rem, ca. 9,3 px. “Tilbage til denne uge” bruger 0,52 rem, ca. 8,3 px. Planlagt/historisk er desuden mørk `#4a4844`. Den eksisterende E2-grid løser allerede ombrydning; det er især læsbarheden, der mangler.
- Rettelse: brug 15–16 px til navigationsknapper og 14 px til dato/status med `#b8b4a8` eller programmets læsbare muted-farve. Behold E2-grid, mindst 44 px højde og den nuværende ugenavigation. Afgræns stilen til `programAppearanceOn`.
- Accept ved 390 px: lange ugeintervaller og bloknavne ombrydes i stedet for at overlappe; dato, historisk og planlagt kan læses uden zoom. Aktiv uge og tidligere uger bruger fortsat de oprindelige indeks og logdata.

### 09 · Gør tomt program og hentefejl tydelige og rolige — P1 · 30–60 min

- Kilde: `src/athlete/ProgramTab.jsx:536`, `src/athlete/ProgramTab.jsx:545`, `src/athlete/ProgramTab.jsx:547`, `src/athlete/ProgramTab.jsx:550`, `src/athlete/ProgramTab.jsx:553`, `src/athlete/ProgramTab.jsx:556`, `src/athleteShared.js:77`.
- Nu: forklaringen i begge tilstande er ca. 9,3 px og `#4a4844` på `#1c1c18` (beregnet kontrast ca. 1,87:1). Fejlens “Prøv igen” arver ghost-knappens ca. 9,6 px tekst uden minimumshøjde. Kortene bruger 48 px top/bundpadding og ingen afrunding fra den delte kortstil.
- Rettelse: brug 16 px/1,5 til forklaringer, `#b8b4a8`, 20 px kortpadding, 16 px radius og en 44–52 px høj genforsøgsknap med 16 px tekst. Behold forskellen mellem “kunne ikke hentes” og “på vej”; ændr ikke læse- eller genforsøgslogik. Kun E2-grenen ændres.
- Accept ved 390 px: bekræftet tomt program og fejl fremstår som forskellige tilstande. Genforsøg findes kun i fejltilstanden og er let at ramme. Der vises hverken opdigtede pas eller nye datakoblinger.

## Fremgang / Mine tal

### 10 · Fjern ét lag fold omkring Mine tal — P2 · 45–60 min

- Kilde: `src/entropi2/analysis/Analysis.mjs:59`, `src/entropi2/analysis/Analysis.mjs:65`, `src/entropi2/tracking/atlet/FremgangMineTal.mjs:17`, `src/entropi2/tracking/atlet/FremgangMineTal.mjs:26`, `src/entropi2/tracking/atlet/FremgangMineTal.mjs:29`.
- Nu: dagsformstal med data kan kræve åbning af “Ugerapport og flere analyser”, derefter “Mine tal” og derefter “Søvn” eller “Restitution”. Det enkle overblik ligger tre fold dybt.
- Rettelse: placer det eksisterende, fortsat lukkede Mine tal-fold direkte efter “Din udvikling”, som søskende til ugerapportens fold. Behold Søvn og Restitution som underfold. Flyt kun visningen; brug de eksisterende `showTracking`- og readiness-betingelser.
- Accept ved 390 px: eksisterende søvn-/restitutionsdata nås med højst to åbninger fra Analyse. Sektioner uden datagrundlag opstår ikke. Hentning og fejl skal fortsat være ærlige; der tilføjes ingen ekstra dataforespørgsel.

### 11 · Giv udviklingsgrafens eksisterende tal et tydeligt hierarki — P3 · 45–60 min

- Kilde: `src/entropi2/analysis/DevelopmentView.mjs:45`, `src/entropi2/analysis/DevelopmentView.mjs:46`, `src/entropi2/analysis/DevelopmentView.mjs:49`, `src/entropi2/analysis/DevelopmentView.mjs:52`, `src/entropi2/analysis/DevelopmentView.mjs:59`.
- Nu: seneste e1RM, datoforklaring og ændringstekst gengives som almindelige afsnit. Den 26-ugers graf har smalle søjler, og de enkelte værdier ligger i `title` og det eksisterende datagrundlagsfold. På touch er `title` ikke en pålidelig måde at læse præcise tal på.
- Rettelse: fremhæv det allerede viste seneste tal med 24 px, sæt dato og skønforbehold i en særskilt 14–16 px linje, og placer det eksisterende “tal og datagrundlag”-fold umiddelbart ved grafens billedtekst med 44 px trykhøjde. Behold de 26 uger og tabellen/listen; tilføj ikke tooltipfunktion eller nye estimater.
- Accept ved 390 px: seneste kendte tal kan findes uden at aflæse en søjle. Præcise historiske tal er stadig tilgængelige. Datagab forbliver tomme, og advarslen om gamle data bliver synlig.

## Kost

### 12 · Giv gemmehandlinger samme visuelle vægt som i resten af appen — P2 · 45–60 min

- Kilde: `src/entropi2/nutrition/view.mjs:36`, `src/entropi2/nutrition/view.mjs:119`, `src/entropi2/nutrition/view.mjs:138`, `src/entropi2/nutrition/view.mjs:154`, `src/entropi2/nutrition/nutrition.css:31`, `src/entropi2/home/homeStyles.mjs:9`.
- Nu: kostens fælles knapfabrik giver alle handlinger samme `.cta`-flade. “Gem måltid” og “Log portion” ligner sekundære handlinger, mens Hjem bruger guld til den primære handling. De seks gramknapper er større og mere visuelt markante end gemmehandlingen.
- Rettelse: tilføj en lokal primær stil til de to eksisterende submit-knapper: guldbaggrund, mørk tekst, mindst 52 px højde og samme radius som Hjem. Behold gramknapper og øvrige handlinger sekundære, uden at mindske deres trykflade. Behold beskeden om, at gramknapper kun justerer mængden.
- Accept ved 390 px: i et åbent kostskema er gemmehandlingen den tydeligste knap. +/- gram gemmer fortsat intet, og pending-låsning samt fejltekst bevares.

### 13 · Fold gentagelser fra kosthistorikken, så dagens mål er nemme at nå — P2 · 45–75 min

- Kilde: `src/entropi2/nutrition/view.mjs:62`, `src/entropi2/nutrition/view.mjs:66`, `src/entropi2/nutrition/view.mjs:75`, `src/entropi2/nutrition/view.mjs:89`, `src/entropi2/nutrition/view.mjs:442`.
- Nu: skærmens endelige rækkefølge er intro, vægt, Log hurtigt og mål. Inde i Log hurtigt vises alle gårsdagens måltider samt op til fem favoritter og fem seneste måltider åbent. Der er allerede deduplikering, men en fyldt historik kan stadig skubbe dagens mål langt ned.
- Rettelse: behold vægtens placering og kortenes rækkefølge. Saml de eksisterende grupper “Gentag i går”, “Favoritter” og “Seneste måltider” i ét lukket “Gentag et måltid”-fold inde i Log hurtigt; behold “Notér et måltid” og Skabeloner som de nuværende fold. Opret kun gentagelsesfoldet, hvis mindst én gruppe har data. Behold deduplikeringen.
- Accept ved 390 px: en syntetisk historik med 15 forskellige måltider giver ikke 15 åbne knapper før dagens mål. Alle eksisterende genveje er tilgængelige efter åbning. En tom dagbog får ingen tom historiksektion; loading og hentefejl ændres ikke.

## Beskeder

### 14 · Giv samtaleposter mere tekstbredde og en roligere afsenderlinje — P3 · 45–60 min

- Kilde: `src/entropi2/conversation/ConversationView.mjs:47`, `src/entropi2/conversation/ConversationView.mjs:223`, `src/entropi2/conversation/ConversationView.mjs:227`, `src/entropi2/conversation/ConversationView.mjs:230`, `src/entropi2/conversation/ConversationView.mjs:232`.
- Nu: den ordnede liste tager 32 px indryk. Posten tager yderligere kant og 8 px indryk, og afsender/tid/ulæst ligger i en knap med 16 px sidepadding. Sammen med skærmens indryk bliver afsenderlinjen smal, og lange forhåndsvisninger konkurrerer visuelt med de store afsenderknapper.
- Rettelse: behold `ol` og rækkefølgen, men brug liste uden synlige tal og uden de 32 px indryk; bevar listesemantik med `role="list"`, hvor nødvendigt. Lad afsenderknappen fylde posten med 12 px sidepadding, 14 px læsbar metatekst og mindst 44 px højde. Brug 8 px mellem afsenderlinje og uddrag; behold den eksisterende guldkant og ordet “Ulæst”.
- Accept ved 390 px: tocifret antal poster og lange dato-/afsenderlinjer ombrydes uden overlap. Ændringen påvirker ikke sortering, eksplicit åbning, læst-kvittering, videoåbning eller beskedkladde. Kontroller den eksisterende test, som låser listeindrykket, når denne billet implementeres.

## Profil: afslutning af rammen

### 15 · Træk Tilbage-knappen ind i profilens indholdsramme — P2 · 30–45 min

- Kilde: `src/entropi2/profile/ProfilePage.mjs:40`, `src/entropi2/profile/ProfilePage.mjs:41`, `src/entropi2/profile/Profile.mjs:16`, `src/entropi2/profile/profileStyles.mjs:2`, `src/entropi2/profile/profileStyles.mjs:14`.
- Nu: ProfilePage-sektionen har ingen padding eller breddegrænse, og Tilbage står uden for Profile med `width: 100%`. Selve profilen får sin egen padding og maxbredde. Knappen følger derfor en anden venstrekant og bredde end titel og kort.
- Rettelse: giv profilens tilbageknap en lokal wrapper, som følger den aftalte 20 px sideafstand og 480 px maksimum. Lad selve Profile følge samme ramme uden dobbelt padding. Behold den eksisterende lukning og fokusretur til Mig-menuen.
- Accept ved 390 px: Tilbage, Mig og kortene står på samme venstrekant; knappen har mindst 44 px højde og 12–20 px luft til titlen. Profilåbning skjuler fortsat den underliggende side og bundnavigation; der ændres ingen adgangskontrol eller dataeksport.

## Kontrol ved implementering af de kommende billetter

Brug syntetiske lange tekster, tomme data, loading, fejl og fuldt indhold på 390 px. Kontroller også eksplicit E2 OFF og coachvisning, hvor den berørte kode deles. Kontroller lyst/mørkt systemtema, tekstforstørrelse og fokus, når browserkontrol igen er tilladt. Denne audit er ikke en udført visuel accepttest.

Eksisterende testankre i den offentlige kopi: `src/entropi2/conversation/style-alignment.test.mjs:42` låser de nuværende 32 px og skal opdateres ved 14; `src/entropi2/program/blok/programAppearance.react.test.mjs:39` dækker program/OFF/tomt/fejl; `src/entropi2/session/sessionSteppers.test.mjs:8` dækker sætkontroller; `src/entropi2/nutrition/emptyStates.test.mjs:23` dækker ærlige tomme data, delmål og læsefejl. De er kontrolpunkter for senere implementering, ikke ændringsforslag til denne dokumentationsleverance. Fuld suite og build udføres af Dhurva ved fletning.
