# Atlet: tomme og tekniske tekster efter nattens fletninger

Auditresultat: **FAIL – 7 fund**, heraf 1 P1, 5 P2 og 1 P3. Kun dokumentation; ingen produktkode er ændret.

Billet: E2-TOMME-ATLET-AUDIT2. Produkt: Entropi Coach. Fastlåst base: `3082dfb3545e60942834c0e094c730e320b68d5b` (`3082dfb3`), Entropi 2 tændt. Kildegrundlaget er den hashverificerede offentlige kildepakke. Alle fil:linje-henvisninger nedenfor gælder denne base.

Ophav: ORDER.md og de tre medleverede Marc-beslutninger fra 3. november: byg mere før afprøvning, coachens evaluering og planlægning samt atletens enkle overblik. Beslutningerne fra 4. november kl. 20:44 og 21:01 er kun gengivet i ORDER.md, ikke selvstændigt medleveret. De er derfor ikke påstået læst.

Afgrænsning: De aktive indgange fra `AthleteView.jsx` til Hjem/pas, Program, Analyse, Kost, Samtale, Mobilitet og Profil/dataeksport er gennemgået i kildekopien. Der er søgt i hele det medleverede `src/` efter relevante prøver; pakken indeholder ikke `test/`. De dokumenterede udfald er enten kørt på uændrede, importerede moduler med syntetiske fixtures eller angivet som kildekontrol. Ingen browser, produktion, persondata eller database er brugt. Dette er ikke en visuel mobilgodkendelse eller en måling af, hvor ofte fejlene forekommer hos atleter.

Hvert nummer nedenfor er én afgrænset billet på 30–90 minutter. P1 er forkert datatilstand, P2 er uklar eller teknisk information i et atletflow, P3 er præsentationsstøj. Rettelserne skal bevare OFF, ejerskab og eksisterende lagringsnavnerum. De må kun bruge eksisterende data; manglende data må aldrig blive til nul eller nye koblinger.

## 1. P1 – Analyse mister vægtlæsningens fejl og kan vise gamle tal som aktuelle

**Sted:** `src/AthleteView.jsx:926`, `src/athlete/beskederOgVaegt.jsx:54`, `src/entropi2/analysis/analysisMineData.mjs:56`, `src/entropi2/athlete/minedata/mineDataModel.mjs:91`.

**Atleten ser nu:** Efter en fejlet genhentning kan Analyse → Mine data stadig vise eksempelvis “Kropsvægt” med den tidligere måling på 80 kg. Ved første fejlede læsning med tomt vægtarray forsvinder vægtafsnittet uden en lokal forklaring. Den fælles fejltoast kan vises, men forsvinder efter tre sekunder (`src/AthleteView.jsx:498`); det er ikke en vedvarende fejltilstand i analysen.

**Årsag og bevis:** Vægtlæseren sætter allerede `weightStatus` til `error` og bevarer tidligere rækker. Analyseindgangen sender kun `weightLogs`, mens adapteren forventer `weightError`/`weightLoading`. Det normaliserede vægtgrundlag bliver derfor `ready`, også når læseren siger `error` eller `loading`. Importeret `analysisMineData` → `mineDataModel` bekræfter både gamle tal og et usynligt fejlet tomt grundlag. Kostskærmens egen vægtfejl er allerede håndteret og er ikke dette fund.

**Konkret rettelse (60–90 min.):** Før den eksisterende, atletafgrænsede `weightStatus` videre til Analyse og oversæt den til adapterens fejl-/hentetilstand. Vis “Vejningerne kunne ikke hentes. Åbn analyse igen for at prøve igen.” ved fejl. Vis ikke tidligere vægtberegninger under fejl eller indlæsning. Opret ingen ny læsning, identitet eller datakilde.

**Accept:** Test første fejl med `[]`, fejl efter en vellykket måling, indlæsning, forkert atlet i status og efterfølgende succes. Fejl skal have lokal forklaring; gamle tal skal være skjult; et bekræftet tomt svar skal fortsat kunne skjules roligt. Eksisterende `analysisConnection.test.mjs` tester normaliserede fejl, men ikke værtens faktiske `weightStatus`-kobling.

## 2. P2 – Coachens tidsfeedback viser et internt video-id

**Sted:** `src/entropi2/conversation/conversationModel.mjs:60`, `src/entropi2/conversation/conversationView.mjs:242`, `src/entropi2/conversation/conversationView.mjs:245`. Aktiv atletindgang: `src/AthleteView.jsx:978`.

**Atleten ser nu:** Når en coach sender tidsfeedback, indeholder beskeden en læsbar videoetiket og tekst efterfulgt af eksempelvis “Video-id: synthetic-video-a”. Hele beskeden vises, når atleten åbner den; forhåndsteksten kan også indeholde id-linjen, hvis beskeden er kort nok.

**Årsag og bevis:** `timestampContent` gemmer id-linjen i almindelig `messages.content`. `threadFor` bevarer den, og visningen gengiver `row.content` direkte. Importeret tekstgenerator og trådmodel bekræfter id-linjen; selve visningskoblingen er kildekontrolleret.

**Konkret rettelse (45–60 min.):** Lav en visningsprojektion for den eksisterende tidsfeedback, som skjuler den genkendte afsluttende metadata-linje i både forhåndstekst og åbnet tekst. Bevar id'et i den gemte besked og bevar forskellen på to videoer af samme løft samme dag. Fjern ikke vilkårlige linjer fra almindelig fritekst, og opfind ikke en videokobling, som data ikke dokumenterer.

**Accept:** To videoer samme dag skal stadig få forskellige gemte referencer; atletens begge tekstvisninger skal være uden metadata-id. Almindelige beskeder og ikke-genkendte formater skal bevares. `timestampContent.test.js:17` i samme mappe låser den gemte id-linje og skal fortsat beskytte lagringskontrakten.

## 3. P2 – En tom måltidstitel giver tom overskrift og navnløse handlinger

**Sted:** `src/entropi2/nutrition/controller.mjs:61`, `src/entropi2/nutrition/view.mjs:270`, `src/entropi2/nutrition/view.mjs:274`, `src/entropi2/nutrition/view.mjs:279`.

**Atleten ser nu:** Hvis et hentet måltid har `meal: "   "`, står titlen tom, og retteknappen hedder “Ret måltid: ” efterfulgt af mellemrum. Afkrydsningens tilgængelige navn mangler også et måltidsnavn. En næringsadvarsel erstatter ikke den manglende titel.

**Årsag og bevis:** Hentekontrollen validerer atlet og dato, men ikke titlen. Visningen accepterer enhver streng som titel, inklusive tomme strenge og mellemrum. Den faktiske controller og DOM-montering er kørt med en syntetisk række med gyldigt id, dato og næringsfelter; tom titel og tomt handlingsnavn er bekræftet. Forekomst i produktion er ikke undersøgt.

**Konkret rettelse (30–60 min.):** Brug ét trimmet, ikke-tomt visningsnavn i titel, rette-/fjerneknapper og tilgængelige navne. Ved manglende navn: “Måltid uden navn” samt “Giv måltidet et navn”. Bevar rækken og dens eksisterende rettevej; brug aldrig række-id som fallback, og skriv ikke automatisk en erstatning til databasen.

**Accept:** Afprøv `null`, `""`, mellemrum og et gyldigt navn. Ingen tom overskrift, “null” i et handlingsnavn eller id-fallback; gyldige titler og korrektion skal fungere. `emptyStates.test.mjs:52` dækker ugyldige næringsværdier, men bruger en ikke-tom titel.

## 4. P2 – Kostdagbogen viser rå decimaltal med regnestøj

**Sted:** `src/entropi2/nutrition/controller.mjs:120`, `src/entropi2/nutrition/view.mjs:277`, `src/entropi2/nutrition/view.mjs:355`. Eksisterende dansk formattering: `src/entropi2/nutrition/startModel.mjs:4`.

**Atleten ser nu:** Under “Registreret indtag” kan to gyldige proteinregistreringer på 12,1 g og 13,2 g blive til “Protein: 25.299999999999997 g”. Måltidslinjer og aftalte mål kan også gengive punktumdecimaltal direkte. Andre tal på samme skærm bruger allerede dansk formattering.

**Årsag og bevis:** Totalerne summeres som tal og indsættes direkte i teksten. Den faktiske controller og DOM-montering viser præcis “Protein: 25.299999999999997 g” med de to syntetiske måltider.

**Konkret rettelse (30–45 min.):** Brug den eksisterende danske talformatter på de validerede visningstal for måltidslinjer, totaler og mål, eksempelvis “25,3 g”. Bevar fuld præcision i beregninger og gemte data. Bevar den eksisterende korrektionstekst, når næringsværdier mangler; formatter ikke manglende værdier til nul.

**Accept:** Test 12,1 + 13,2, tal gemt som strenge, nul og manglende værdier. Visningen skal have dansk komma og højst én decimal uden regnestøj; beregning og lagring skal være uændrede. De eksisterende tomtilstandsprøver er grønne og dækker ikke denne synlige sum.

## 5. P2 – “Gennemsnit ukendt” forklarer ikke manglende kostdata

**Sted:** `src/entropi2/nutrition/weekText.mjs:19`, `src/entropi2/nutrition/view.mjs:390`.

**Atleten ser nu:** Under “Din uge” kan teksten være “Seneste 7 dage: 2 af 7 dage logget · gennemsnit ukendt.” Den siger ikke, om der mangler registreringer eller næringsværdier, eller hvad atleten kan rette.

**Årsag og bevis:** Den kompakte tekst bruger “gennemsnit ukendt”, hvis mindst to dage er logget, men et sikkert gennemsnit ikke kan beregnes. En manglende proteinværdi på én af to datoer gengiver den præcise tekst i den faktiske kostmontering. Tom dagbog og for få loggede dage har andre tekster og er ikke samme fejl.

**Konkret rettelse (30–45 min.):** Bevar “2 af 7 dage logget”, men erstat resten med “Næringsværdier mangler i nogle måltider, så gennemsnittet kan ikke vises. Kontrollér måltiderne i historikken.” Brug kun denne tekst ved mangelfulde/ugyldige næringsdata; beregningsoverløb skal have en neutral “Gennemsnittet kan ikke beregnes”. Vis aldrig et gennemsnit af kun de kendte dage eller et opdigtet nul.

**Accept:** Test tom uge, én dag, to komplette dage, to dage med et manglende felt samt overløb. `weekText.test.mjs:78` låser også den kompakte “ukendt”-tekst og skal opdateres for den nye forklaring uden at svække datakravene.

## 6. P3 – Åbnet ugentligt check-in gentager samme overskrift

**Sted:** `src/entropi2/home/HomeCheckIn.mjs:28`, `src/entropi2/home/HomeCheckIn.mjs:29`, `src/entropi2/checkin/WeeklyCheckIn.mjs:66`.

**Atleten ser nu:** Når check-in foldes ud fra Hjem, står “Ugentligt check-in” i foldens overskrift og straks igen som formularens overskrift. På mobil bruger det plads, før det første felt kommer frem.

**Årsag og bevis:** Hjem monterer den selvstændige formular med dens egen `h2` inde i en fold med samme titel. De to faktiske komponenter er importeret med syntetiske React-hooks; et åbent check-in har begge identiske titler. Ingen kladde skrives ved at åbne folden.

**Konkret rettelse (30–45 min.):** Giv den indlejrede formular en eksplicit præsentationsvariant med én samlet, tilgængelig overskrift. Bevar titel i selvstændig visning og formularens tilgængelige navn. Bevar oplysningerne om lokal kladde, at svar ikke sendes til coachen, samt alle knapper og lagringsnøgler.

**Accept:** Åbnet Hjem-visning skal have én synlig titel; selvstændig formular skal fortsat have sin titel. Tastning, luk/genåbn, uge-/atletskift og OFF må ikke ændre adfærd. `homeCheckIn.synthetic.test.mjs` og `weeklyCheckIn.test.mjs` beskytter disse eksisterende flows, men tæller ikke den gentagne titel.

## 7. P2 – “Reps” overlever i træningens felter, historik og validering

**Sted:** `src/athlete/ProgramTab.jsx:745`, `src/athlete/ProgramTab.jsx:1040`, `src/athlete/ProgramTab.jsx:1042`, `src/entropi2/session/sessionModel.mjs:142`, `src/entropi2/session/sessionView.mjs:259`.

**Atleten ser nu:** Programmet bruger pladsholderen “reps”, det tilgængelige feltnavn “Reps, sæt …” og bekræftelsen “sidst loggede vægt og reps”. I det nye pasflow kan en valideringsfejl sige “Skriv vægt og hele reps over 0”, mens sæthistorikken også skriver “reps”. Feltet i det nye flow hedder ellers allerede “Gentagelser”.

**Årsag og bevis:** Strengene står i de aktive træningskomponenter; Program nås fra `src/AthleteView.jsx:896`, og Hjem-passets bro importerer sessionvisningen i `src/entropi2/home/homeSessionBridge.mjs:1`. Dette fund er kildekontrolleret; Program-JSX er ikke renderet i en browser eller transformeret under denne audit.

**Konkret rettelse (45–60 min.):** Brug “gentagelser” i synlig tekst, tilgængelige navne og bekræftelser. Skriv valideringen som “Angiv vægt og mindst én hel gentagelse. RPE er valgfri fra 0 til 10.” Bevar feltnavnet `reps`, payloads, numeriske grænser og eksisterende RPE-forklaring internt.

**Accept:** Kontrollér både Program og Hjem-pas, fejl ved manglende/ugyldigt antal og historik efter logning. Ingen engelsk “reps” i disse brugerstrenge; ingen ændring af registrering eller OFF. Der blev ikke fundet en prøve, der låser den præcise `placeholder="reps"`-tekst i den medleverede kildepakke.

## Verifikation og grænser

41 eksisterende, afgrænsede prøver består før og efter dokumentationen. Syv fundkontroller og to OFF-kontroller består. PASS for en fundkontrol betyder, at den nuværende fejl er reproduceret, ikke at produktet er rettet. Reproduktioner, kommandoer og adaptergrænser står i leverancens TESTOUTPUT.md og ADAPTER.md.

De gennemførte kostprøver skelner allerede mellem fejlet læsning og tom dagbog samt mellem manglende værdier og nul. Ingen rå `null`/`NaN` er observeret i de kørte skærmfixtures; det er ikke et bevis for alle skærme eller alle produktionsdata. Direkte visning af internt id er dokumenteret i fund 2. Ingen nye koblinger eller måltidsplaner foreslås ud fra data, der ikke er med i de eksisterende kontrakter.

Fuld suite, build og visuel mobilafprøvning er ikke kørt. Fuld suite og build tilhører Dhurva ved fletningen. Den særskilte friske kontrolbillet K-E2-TOMME-ATLET-AUDIT2 skal vurdere den endelige dokumentationsdiff; denne workers lokale efterkontrol erstatter ikke den kontrol.
