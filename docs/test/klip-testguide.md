# VideoCoach – kort testguide til Marc

Entropi Coach · grundlag: `22ac240844db731e9a4a20a9f303defb5065649b`.
Brug et testpas og testkonti uden personoplysninger på telefonen. Gentag med squat,
bænkpres og dødløft. Skriv PASS/FAIL ved hvert trin; ved fejl: trin, knaptekst og
forventet/faktisk resultat uden navne eller private skærmbilleder.

**Før testen:** Dhurva skal først have flettet og kontrolleret hele forbindelsen.
I denne base åbner Hjem-knappen stadig den eksisterende iframe
(`src/AthleteView.jsx:861`, `src/athlete/Ramme.jsx:34`), mens de nye komponenter
er defineret i `src/entropi2/videocoach/VideoCoach.mjs:25` og
`src/entropi2/videocoach/VideoCoach.mjs:33` uden en produktionskobling i det
leverede `src/`. Trin 2–6 nedenfor er derfor accepttesten for næste flettede
version, ikke en påstand om, at basen allerede kan hele flowet. Mangler panelet,
Analyse-koblingen eller en nødvendig funktion, så stop og meld det til Dhurva.
De præcise knaptekster nedenfor gælder de nye komponenter; iframe-indholdet er
ikke med i det offentlige kildegrundlag.

1. **Åbn som atlet.** På Hjem: tryk **Film et sæt til videocoach**
   (`src/entropi2/home/AthleteHome.mjs:216`). I den nye indgang hedder knappen
   **Film et sæt** (`src/entropi2/videocoach/accessView.mjs:18`). Forvent panelet
   **Dit sæt på video**. Vælg det rigtige sæt under **Sæt i dagens pas (valgfrit)**
   (`src/entropi2/videocoach/accessView.mjs:27`). Uden sæt er den ærlige tomtilstand
   **Ingen sæt i dagens pas. Du kan stadig se egen analyse og gemme lokalt.**
   (`src/entropi2/videocoach/accessView.mjs:33`); afsendelse kræver et valgt sæt.

2. **Vælg eller optag.** Tryk **Vælg video** eller **Optag video**
   (`src/entropi2/videocoach/accessView.mjs:35`,
   `src/entropi2/videocoach/accessView.mjs:36`). Forvent egen video i forhåndsvisningen
   og **Valgt klip:** med start/slut. Valget må ikke sende noget til coachen.
   Afbryd videovalget én gang: et allerede valgt klip skal bevares
   (`src/entropi2/videocoach/accessController.mjs:129`). Mangler forbindelsen, viser
   koden **Videooptagelse og valg af video er ikke tilgængeligt her endnu.**
   (`src/entropi2/videocoach/accessView.mjs:37`): FAIL for den flettede version.

3. **Kontrollér hele sættet og banen.** Med tilførte bevægelsesdata kan status være
   **Hele sættet er markeret med buffer og afsluttende hvile.** Uden disse data
   vælges op til de sidste 15 sekunder. Åbn **Ret klippets interval**, og flyt
   **Start** og **Slut**, hvis sættet mangler begyndelse eller slutning
   (`src/entropi2/videocoach/accessView.mjs:41`,
   `src/entropi2/videocoach/accessView.mjs:46`). Maksimum er 15 sekunder
   (`src/entropi2/videocoach/model.mjs:2`); et længere helt sæt må ikke kaldes
   fuldt medtaget. Automatisk afgrænsning kræver særskilte hvilemarkeringer;
   koden behandler syntetiske positioner og aflæser ikke selv videoen
   (`src/entropi2/videocoach/setBoundary.mjs:9`).

   Analysen kan starte automatisk efter videovalget. Ellers tryk
   **Analysér klippet**; ved et eksisterende resultat hedder knappen
   **Analysér igen** (`src/entropi2/videocoach/accessView.mjs:52`,
   `src/entropi2/videocoach/accessController.mjs:145`). Forvent registreret antal
   gentagelser og **Registreret bane i det valgte klip**. Sammenhold begge med
   videoen (`src/entropi2/videocoach/accessView.mjs:54`). Resultatet afhænger af
   værtens analysefunktion. Coachens fold-ud **Syntetisk stangbane** siger
   **Kun syntetiske målepunkter. Ingen video analyseres her.**
   (`src/entropi2/videocoach/barPathView.mjs:21`). Den er ikke dokumentation for
   stangsporing i den optagne video; manglende reel analyse er FAIL, hvis næste
   version lover den.

4. **Se analysen under Analyse/Fremgang.** Åbn **Analyse** fra Hjem
   (`src/entropi2/home/AthleteHome.mjs:236`; ruten er `fremgang`,
   `src/AthleteView.jsx:954`). Når koblingen er flettet, forvent
   **Dine videoanalyser** med dato, øvelse, sæt og antal; åbn **Se banen**
   (`src/entropi2/videocoach/analysisView.mjs:13`,
   `src/entropi2/videocoach/analysisView.mjs:26`). Et andet pas/løft må ikke vise
   denne analyse. Uden resultater: **Ingen videoanalyse for dette løft og pas endnu.**
   (`src/entropi2/videocoach/analysisView.mjs:9`,
   `src/entropi2/videocoach/analysisView.mjs:14`). Historikken ligger i
   sessionshukommelsen; genåbning efter genstart kræver værtens gemme-/læsekobling
   (`src/entropi2/videocoach/analysisController.mjs:7`).

5. **Send til coachen.** **Gem lokalt** deler ikke klippet. Tryk bevidst
   **Send til din coach** i panelet eller på analysen
   (`src/entropi2/videocoach/accessView.mjs:61`,
   `src/entropi2/videocoach/analysisView.mjs:24`). Hold appen åben. Forvent
   **Sendt til din coach.** i panelet og **Sendt i samtalen til din coach.** i
   analyselisten først efter bekræftelse
   (`src/entropi2/videocoach/accessView.mjs:67`,
   `src/entropi2/videocoach/analysisView.mjs:18`). Samtalen skal indeholde videoen
   og en analysebesked med korrekt pas, øvelse og sæt. Ved fejl skal klippet
   bevares; **Prøv afsendelse igen** må ikke skabe en ekstra video eller besked
   (`src/entropi2/videocoach/accessView.mjs:69`,
   `src/entropi2/videocoach/analysis.test.mjs:128`). Grå sendeknap eller manglende
   bekræftelse er ikke en gennemført afsendelse.

6. **Giv feedback som coach, og kontrollér som atlet.** Åbn testatletens samtale,
   fold videoposten ud, og tryk **Åbn videoreview**
   (`src/entropi2/conversation/ConversationView.mjs:270`). I det nye review:
   angiv **Tidspunkt i klippet**, tryk **Gå til tidspunkt**, skriv under
   **Feedback i samtalen**, og tryk **Send tidsfeedback**
   (`src/entropi2/videocoach/view.mjs:104`,
   `src/entropi2/videocoach/view.mjs:125`). Forvent
   **Feedback sendt i samtalen.** efter bekræftet afsendelse
   (`src/entropi2/videocoach/reviewController.mjs:99`). **Gem konklusion som kladde**
   deler ikke konklusionen (`src/entropi2/videocoach/view.mjs:100`). Ved fejl:
   **Prøv ventende feedback igen** (`src/entropi2/videocoach/view.mjs:128`).
   Tilbage som atlet: kontrollér coachens besked i samme samtale; videopostens
   knap hedder **Åbn videofeedback**
   (`src/entropi2/conversation/ConversationView.mjs:270`). Beskeden skal høre til
   den valgte video og det valgte tidspunkt.

**Slå fra (Dhurva).** VideoCoach-modulernes flag er `enabled`; standarden
`DEFAULT_VIDEOCOACH` er allerede `false`
(`src/entropi2/videocoach/model.mjs:1`). Ved en ny kobling: afmontér visningerne,
afslut de gamle controllere med `dispose()`, og genskab access-, analyse-,
upload- og review-controllere med `enabled: false`. En ændret standard tilsidesætter
ikke et eksplicit `enabled: true`; se `src/entropi2/videocoach/accessController.mjs:32`,
`src/entropi2/videocoach/analysisController.mjs:22`,
`src/entropi2/videocoach/uploadController.mjs:5` og
`src/entropi2/videocoach/reviewController.mjs:4`. Kontrollér ingen nye paneler,
analyse-/sendekald eller skrivninger. Det fælles Entropi 2-flag er et andet flag:
`entropi2={false}` vælger de gamle skærme
(`src/entropi2/flag.mjs:2`); det slukker ikke den eksisterende VideoCoach-iframe.
Der er ingen dokumenteret brugerknap, URL- eller storagekontakt til det nye flag.
