# Entropi Coach: ydelse ved atletens første åbning

Dato: 5. november 2026. Kildebase: `dda192d6841fde324b42d83c5bd1d82b9cc29ad0`
(`release/entropi-samlet-neste`). Billet: E2-YDELSE-AUDIT1.

**Konklusion:** Den vigtigste kandidat til en hurtigere mobilstart er at mindske
atletvisningens statiske importkæde. Entropi 2 indlæser hjem, pas, kost, mobilitet
og analyse gennem samme atletindgang. Coachdashboardet har allerede en dynamisk
indgang. Prioritér atletens egne skærmgrænser før yderligere opdeling af coachen.

**Målestatus: delvis.** Tallene nedenfor er målte kildebytes og importrelationer,
ikke byggede chunkstørrelser, downloadbytes eller en måling af mobilhastighed.
Den fastlåste kildepakke indeholder hverken `dist/`, buildlog, `index.html`,
Vite-konfiguration eller installerede afhængigheder. Workerens rammer forbyder
build, installation, net og browser; Dhurva kører build ved fletning. Derfor kan
den aktuelle liste over største byggede bundter og chunkadvarsler ikke verificeres
her. Der er ingen opdigtede buildtal i denne audit. Måleplanen nedenfor beskriver
præcis, hvad der skal suppleres, før den del af auditten er færdig.

## Metode og talgrundlag

Alle 20 poster i inputmanifestet er kontrolleret for byteantal og SHA-256;
inputmanifestets egen fastlåste SHA-256 er også kontrolleret.
De 14 arkivdele er samlet, og arkivets SHA-256 er verificeret:
`85538cd34229e44b8ba852e13f5f3b54496cca655b4d8b3e88b7dcfd1a27b550`.
Kun almindelige filer og mapper med sikre relative stier er rekonstrueret i en
separat kildekopi. Ingen app, klient eller datalæser er startet.

En offline kildeanalyse følger bogstavelige lokale `import`- og `export … from`-
referencer rekursivt. Statiske og dynamiske kanter tælles hver for sig.
En fils rå UTF-8-bytes tælles én gang pr. kæde; fælles filer tælles én gang i en
union. `import()`-mål følges ikke i de statiske summer. Bare pakkeimports
(`react`, Supabase mv.) registreres, men deres afhængigheders bytes er udeladt.
Metoden er leksikalsk, ikke bundlerens modulrapport: den vurderer ikke brugte
exports, tree shaking, sideeffekter, minificering eller endelig chunkplacering.
Summerne er derfor hverken en øvre grænse for download eller et sparetal.
Metodekoden følger i leverancens `ADAPTER.md`.

| Statisk indgang/kæde | Unikke lokale filer | Rå bytes |
| --- | ---: | ---: |
| `src/main.jsx` inklusive App og basis-CSS | 23 | 101.624 |
| `src/AthleteView.jsx` inklusive fælles afhængigheder | 285 | 1.524.900 |
| Union af main og AthleteView | 297 | 1.573.863 |
| AthleteView-filer ud over mains kæde | 274 | 1.472.239 |
| `src/Dashboard.jsx`, kun tilgængelig del af kæden | 245 | 1.505.079 |
| `src/entropi2/home/HomeSession.mjs` | 62 | 244.712 |
| `src/entropi2/session/sessionView.mjs` | 38 | 168.693 |
| `src/entropi2/Entropi2Kost.mjs` | 25 | 109.503 |
| `src/entropi2/analysis/Analysis.mjs` | 53 | 256.336 |
| `src/entropi2/mobility/Mobility.mjs` | 18 | 98.330 |

Rækkerne overlapper og må ikke lægges sammen. Alle lokale statiske referencer i
main + AthleteView kan opløses i kopien. Dashboard-kæden mangler
`supabase/functions/_shared/progressionState.js`, som ligger uden for inputpakkens
scope; dens række er ufuldstændig. Det er en inputbegrænsning, ikke et konstateret
buildproblem. Dynamisk indlæst CSS er ikke med i de statiske summer.

## Hvilke moduler fylder mest?

De største enkelte filer i den fundne graf fra main, hvor både statiske og
bogstavelige dynamiske kanter følges, er nedenfor. Rangeringen gælder kildekode,
ikke den byggede kode. Testfiler, historiske baselines og ubrugte kildefiler er
ikke taget med, blot fordi de ligger under `src/`.

| Kildemodul | Rå bytes | Indlæsning i kildekoden |
| --- | ---: | --- |
| `src/dashboard/ProgramTab.jsx` | 97.778 | Dynamisk coachfane |
| `src/dashboard/AnalyseTab.jsx` | 97.286 | Dynamisk coachfane |
| `src/athlete/ProgramTab.jsx` | 95.235 | Dynamisk atletfane |
| `src/dashboard/vaLocalDocuments.js` | 73.311 | Statisk fra coachens AnalyseTab |
| `src/AthleteView.jsx` | 70.690 | Dynamisk fra App |
| `src/athlete/MobiliseringTab.jsx` | 66.229 | Dynamisk atletfane |
| `src/Dashboard.jsx` | 63.191 | Dynamisk fra App |
| `src/athlete/HjemTab.jsx` | 57.080 | Statisk fra AthleteView, også med Entropi 2 tilgængelig |
| `src/athlete/EnkelHjemTab.jsx` | 56.459 | Dynamisk alternativt hjem |
| `src/volume/muskelkort.generet.json` | 53.804 | Fundet via dynamiske fanegrene |

Atletens statiske kæde indeholder også `athlete/saetSkrivning.js` (51.746 bytes),
`athlete/DagensPasCard.jsx` (45.826), `athlete/laesninger.js` (37.362),
`entropi2/nutrition/view.mjs` (30.438), `coachBriefingRules.js` (25.996) og
`athlete/useVideoCoachBro.js` (23.080). Disse er mere relevante for første åbning
end store coachfaner, der allerede ligger bag en dynamisk grænse.

`coachBriefingRules.js` nås gennem `athlete/smerteStop.js`; det er ikke bevis for,
at hele coachværktøjet indlæses. Den fælles sikkerhedslogik skal bevares.
De fire Supabase-pakker og React er statiske eksterne imports i basiskæden.
Lockfilen angiver React/React DOM 19.2.8, Vite 8.2.1 og Supabase-delpakkerne
2.112.3. Deres byggede bidrag er endnu ikke målt.

## Første åbning af atletens hjem

Forløbet er udledt af kildekoden med Entropi 2 som standard, en atletrolle,
hjem som startfane og tom browsercache. Det er ikke en optaget netværkstrace.

1. `main.jsx:1–5` importerer React, React DOM, basis-CSS, App og appopdatering.
   `App.jsx:7–14` importerer blandt andet Supabase, login, fejlgrænse og
   `LazyBoundary`. Derfor er login- og klientkode en del af den statiske basiskæde.
2. `App.jsx:22–23` definerer separate dynamiske indgange til Dashboard og
   AthleteView. Atletgrenen vælger kun AthleteView (`App.jsx:298`). Der findes
   ingen statisk import af selve Dashboard i den undersøgte atletkæde.
   Fælles moduler kan stadig blive placeret i delte chunks af buildværktøjet.
3. `AthleteView.jsx:28` importerer det tidligere HjemTab statisk. Linje 46
   importerer `entropi2/athleteEntry.mjs`, som statisk re-eksporterer HomeSession,
   kost, samtale, mobilitet, analyse og `LOCAL_FOODS`. Det giver ingen selvstændig
   dynamisk grænse mellem disse skærme. At en skærm kun renderes på en bestemt
   fane, udsætter ikke i sig selv dens statiske modulimport.
4. `AthleteView.jsx:147` kalder den browserafgrænsede stilindlæsning ved Entropi 2.
   `entropi2/styles.mjs:3–7` starter dynamiske imports af både `entropi2.css` og
   `nutrition/nutrition.css`. Kostens CSS er dermed ikke forbeholdt kostfanen.
5. Hjem viser `HomeSession` (`AthleteView.jsx:814–815`). Den importerer både
   AthleteHome og `homeSessionBridge.mjs`, som importerer `sessionView.mjs`
   statisk. Pasformular, historik, pladeberegner, tempo, supersæt, opvarmning og
   mobilitetsplan er dermed allerede i hjemmets importkæde før start af passet.

Der er også datalæsninger under opstart. Efter indlæsning af atletprofilen kaldes
program, måltidslog og dagsform straks (`athlete/laesninger.js:158–160`). Kostens
egne fødevarer, skabeloner, historik og favoritter, beskeder, vægt, rekorder,
opvarmningsskabeloner og stævnedata kaldes fra `setTimeout(..., 0)` samme sted
(:161–172). Det udsætter arbejdet et event-loop-tick, ikke til fanen åbnes.
`AthleteView.jsx:602–605` starter desuden læsning af delte videoanalyser.
Dette er konstaterede kaldesteder; svartider, datamængder og antal faktiske
netværksrequests er ikke målt. Samtidig kan cache, fejl og programvalg ændre forløbet.

## Første åbning af dagens pas

Entropi 2's startknap går gennem HomeSession til
`homeSessionBridge.mjs:34–47`. Broen kontrollerer blandt andet aktuel dag,
valgt uge, atlet og de nødvendige logcallbacks, opdaterer visningen og starter
controlleren. Der er intet `import()` på denne vej. Et klik fra et allerede
åbent hjem til dagens pas tilføjer derfor ingen dynamisk JS-grænse i denne
kildekæde. Det tunge pasmodul er statisk tilgængeligt fra hjemmet.
Det beviser ikke nul netværkstrafik: brugerhandlinger, lagring og logopdateringer
kan stadig udføre kald.

Atletens programoversigt er en anden vej: `AthleteView.jsx:58,890–893` vælger
`import('./athlete/ProgramTab.jsx')` gennem LazyBoundary. Den fanes isolerede
statiske kildekæde er 44 filer / 294.983 bytes inklusive overlap med hjemmets
kæde. Tallet er hverken programmets byggede chunkstørrelse eller klikets ekstra
download. Dagens pas i Entropi 2 og denne programfane må ikke sidestilles.

## Forslag efter forventet gevinst for atleten på mobil

Prioriteringen er en hypotese baseret på importrelationerne. Ingen besparelse i
millisekunder eller gzip er verificeret; mål hver ændring før næste opdeling.

| Prioritet | Konkret ændring i en senere kodebillet | Hvorfor og validering |
| --- | --- | --- |
| 1 | Giv Entropi 2's kost, analyse og mobilitet hver sin `() => import(...)`-indgang gennem den eksisterende LazyBoundary. Flyt legacy HjemTab bag den OFF/legacy-gren, der bruger det. Fjern de tilsvarende statiske veje gennem athleteEntry. | Direkte kandidat til at reducere det, hjemmet skal have klar. Kost-, analyse- og mobilitetskæderne er henholdsvis 109.503, 256.336 og 98.330 rå bytes med overlap. Kontrollér også den direkte `mountKost`-import i AthleteView: den kan ellers holde kostkæden statisk. Buildrapporten skal vise, at skærmspecifik kode faktisk er flyttet ud. |
| 2 | Indlæs pasvisningen fra HomeSession dynamisk ved den eksplicitte starthandling; behold det lille hjem og valgkontrollen først. | `sessionView.mjs` har en statisk kæde på 168.693 rå bytes, som nu nås før start. Fælles hjem/pas-modeller bliver tilbage, så hele tallet kan ikke spares. Vis lokal indlæsning og genforsøg; lås dobbeltklik. Kontrollér dag, uge og atlet igen efter importen, og kassér et sent svar ved skift eller lukning. En eventuel forudindlæsning på tydelig startintention skal måles, ikke startes ubetinget på hjem. |
| 3 | Indlæs `athlete/lokaleFoedevarer.js` ved første kostbrug/søgning, og adskil kostens fulde katalog og CSS fra hjemmets lille kostresumé. Flyt ikke kostdata, som resuméet faktisk kræver. | Kataloget er 16.778 rå bytes og re-eksporteres statisk fra athleteEntry. `AthleteView.jsx:538` bygger e2Foods uden fanebetingelse. Fjern alle aktive statiske katalogveje før gevinst forventes. Udskyd kun øvrige ikke-synlige datalæsninger til brug; `setTimeout(0)` er ikke lazy-indlæsning. |
| 4 | Bevar den eksisterende behovsstyrede videoiframe og import af videoklargøring; skil tung upload-/reviewkode fra de små nødvendige kø- og afbrudt-upload-værn. | `athlete/useVideoCoachBro.js` er 23.080 rå bytes; dens kæde er 105.871 med overlap. `Ramme.jsx:27–35` opretter kun iframen i den åbne videovisning, og broen importerer allerede `videoOptag2Upload.mjs` dynamisk (:136). `public/videocoach.html` er ikke leveret, så videomotorens størrelse/egne imports er ukendt. Fjern ikke opstartsbehandling af eksisterende usendte uploads blot for at spare bytes. |
| 5 | Hold coachens værktøjer bag Dashboard-indgangen; opdel eventuelt store statiske coachfaner/modals og coach-only dele af fælles indgange yderligere. | Dashboard er allerede dynamisk, og Program/Analyse er allerede dynamiske faner. Ekstra coachopdeling har derfor mindre direkte dokumenteret effekt på atletens start. ConversationEntry importerer coachens ugebrevslæser statisk (:3), men kalder den kun for coach (:27–29); det er en konkret kandidat til dynamisk coach-only indlæsning. Bevar fælles smerte-/sikkerhedsregler. Verificér i buildrapporten, om delte chunks overhovedet sender coachspecifik kode til atleten. |

Alle efterfølgende ændringer skal bevare eksplicit `entropi2={false}`, kun skrive
i det eksisterende bruger-/atletafgrænsede lagringsnavnerum og vise lokale,
ærlige fejl ved manglende data eller fejlet import. LazyBoundarys genforsøg og
beskyttelse mod endeløs genindlæsning bør genbruges. Opdeling må ikke flytte
logning, rettigheder eller bekræftelsesgrænser til en mindre sikker sti.

## Den manglende buildmåling hos Dhurva

På den autoriserede integrationskopi af den angivne base skal Dhurva supplere:

1. Kør `npm run build`, gem exitkode og hele outputtet med filnavne,
   ukomprimerede/gzip-størrelser og ordrette advarsler om store chunks. Registrér
   faktisk revision, Node/npm-version og den anvendte konfiguration. Gentag på
   den endelige integrationsrevision; denne billet ændrer kun dokumentation.
2. Sortér de udsendte JS- og CSS-filer efter faktisk byteantal. Registrér mindst
   de ti største og deres gzip-størrelse. Manglende gzip-tal beregnes fra de
   udsendte bytes og mærkes som lokalt beregnet, ikke faktisk serverkomprimering.
   Dokumentér advarselstærsklen fra den anvendte konfiguration. Ingen tærskel
   antages ud fra denne kildepakke.
3. Brug buildværktøjets modul-/chunkrapport til at koble store chunks til deres
   inputmoduler, statiske afhængigheder, dynamiske afhængigheder og CSS. Angiv
   måleenheden for modulbidrag. Rå kildebytes må ikke præsenteres som et moduls
   minificerede bidrag; shared chunks må kun tælles én gang i en indlæsningssum.
4. I den separat autoriserede lokale mobilmåling med syntetiske data: optag
   kold første åbning af hjem, klik til Entropi 2's pas, og separat programfanen.
   Registrér den første indlæsnings samlede overførte JS/CSS, klikets ekstra
   bytes, cacheforhold, enheds-/netprofil og tid til brugbart hjem/pas. Mål også
   varm genåbning. Hold videoens separate dokumenttrafik adskilt fra SPA-chunks.
   Dette arbejde er ikke udført af workeren.

| Byggede bundter og første indlæsning | Status ved denne aflevering |
| --- | --- |
| Ti største chunks med byte-/gzip-tal | Ikke målt; dist/buildlog mangler |
| Store-chunk-advarsel og tærskel | Ikke verificeret |
| Største byggede modulbidrag | Ikke målt; kun kildeinventar ovenfor |
| Faktiske første requests til hjem og pas | Ikke målt; importforløb gennemgået |
| Mobil tid til brugbart hjem/pas | Ikke målt |

De fokuserede eksisterende prøver blev kørt på den faktiske kildekopi med
syntetiske fixtures før og efter dokumentændringen: 13 bestået, 0 fejlet i hver
kørsel. De kontrollerer chunkgenforsøg, Home med OFF/navnerum og pasrendererens
registrering/oprydning. De måler hverken bundtstørrelse eller browserydelse.
Ingen runtimekode, flag eller data er ændret af denne billet.
