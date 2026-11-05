# Atletens visuelle gennemgang 3 — Entropi Coach

Kandidat: E2-UI-GENNEMGANG3. Base: `9218bbc8a6cb1af0bd894dafb4886fa4127e0f71`.
Målfil ved integration: `docs/audit/atlet-visuel3.md`.

Gennemgangen følger ORDER.md og de fastlåste offentlige kildekopier efter dagens fletninger. Det er en kildebaseret UX-gennemgang med syntetiske moduleprøver, ikke en afprøvning af pixels, telefon eller browser. Fil:linje nedenfor henviser til basens uændrede kildefiler. De beskrevne visninger følger af rendergrenene; deres faktiske udseende skal kontrolleres ved implementering.

Prioritering: P1 spærrer for et forståeligt eller sikkert videre forløb; P2 gør den almindelige atletoplevelse mærkbart enklere; P3 fjerner gentagelser. Estimaterne omfatter en afgrænset rettelse og fokuserede prøver, ikke migration eller nye backendkontrakter. Hvert nummer er én selvstændig billet. Forslagene skal bevare OFF, ejerskab, read-only og eksisterende bekræftelse af registreringer.

Allerede håndteret i basen: Hjem folder øvelser og coachnoter; check-in fortæller eksplicit, at kladden kun er lokal; Fremgang folder sekundære analyser; pas sammenligner ikke samlet volumen ved forskelligt antal sæt. Disse løsninger skal bevares. VideoCoach nås aktuelt gennem `src/athlete/Ramme.jsx:34`; den indlejrede HTML er ikke med i inputtet. Fund 2 handler derfor kun om den verificerbare ydre ramme.

## 1. Vis kostplanens første læsefejl og en vej videre

- **Prioritet og omfang:** P1 · 60 minutter.
- **Kilde:** `src/entropi2/kostplan/atlet/KostDayFrame.mjs:19`, `src/entropi2/kostplan/atlet/KostDayFrame.mjs:27`, `src/entropi2/kostplan/atlet/KostplanAtlet.mjs:21`.
- **Brugeren ser nu:** Ved første `load-error`, før en plan er kendt, vises kun trackeren. Planvisningen monteres kun ved `mode === 'plan'`, så dens fejltekst og knap til genindlæsning nås ikke. Atleten kan ikke skelne mellem ingen plan og en plan, der ikke kunne hentes. Samme ramme skjuler planens første indlæsningsstatus.
- **Konkret rettelse:** Lad rammen vise én kompakt status over den eksisterende tracker ved første indlæsning og én fejl med “Hent dagens plan igen” ved første læsefejl. Brug `controller.load`; bevar trackeren og dens uafsluttede input. Vis ingen falsk “ingen plan”-tilstand.
- **Afgrænsning og accept:** Ret kun rammens præsentation og dens syntetiske prøve. Ved fejl uden tidligere plan er fejlen og retry synlige; et retry monterer ikke trackeren igen. En bekræftet dag uden plan viser fortsat den direkte tracker uden fejladvarsel.
- **Eksisterende prøve at tilpasse:** `src/entropi2/kostplan/atlet/frame.synthetic.test.mjs` låser i dag netop den direkte tracker ved første fejl. Det er en eksisterende forventning, som denne billet bevidst ændrer.

## 2. Giv VideoCoach en lukknap uden for iframe-indholdet

- **Prioritet og omfang:** P1 · 90 minutter.
- **Kilde:** `src/athlete/Ramme.jsx:28`, `src/athlete/Ramme.jsx:34`, `src/AthleteView.jsx:815`.
- **Brugeren ser nu:** Efter valg af sæt består den faste fuldskærmsdialog af en iframe. Den ydre ramme har ingen egen lukknap. Hvis iframe-indholdet er tomt eller ikke indlæses, findes ingen lukhandling i denne rendergren. Sætvælgerens `onClose` hjælper kun, mens vælgeren vises.
- **Konkret rettelse:** Tilføj en altid synlig knap “Tilbage til træning” i dialogens egen topbjælke, med mindst 44 px trykflade. Lad den bruge den eksisterende lukhandling og returnere fokus til åbneren. Giv iframe plads under bjælken. Lukning må ikke blive en ny implicit afsendelses- eller annulleringshandling; eventuel igangværende afsendelse skal følge den eksisterende brokontrakt.
- **Afgrænsning og accept:** Kun den ydre dialog og dens fokusretur. En tom iframe kan forlades med knappen og tastatur. Den valgte træningskontekst bevares, og ingen video sendes ved lukning. Indholdet af den ikke-leverede HTML vurderes ikke her.
- **Prøvespor:** Søg videre fra `src/athlete/videoCoachBro.appTest5.test.js` og `src/athlete/videoSetSelection.test.js`; tilføj en fokuseret prøve af Rammes egen lukhandling. Den konkrete browserkontrol hører til implementeringsbilletten.

## 3. Forklar samtalens opdeling i ulæste og tidligere indlæg

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/entropi2/conversation/ConversationView.mjs:234`, `src/entropi2/conversation/ConversationView.mjs:251`.
- **Brugeren ser nu:** Alle ulæste indlæg flyttes foran de læste. Hvert indlæg har dato og eventuelt “Ulæst”, men listen har ingen gruppeoverskrifter. Ved blandede læsestatusser springer datoerne derfor mellem de to grupper uden en synlig forklaring. Et læsekvit kan flytte et åbnet indlæg til den anden gruppe.
- **Konkret rettelse:** Bevar den eksisterende sortering og eksplicitte læsekvittering, men indsæt diskrete, semantiske overskrifter “Ulæste” og “Tidligere indlæg”, når begge grupper findes. Lad “Spring til første ulæste” fortsat pege på indlægget. Bevar åbnet indhold og fokus ved flytning.
- **Afgrænsning og accept:** Kun listens gruppering i atletvisningen, ingen ændring af samtalemodel eller læseskrivninger. En syntetisk blanding af datoer og læsestatusser viser begge grupper; en ensartet liste får ingen unødig ekstra overskrift. Semantikken skal fungere uden tomme listepunkter.
- **Eksisterende prøver:** `src/entropi2/conversation/conversationPresentation.test.mjs` og `src/entropi2/conversation/unreadQuickReplies.test.mjs`.

## 4. Gør mål i profilen tydeligt ugemte under redigering

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/entropi2/profile/profileGoalsController.mjs:44`, `src/entropi2/profile/ProfileGoalsView.mjs:28`, `src/entropi2/profile/ProfilePage.mjs:29`.
- **Brugeren ser nu:** Når et mål ændres, sættes fasen til `ready`, og beskeden tømmes. Det tidligere gemte resumé står over redigeringsfelterne. Formularen kan foldes sammen, og “Tilbage” lukker profilen uden en synlig besked om de ugemte ændringer. Ved genåbning indlæses de gemte værdier.
- **Konkret rettelse:** Beregn en dirty-status ud fra kladde og gemte mål. Vis “Ændringer er ikke gemt” ved redigeringssummary, også når den er foldet, og gør gemte/ugemte værdier sprogligt tydelige. Ved profilens egen Tilbage-handling med dirty-status skal atleten kunne vælge at fortsætte redigeringen eller kassere ændringerne.
- **Afgrænsning og accept:** Kun profilens lokale målredigering og egen Tilbage-handling; ingen global navigationsvagt og ingen autosave. Gem eller Fortryd fjerner dirty-status. Kassering kræver et udtrykkeligt valg. Lokal-only-forklaringen bevares.
- **Eksisterende prøver:** `src/entropi2/profile/profileGoalsView.test.mjs`, `src/entropi2/profile/profileGoals.test.mjs`.

## 5. Giv programmets intensitetsmål en forståelig sammenhæng

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/AthleteView.jsx:61`, `src/athlete/ProgramTab.jsx:88`, `src/athlete/ProgramTab.jsx:710`.
- **Brugeren ser nu:** Den aktive programfane samler ugens forskellige intensitetstekster i et Set og viser hver tekst som et mærke under “Ugens intensitet · plan”. Ved blandede mål, fx RPE og procent, kan der stå mange mærker uden angivelse af, hvilke øvelser de tilhører. Alle mærker vises udfoldet. Pas er allerede foldbare i denne aktive fane.
- **Konkret rettelse:** Behold ét fælles mål synligt, når hele ugen bruger samme mål. Ved blandede mål vises kun “Flere intensitetsmål · se pr. øvelse” som foldningsindgang. Indeni kobles hver coachskrevet intensitet til pas og øvelse. Flyt den eksisterende besked om manglende mål ind samme sted. Beregn aldrig et gennemsnit af RPE og procent.
- **Afgrænsning og accept:** Kun intensitetsoversigten og dens hjælper i den aktive `ProgramTab.jsx`, ingen ændring af ugevalg, pasfoldning eller logger. Prøv ét mål, blandede mål og delvist manglende mål. Ordinationerne bevares ordret, og fejl får fortsat en utilgængelig-status. Det ubundne `entropi2/program/ProgramEntry.mjs` skal ikke kobles ind som del af billetten.
- **Eksisterende prøver:** `src/athlete/programWeekReadability.synthetic.test.mjs` og `src/athlete/programQol.synthetic.test.mjs`; tilføj blandede intensiteter i den eksisterende syntetiske fixture.

## 6. Fortæl hvilken slags rekord Hjem fejrer

- **Prioritet og omfang:** P2 · 90 minutter.
- **Kilde:** `src/entropi2/home/homeRecord.mjs:129`, `src/entropi2/home/homeRecord.mjs:138`, `src/entropi2/home/AthleteHome.mjs:28`.
- **Brugeren ser nu:** Både forbedret tungeste sæt og forbedret beregnet maksimum kan udløse det samme kort “Ny rekord: [løft] [kg] × [reps]”. Modellen returnerer ikke rekordtypen til kortet. Et lettere sæt med flere gentagelser kan derfor fejres uden forklaring af, hvad der blev bedre.
- **Konkret rettelse:** Videregiv den allerede valgte rekordtype fra modellen. Skriv enten “Ny rekord i tungeste sæt” eller “Nyt bedste beregnede maksimum”, og vis det udførte sæt som belæg. Ved beregnet maksimum skal tallet altid mærkes “e1RM · skøn”. Brug den eksisterende beregning; indfør ingen ny rekordregel.
- **Afgrænsning og accept:** Kun rekordprojektion og HomeRecordCard med prøver. En forbedring med lettere vægt/flere reps har en anden forklaring end et nyt tungeste sæt. Første baseline, ubekræftede sæt og fejl må stadig ikke fejres.
- **Eksisterende prøver:** `src/entropi2/home/homeRecord.test.mjs` indeholder allerede begge rekordtyper; udvid også kortets prøve i `src/entropi2/home/homeRecord.react.test.mjs`.

## 7. Lad atleten genfinde passets rekordkvittering efter fem sekunder

- **Prioritet og omfang:** P2 · 90 minutter.
- **Kilde:** `src/entropi2/session/sessionRecordCelebration.mjs:49`, `src/entropi2/session/sessionRecordCelebration.mjs:52`, `src/entropi2/session/sessionView.mjs:123`.
- **Brugeren ser nu:** Den bekræftede rekord vises som en statuslinje ved passets overskrift. Værten fjerner kvitteringen efter fem sekunder. Når opsummeringen åbnes senere, kan samme kvittering derfor ikke længere læses dér, selv om det udløsende sæt stadig er bekræftet.
- **Konkret rettelse:** Bevar den korte statusmeddelelse, men behold en sessionsafgrænset liste over bekræftede rekordkvitteringer til et foldet afsnit “Rekorder i dette pas” i opsummeringen. Listen skal valideres mod de aktuelle bekræftede sæt, så rettelse og fortryd fjerner forældede kvitteringer. Ingen varig lagring.
- **Afgrænsning og accept:** Kun den aktive sessions kvitteringer; nulstil ved atlet-/ugeskift og afmontering. Efter fem sekunder kan opsummeringens kvittering læses, men en ændret, slettet, afventende eller fremmed registrering vises aldrig som rekord. Undgå to samtidige kopier af samme tekst i opsummeringen.
- **Eksisterende prøver:** `src/entropi2/session/sessionRecordCelebration.test.mjs` og `src/entropi2/session/sessionRecordReceipt.test.mjs`. Brug syntetisk ur til udløb og korrektion.

## 8. Fold sammenligningens detaljer i pasopsummeringen

- **Prioritet og omfang:** P2 · 45 minutter.
- **Kilde:** `src/entropi2/session/sessionView.mjs:138`, `src/entropi2/session/sessionComparisonContent.mjs:11`.
- **Brugeren ser nu:** Opsummeringen viser først klarede og manglende øvelser. Derefter kommer alle sammenlignelige øvelser med overskrift og tre tekstafsnit hver, plus fælles forklaring. Alle sammenligninger er udfoldet, også ved mange øvelser.
- **Konkret rettelse:** Behold overskriften “Sammenlignet med sidst” og vis én foldet række pr. øvelse med navnet og det tungeste sæt før/nu. Flyt dato, sættal, volumen og forklaring ind under rækken. Fælles forklaring vises kun én gang.
- **Afgrænsning og accept:** Kun `sessionComparisonContent`, ingen nye styrkekonklusioner eller sammenligningsregler. To og otte øvelser giver samme kompakte struktur. Forskelligt antal sæt skjuler fortsat volumensammenligning, og ingen historik giver fortsat intet sammenligningsafsnit.
- **Eksisterende prøver:** `src/entropi2/session/sessionComparison.test.mjs` og `src/entropi2/session/sessionComparisonReact.test.mjs`.

## 9. Vis en kort bekræftet dagsformsværdi efter gemning

- **Prioritet og omfang:** P2 · 60 minutter.
- **Kilde:** `src/entropi2/home/QuickLogs.mjs:162`, `src/entropi2/home/QuickLogs.mjs:183`, `src/entropi2/home/QuickLogs.mjs:186`.
- **Brugeren ser nu:** Efter gemning bliver dagens feedback et flueben og “Logget i dag”. Et genåbnet panel viser også kun denne kvittering. Atleten kan ikke fra dette hurtige overblik kontrollere, hvilken energi der faktisk blev registreret.
- **Konkret rettelse:** Vis én kort linje “Energi 3/5 · logget i dag” fra dagens ejerskabsvaliderede, bekræftede registrering. Lad øvrige svar være foldede eller på den eksisterende detaljeskærm. Vis ikke gårsdagens forslag eller uafsluttet input som en registreret værdi.
- **Afgrænsning og accept:** Kun dagsformens kvittering; ingen ændring af gemmeknap, femsekunders fortryd eller write-handlere. Ved læsefejl og før bekræftet gemning vises ingen påstået registreret score. Samme værdi må ikke stå både i rækken og et åbent kvitteringspanel.
- **Eksisterende prøver:** `src/entropi2/home/quickLogs.synthetic.test.mjs` og `src/entropi2/home/quickLogs.render.test.mjs`. `src/entropi2/checkin/` er et separat ugentligt kladdeflow og skal ikke ændres.

## 10. Vis check-in-kladdens lokale status i den foldede overskrift

- **Prioritet og omfang:** P2 · 45 minutter.
- **Kilde:** `src/entropi2/home/HomeCheckIn.mjs:21`, `src/entropi2/home/HomeCheckIn.mjs:27`, `src/entropi2/checkin/WeeklyCheckIn.mjs:68`.
- **Brugeren ser nu:** Foldet check-in viser en påmindelse eller “Ugentligt check-in”. Det indlæste kladdesnapshot bruges til påmindelsen, men selve overskriften siger ikke, om en lokal kladde allerede er gemt. Den klare forklaring “Intet er sendt til din coach” findes først inde i formularen.
- **Konkret rettelse:** Udvid den foldede summary med én kort, valideret status, fx “Lokal kladde gemt”. Ved ingen gemt kladde bevares påmindelsen. Ved læsefejl bruges “Lokal status ukendt”. Brug aldrig “Sendt” eller “Check-in gennemført”. Vis den længere forklaring inde i formularen som nu.
- **Afgrænsning og accept:** Kun Hjem-wrapperens summary, ingen deling eller ny lagring. Gem, fold sammen og genåbn skal vise korrekt lokal status; en tom, fejlende eller anden uges kladde må ikke give et gennemført-flueben.
- **Eksisterende prøver:** `src/entropi2/home/homeCheckIn.synthetic.test.mjs`, `src/entropi2/home/homeCheckIn.render.test.mjs` og `src/entropi2/checkin/weeklyCheckIn.test.mjs`.

## 11. Saml graf og tilhørende tal i Fremgangs samme foldning

- **Prioritet og omfang:** P2 · 45 minutter.
- **Kilde:** `src/entropi2/analysis/DevelopmentView.mjs:57`, `src/entropi2/analysis/DevelopmentView.mjs:65`, `src/entropi2/analysis/DevelopmentView.mjs:69`.
- **Brugeren ser nu:** “Se udviklingen over 26 uger” åbner en søjlegraf. De enkelte søjler har kun en `title` med dato og tal. Den eksisterende læsbare talrække ligger i en separat søskendefoldning, “[løft]: tal og datagrundlag”. Atleten skal derfor finde en anden indgang for at læse værdier uden at være afhængig af hover.
- **Konkret rettelse:** Flyt den eksisterende datoliste ind i samme foldning som grafen under en tydelig tekst “Registrerede tal”. Behold den længere evidensforklaring separat under “Datagrundlag”. Genbrug listen og modellen; byg ingen ny grafinteraktion eller datakilde.
- **Afgrænsning og accept:** Kun hovedløftenes e1RM-visning. Åbning af én graf giver adgang til alle dens eksisterende datoer og værdier med touch og tastatur. Uger uden data forbliver uden måling, og e1RM markeres fortsat som et skøn. Hver værdi forekommer kun én gang i tekstlisten.
- **Eksisterende prøver:** `src/entropi2/analysis/compactOverview.test.mjs` og `src/entropi2/analysis/developmentReact.test.mjs`. Bevar modelprøvernes regler om sammenlignelige sæt.

## 12. Fjern Hjems gentagne destinationsknapper

- **Prioritet og omfang:** P3 · 45 minutter.
- **Kilde:** `src/entropi2/home/AthleteHome.mjs:215`, `src/entropi2/home/AthleteHome.mjs:226`, `src/entropi2/home/AthleteHome.mjs:230`.
- **Brugeren ser nu:** Med dagens koststatus vises en kostknap og senere genvejen “Kost”. Med en coachbesked vises både “Se besked og video” og senere “Din coach”; begge går til `beskeder`. Det generelle genvejsafsnit gentager dermed destinationer, der allerede har en mere konkret indgang ovenfor.
- **Konkret rettelse:** Lad det generelle genvejsafsnit udelade Kost og Din coach, når den respektive konkrete indgang faktisk er renderet. Behold genvejen, hvis der ikke er et kostkort eller en coachbesked. Bevar Analyse og Mobilitet og den nuværende særregel for coachens egen træning.
- **Afgrænsning og accept:** Kun Hjems eksisterende destinationsknapper. Prøv alle fire kombinationer af koststatus og coachbesked: hver destination skal have én indgang, også ved manglende data. Ingen læse- eller skrivehandling udløses af renderingen.
- **Eksisterende prøver:** `src/entropi2/home/coachSelfHome.synthetic.test.mjs` og `src/athlete/samletProeveNeste.test.mjs`. Navigation skal fortsat bruge den nyeste `setTab`.

## Kontrolgrundlag og afgrænsning

Alle otte områder er gennemgået: Hjem (6, 9, 10, 12), pas (7, 8), program (5), Fremgang (11), kost (1), beskeder (3), profil (4) og VideoCoach (2). De 12 prioriterede fund er forbedringsbilletter, ikke 12 fejl påstået reproduceret i en browser.

Der er søgt i hele det leverede `src/` og `scripts/` efter prøver og bindinger til målfilen. `src/` indeholder 962 prøvefiler; separat `test/`, `docs/` og `public/videocoach.html` er ikke med i bundlens scope. Ingen leveret prøve nævner `atlet-visuel3`. Dokumentationsmappen har derfor ingen tilgængelige mappeprøver at køre. 62 udvalgte eksisterende prøver kører faktiske kopierede moduler med syntetiske fixtures før og efter dokumentationspatchen; resultat og præcis udvælgelse står i TESTOUTPUT.md. Det er støtte til kildegennemgangen, ikke en fuld regressions- eller layoutgodkendelse.

Ingen appkode, flag, runtime-data eller namespaces ændres af denne leverance. Dhurva kontrollerer målfilens tilstand, anvender dokumentationspatchen og kører fuld suite og build ved integration. Den særskilte friske kontrolkørsel er K-E2-UI-GENNEMGANG3.
