# Coach-portalen: 12 forbedringer for overblik og ro

Billet: E2-COACH-VISUEL-AUDIT1. Produkt: Entropi Coach. Base: `b38ac71755988f9254b1defcfbc9693b3eb7bd14`. Dato: 5. november 2026.

Dette er en kode- og CSS-audit ved 1280 og 390 px. Ingen browser, skærmbilleder, produktionsdata eller visuel rendering er brugt. »Nu« beskriver det, kildekoden bygger; bredder og læsbarhed er afledte vurderinger. Hver af de 12 nummererede sektioner er én selvstændig billet på 30–90 minutter, inklusive en fokuseret syntetisk kontrol. P1 bør løses først, P2 giver mere ro, P3 er senere finish. Ingen P3 er med blandt disse 12.

Ophav er den aktuelle ORDER og de tre medleverede beslutninger fra 3. november: hold det enkelt, byg produktet færdigt, coachens evaluering og planlægning først, atletens overblik enkelt. De beslutninger fra 4. november, som ORDER omtaler, er ikke selv med i input og er ikke læst.

## Afgrænsning og ruter

Entropi 2 er standard ON (`src/entropi2/flag.mjs:4`). Forside og indbakke går gennem `src/Dashboard.jsx:699` til `CoachScreen`; den gamle `ForsideView` er kun OFF-grenen (`src/Dashboard.jsx:756`). Kalenderen bruger fortsat `KalenderView`, med en særskilt, valgfri `ProgramOverblik`-gren (`src/Dashboard.jsx:744`). MIN TRÆNING går gennem `src/dashboard/navigation.js:20` og `src/App.jsx:285` til coachens egen `AthleteView` og `HomeSession`. Valgt profil i forhåndsvisning er ikke i sig selv bevis for ejerskab.

Profilens Hjem, Oversigt, Program, Log, Analyse, Opvarmning, Stævne, Noter og Beskeder er fulgt fra `src/Dashboard.jsx:774` og navigationen i `src/dashboard/hubSektioner.jsx:7`. Kost & mål bruger `CoachKostMaal` (`src/Dashboard.jsx:851`); Kostplan er en fold inde i samme fane (`src/entropi2/kostplan/coach/PortalPlan.mjs:66`), ikke en selvstændig profilfane. Program/Log/Analyse/Oversigt/Stævne har allerede særskilte læsetilstande; de foreslås ikke erstattet af generelle tomme beskeder. Beskeder går i ON gennem `ConversationEntry` (`src/Dashboard.jsx:938`).

Ved 1280 px begrænser `src/index.css:57` app-roden til 1126 px; coachens sidepanel er 220 px (`src/dashboardShared.js:125`). Ved 390 px bruges mobilgrenen under 768 px (`src/Dashboard.jsx:197`), med 16 px rem-grundlag (`src/index.css:28`). Den særlige 375 px-regel i `src/index.css:114` gælder ikke ved 390 px. Tidslinjens spor har allerede vandret rulning og centrering på i dag; disse funktioner skal bevares.

Alle rettelser nedenfor er forslag, ikke implementerede ændringer. Fremtidige stilændringer skal afgrænses til den relevante Entropi 2-flade, så eksplicit OFF bevarer sin adfærd. Ingen billet udvider dataadgang, ændrer ejerskab, indfører lagring eller ændrer aktivering af planer. Eksisterende skriveveje og namespaces bevares.

## 01 · Kalender: vis indlæsning og fejl før tomme tilstande

- **Prioritet og omfang:** P1 · 90 minutter.
- **Kilde:** `src/Dashboard.jsx:744`, `src/dashboard/KalenderView.jsx:10`, `src/dashboard/KalenderView.jsx:251`, `src/dashboard/KalenderView.jsx:455`.
- **Nu, 1280 px:** Kalendergrenen modtager ikke `loading`, `loadError` eller kalenderlæsningens status, mens den alternative ProgramOverblik-gren får de første to. Tomme arrays kan derfor vises som »Ingen atleter« eller »Ingen atleter med datoer endnu«, også når grundlaget ikke er klarlagt.
- **Nu, 390 px:** Samme konklusioner i en smal stak; coachen får ingen lokal forklaring på, om der skal ventes, prøves igen eller oprettes noget.
- **Konkret rettelse:** Før eksisterende roster- og kalenderstatus ind i ON-kalenderen. Vis én lokal indlæsnings-/fejlbesked med eksisterende genforsøg. Vis først tomme beskeder og afledt planstatus efter en fuldført læsning. Tilføj ikke en ny læser.
- **Accept:** Syntetiske loading/error/ready-empty/ready-with-data er forskellige ved begge bredder. Fejl må ikke blive til »Intet program«. OFF-grenen forbliver uændret.

## 02 · Kalender: gør datoer og bloknavne læsbare

- **Prioritet og omfang:** P1 · 60 minutter.
- **Kilde:** `src/dashboard/KalenderView.jsx:194`, `src/dashboard/KalenderView.jsx:257`, `src/dashboard/KalenderView.jsx:279`, `src/dashboard/KalenderView.jsx:334`.
- **Nu, 1280 px:** Datoheaderen er 0,42 rem, ca. 7,6 px; almindelige datoer er mørke `#4a4844`. Bloknavne er 0,6 rem. Mange uger kan stå ved siden af hinanden, men deres etiketter er meget små.
- **Nu, 390 px:** Datoer er ca. 6,7 px, bloknavne ca. 9,6 px. Mobilkolonnerne er 40 px, navnekolonnen 88 px. Efter sidens og kortets indryk er der omtrent plads til fem ugekolonner; dette er beregnet, ikke målt i browser.
- **Konkret rettelse:** Brug mindst 12 px til datoer og 14 px til bloktekst med en lysere sekundær tekstfarve. Giv en valgt blok en fuld etiket med ugeinterval under sporet; øg kolonnebredden efter behov og behold vandret rulning, navnekolonne og i-dag-markering. Skift ikke den eksisterende datoskala.
- **Accept:** Et langt syntetisk bloknavn kan læses fuldt uden hover; ugeinterval og dato er synlige ved begge bredder. I dag centreres fortsat uden at nulstille brugerens efterfølgende rulning.

## 03 · Kalender: giv tidslinjens handlinger tydelige trykflader

- **Prioritet og omfang:** P1 · 90 minutter.
- **Kilde:** `src/dashboard/KalenderView.jsx:196`, `src/dashboard/KalenderView.jsx:305`, `src/dashboard/KalenderView.jsx:324`.
- **Nu, 1280 px:** Opret-uge-celler og blokke er klikbare `div`-elementer. Plus vises kun på hover, og bloknavn/interval støtter sig til `title`. Rækker er 34 px, blokkenes angivne højde 22 px.
- **Nu, 390 px:** Berøring har ingen hover, og de små blokke er svære at ramme. En fokuserbar rulningscontainer gør ikke de enkelte celler og blokke til tastaturhandlinger.
- **Konkret rettelse:** Brug rigtige knapper til gyldige tomme felter og blokke med mindst 44 px trykhøjde. Vis et diskret permanent plus i opretbare felter og et læsbart handlingsnavn for valgt blok. Bevar eksisterende bekræftelse før oprettelse og samme redigeringscallback.
- **Accept:** Tab, Enter og mellemrum når de samme handlinger som tryk. Ingen ny uge oprettes ved fokus eller uden bekræftelse. Prøven kontrollerer eksisterende callbacks med syntetiske værdier.

## 04 · Kalender: fold det fulde atletboard ind

- **Prioritet og omfang:** P2 · 45 minutter.
- **Kilde:** `src/dashboard/KalenderView.jsx:190`, `src/dashboard/KalenderView.jsx:450`, `src/dashboard/KalenderView.jsx:452`.
- **Nu, 1280 px:** Standardgrenen viser planopgaver, tidslinje, opmærksomhedsopgaver og derefter det fulde »Alle atleter«-board. De samme atleter og deres planstatus optræder flere steder.
- **Nu, 390 px:** Boardets navn, forklaring, sidste log og statuschip ombrydes til flere linjer pr. atlet efter tidslinjen. En lang liste forlænger siden meget.
- **Konkret rettelse:** Bevar opgaver og tidslinje som de åbne arbejdsflader. Læg kun det fulde board og dets forklaringsnøgle i en lukket fold »Alle atleter (N)«. Fejl og nødvendige handlinger skal fortsat stå uden for folden.
- **Accept:** Med 20 syntetiske atleter er boardet lukket ved start, åbner med tastatur og viser alle eksisterende felter. Ingen opgave forsvinder bag folden.

## 05 · MIN TRÆNING: gør skiftet tilbage til coachportalen klart

- **Prioritet og omfang:** P1 · 45 minutter.
- **Kilde:** `src/dashboard/navigation.js:20`, `src/App.jsx:285`, `src/AthleteView.jsx:749`, `src/athlete/Ramme.jsx:98`.
- **Nu, 1280 px:** MIN TRÆNING åbner atletoplevelsen, og returknappen hedder »← Coach view«. Den har 0,56 rem tekst og ingen eksplicit minimumshøjde. Coachens egen træning bruger samme indgangsmønster som forhåndsvisning.
- **Nu, 390 px:** Teksten er ca. 9 px; den lille returhandling deler topbaren med logo og profilmenu. Det er sværere at forstå og ramme rolleskiftet.
- **Konkret rettelse:** Vis »Min træning« som diskret kontekst ved bekræftet egen profil og omdøb retur til »Til coachportalen«, mindst 44 px høj med 14 px tekst. Brug værtens eksisterende ejerskabsafgørelse; ændr ikke profilvælger eller skriverettigheder. Afgræns den nye stil og tekst til ON.
- **Accept:** Egen profil kan fortsat logge; anden profils forhåndsvisning kan ikke. Retur bruger samme callback og fungerer ved begge bredder. OFF er identisk med basen.

## 06 · MIN TRÆNING: fjern den ekstra generelle genvejsmenu

- **Prioritet og omfang:** P2 · 45 minutter.
- **Kilde:** `src/entropi2/home/AthleteHome.mjs:226`, `src/athlete/BundNav.jsx:8`, `src/athlete/BundNav.jsx:96`.
- **Nu, 1280 px:** Hjem viser »Resten af din dag« med Analyse, Kost, Mobilitet og Din coach, samtidig med at den faste bundnavigation viser de vigtigste destinationer og Mere.
- **Nu, 390 px:** Genvejene er yderligere fire store knapper i et to-kolonners gitter. De gentager tre direkte bunddestinationer og en destination i Mere.
- **Konkret rettelse:** Fjern det generelle genvejsgitter i coachens egen ON-hjemvisning. Bevar bundnavigationen og alle kontekstknapper: start pas, program, video, koststatus og seneste besked. Før et udtrykkeligt præsentationssignal fra den eksisterende ejerafgørelse; udled ikke ejerskab af et valgt atlet-ID.
- **Accept:** De fire destinationer kan stadig nås fra bundnavigation/Mere. Start pas og registreringer bevares. Almindelig atletvisning og OFF ændres ikke af denne billet.

## 07 · Forside: vis højst tre opgaver før resten af overblikket

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/entropi2/coach/CoachScreen.mjs:47`, `src/entropi2/coach/CoachScreen.mjs:74`, `src/entropi2/coach/CoachScreen.mjs:82`, `src/entropi2/coach/coachModel.mjs:120`.
- **Nu, 1280 px:** Modellen vælger en vigtigste opgave pr. atlet og sorterer dem; visningen tegner alle rækkernes store knapper åbent. Kun den første får fremhævet kant.
- **Nu, 390 px:** Mange atleter med opgaver skubber »Dine atleter« og de øvrige folde langt ned, selv om forsiden skal vise det vigtigste først.
- **Konkret rettelse:** Vis de første tre i modellens eksisterende rækkefølge, derefter en lukket »Vis resten (N)«. Bevar det samlede antal synligt. Begræns kun forsidens præsentation; indbakken skal stadig kunne gennemgå hele arbejdslisten.
- **Accept:** Fixture med 0, 1 og 10 opgaver viser korrekte antal og samme prioritering. Alle callbacks og returadresser bevares; loading og fejl tælles ikke som opgaver.

## 08 · Atletliste: tilføj lokal søgning i »Dine atleter«

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/entropi2/coach/CoachScreen.mjs:88`, `src/entropi2/coach/CoachAthleteWorkspace.mjs:41`, `src/dashboard/Sidebar.jsx:81`.
- **Nu, 1280 px:** Den foldede hovedliste tegner et arbejdsområde for hver atlet; sidepanelet har desuden sin egen fulde navneliste. Der er ingen søgning i denne hovedliste.
- **Nu, 390 px:** Hovedlisten er én lodret stak, og sidepanelet er skjult som udgangspunkt. En bestemt atlet kræver gennemlæsning eller rulning.
- **Konkret rettelse:** Tilføj ét navnesøgefelt øverst i den åbne »Dine atleter«-fold. Filtrér kun allerede indlæste, tilladte modelrækker; bevar rækkefølgen og vis »X af N«. Søgning skal ikke filtrere »Kræver dit blik« eller skrive i storage.
- **Accept:** Syntetiske navne, langt navn, intet match og nulstilling fungerer ved begge bredder. »Ingen match« er forskellig fra manglende/fejlede data; valgt atlet åbner som før.

## 09 · Profilfaner: gør fanenavne og Mere-menuens tilstand tydelige

- **Prioritet og omfang:** P1 · 60 minutter.
- **Kilde:** `src/dashboard/ProfilHoved.jsx:145`, `src/dashboard/ProfilHoved.jsx:173`, `src/dashboard/ProfilHoved.jsx:188`, `src/dashboard/ProfilHoved.jsx:196`.
- **Nu, 1280 px:** Faner og menuvalg bruger 0,6 rem versaler med stor bogstavafstand. Mere-knappen har ikke `aria-expanded`. I den valgfri `coachRyd`-gren hedder den altid »Mere«, også når en sekundær fane er aktiv; standardgrenen viser allerede det aktive sekundære navn.
- **Nu, 390 px:** Teksten er ca. 9,6 px. Trykhøjden afhænger af padding, og menuen har minimumsbredde 11 rem. De mange faner ligger på flere rækker eller i menuen.
- **Konkret rettelse:** Brug 14 px almindelig tekst og mindst 44 px trykhøjde i ON-profiler. Bevar aktivt sekundært fanenavn synligt, også med `coachRyd`, og tilføj ekspanderet tilstand, Escape-lukning og fokusretur. Giv menuen en maksimumsbredde inden for visningen; behold de eksisterende sektioner og rækkefølge.
- **Accept:** Hver fane inkl. Kost & mål kan vælges med tastatur; den aktive fremgår bagefter. Standard og valgfri opryddet navigation kontrolleres hver for sig. Ingen global ændring af `s.btnGhost` eller OFF.

## 10 · Kost & mål: behold mål og trend åbne, fold vægtdetaljer

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/entropi2/kostMaal/KostMaal.mjs:57`, `src/entropi2/kostMaal/KostMaal.mjs:81`, `src/entropi2/kostMaal/KostMaal.mjs:94`, `src/entropi2/kostMaal/KostMaal.mjs:113`.
- **Nu, 1280 px:** Kcal/proteinmål, kostuge, profilvægt, seneste vejning, ugegennemsnit, trend og proteinforslag står i samme åbne strøm. Kun den metodiske forklaring er foldet.
- **Nu, 390 px:** Hvert vægtpunkt fylder sin egen definitionsblok med bundmargen; Kostplan ligger længere nede efter dette grundlag.
- **Konkret rettelse:** Behold aktuelle mål, seneste vejning og dokumenteret trend åbne. Flyt profilvægt, ugegennemsnit og metode til én »Vægtgrundlag«-fold. Vis hjælpeforslag under en særskilt fold, som åbnes ved målredigering. Lad load/error/genforsøg og manglende data forblive synlige udenfor.
- **Accept:** Samme beregnede tal og datoer før/efter, ingen nul-erstatning for ukendt. Gem/Annuller og fejl bevares; Kostplan kan nås med mindre rulning i den smalle visning.

## 11 · Kostrapport: giv rapportoverskriften lys farve i coachfladen

- **Prioritet og omfang:** P1 · 30 minutter.
- **Kilde:** `src/entropi2/kostplan/coach/PortalPlan.mjs:65`, `src/entropi2/kostplan/coach/activeReport.mjs:46`, `src/entropi2/kostplan/rapport/reportView.mjs:77`, `src/entropi2/entropi2.css:2`, `src/index.css:69`.
- **Nu, 1280 px:** Når et gyldigt måltidsgrundlag og en aktiv plan giver en rapport, tegnes »Plan og registreret kost« som h2 uden egen farve. Rapporten ligger uden for `data-entropi2-kost-maal` og `data-entropi2-coach`. Den eksisterende lyse overskriftsregel dækker derfor ikke denne rapport; global h2 bruger `--text-h`, som er `#08060d` i standardlyst tema, over portalens mørke bund.
- **Nu, 390 px:** Samme farveproblem; rapportoverskriften går desuden fra 24 til 20 px via den globale regel. I systemets mørke tema er `--text-h` allerede lys; fundet gælder derfor især lyst tema.
- **Konkret rettelse:** Giv rapportens egen sektion en stabil markør og sæt h2/h3-farve under coachens ON-rod til `#edeae2`. Afgræns selektoren til rapporten. Kostplan-editoren bruger i portalens lokale tilstand h3 og skal ikke fejlagtigt behandles som den samme h2-fejl.
- **Accept:** Kildestyret prøve kontrollerer rapportmarkør og scoped farveregel ved lyst/mørkt tema og begge bredder. Rapportens data-/adgangsvagt og OFF ændres ikke.

## 12 · Kostplan: forkort instruktionerne ved oprettelse og gennemgang

- **Prioritet og omfang:** P2 · 75 minutter.
- **Kilde:** `src/entropi2/kostplan/coach/PortalPlan.mjs:120`, `src/entropi2/kostplan/coach/view.mjs:58`, `src/entropi2/kostplan/coach/view.mjs:79`, `src/entropi2/kostplan/coach/view.mjs:133`.
- **Nu, 1280 px:** Når Kostplan åbnes, vises målformular og måltidsvalg. For en profil med gramgenerator følger flere lange forklaringer om beregning, standardantagelser og portionsgrænser; efter generering kommer endnu en gennemgangstekst før alle måltidsfelter og gemmehandlinger.
- **Nu, 390 px:** Formularens adaptive gitter bliver en lodret stak. Instruktionerne forlænger vejen til fødevarer og handlinger, selv om dele af beregningsgrundlaget allerede er foldet.
- **Konkret rettelse:** Behold én kort handlingssætning pr. trin og læg den uddybende metode i eksisterende/nærtliggende »Om forslaget«-fold. Behold synlig status for lokal kladde, alle fejl og den korte besked om at gennemgå portioner. Gem og aktivering skal beholde deres eksisterende betingelser og ordlyd; antagelser må fortsat kunne læses før brug.
- **Accept:** Ny plan, gendannet kladde, genereret forslag og gemmefejl er tydelige ved begge bredder. Ingen automatisk generering, gemning eller aktivering. Den eksisterende namespaceskrivning ændres ikke.

## Foreslået rækkefølge og kontrol

Start med 01–03 (kalenderens sandhed og betjening), derefter 05, 09 og 11. Gennemfør P2-billetterne én ad gangen. De angivne tidsrammer gælder præsentation og lokale prøver, ikke nye datakilder eller ombygning af modeller.

Syntetiske fixtures skal dække nul, én og mange atleter; lange navne og bloknavne; ingen dato, ugyldig dato og gyldig dato; loading, fejl og komplet tomt svar; egen profil, anden profils forhåndsvisning og eksplicit OFF; kost uden mål/vejninger samt lokal og aktiveret plan. Kun konstruerede navne og værdier bruges. Bevar de eksisterende foldninger, ærlige ukendte værdier, i-dag-linje, manuelt rul og de beskyttede skrivecallbacks.

Den dokumentationsændring, denne audit leverer, ændrer ingen af disse flader. Browserkontrol af de senere implementerede billetter ved præcis 1280 og 390 px samt fuld suite/build tilhører integrationen hos Dhurva. En separat frisk K-kontrol af den endelige pakke er fortsat nødvendig; producentens lokale checks er ikke denne kontrol.
