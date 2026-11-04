# Tracking-visning: mobil først

Entropi Coaching, TRACK-PLAN2. Designspecifikation, ikke en bygget eller tilsluttet brugerflade. Coachens beslutning er hovedopgaven. Atletens opgave er at indtaste og få et enkelt overblik. Nuværende navigation bevares til en særskilt UI-opgave. Alle tal har periode, enhed og datadækning. Ingen samlet sundhedsscore, dekorativ gauge eller krav om cyklusinput.

## Fælles komposition

En kolonne ved 320–430 px, ingen vandret sidescroll. Øverst navn, periode og synlig status; dernæst højst ét prioriteret kort og foldede sektioner. 44×44 px trykflader, label ved alle inputs, tydelig fokusmarkering, almindelig tekst i stedet for farve alene. Kortets vigtigste konklusion er én sætning. Resten åbnes via "Vis grundlag". Bevar foldestatus pr. almindelig sektion, men aldrig private cyklusværdier i persistent lagring.

Graf: x-akse kalenderdato, y-akse navngivet enhed, tydelige punkter og huller for ukendte dage. Linjer brydes over huller. Den aktuelle kostsammenligning mærkes tydeligt som nuværende mål. Daterede historiske mål er ikke understøttet af det eksisterende modul. Samme værdi kan læses i en tilgængelig datoliste. 12-ugers styrkegraf viser ét valgt løft/variant ad gangen. Ingen dobbelte y-akser eller sammenblanding af søvntimer og stress. Perioder og dækning gentages i udvidet grundlag.

Hvis de hentede data ikke er komplette: "Kunne ikke hente hele perioden — prøv igen", ingen beregning på den delvise mængde. Tomt: "Ingen registreringer i perioden"; utilstrækkeligt: "For lidt data: 3 af mindst 4 dage"; ukendt antal: "Datagrundlag mangler". 0 er kun en målt/bekræftet værdi. Indlæser er en særskilt tilstand, ikke et tomt datasæt. Alle skitser viser syntetiske eksempler.

## Coachens atletside

```text
┌─────────────────────────────┐
│ ← Atleter      Atletnavn     │
│ Uge 44 · 26/10–1/11         │
│ [Forrige] [Vælg uge] [Næste]│
├─────────────────────────────┤
│ Afklar smerte før øgning     │
│ Knæ 8/10 · søndag            │
│ [Vis grundlag]               │
├─────────────────────────────┤
│ 3 af 4 pas bekræftet         │
│ [Åbn ugeevaluering]          │
│ [Planlæg næste blok]         │
├─────────────────────────────┤
│ ▸ Træning og styrke          │
│ ▸ Kost og vægt               │
│ ▸ Søvn, energi og smerte     │
│ ▸ Beskeder / video           │
└─────────────────────────────┘
```

Første kort viser højeste prioritet med konkret observation. Ingen flag og komplet evidens: "Ingen flag i de registrerede data". Mangler: "For lidt data til et samlet overblik", med brugbare delområder nedenunder. Beskeder og video er arbejdsopgaver med eksisterende adgangsregler; en video-draft er ikke en træningspræstation.

Cyklussektoren er helt fraværende uden aktivt, recipient-specifikt samtykke — heller ikke en tom pladsholder eller en opfordring til coachen om at kræve det. Med samtykke kan en separat, foldet "Delte cyklusregistreringer" åbnes efter ny autoriseret query. Vis kun selvindtastede datoer og felter. Ingen cyklusstatus i hovedkort, generelle grafer eller ugens signalantal. Denne særskilte visning genautoriseres ved fokus og rydder private værdier ved enhver fejl eller ændring af kontekst.

## Coachens ugeevaluering

```text
┌─────────────────────────────┐
│ ← Atlet    Ugeevaluering     │
│ 26/10–1/11 · afsluttet       │
│ 1 prioritet · 2 at gennemgå  │
├─────────────────────────────┤
│ Smerte 8/10, knæ             │
│ Registreret 1/11             │
│ [Vis dato og eget svar]      │
├─────────────────────────────┤
│ Søvn 5,8 t · 5/7 dage        │
│ Under 6 t i gennemsnit       │
│ [Hvorfor?]                   │
├─────────────────────────────┤
│ ▾ Belastning                 │
│ A 8.400 kg · C 5.000 kg/uge  │
│ A/C 1,68 · registreret volumen │
│ [7/28 dage: graf + tabel]    │
│ ▸ Styrke · vælg løft         │
│ ▸ Kost mod nuværende mål      │
│ ▸ Vægt · tre 7-dages vinduer  │
│ ▸ Energi/stress/ømhed        │
│ ▸ Pas · 3/4 = 75 %           │
├─────────────────────────────┤
│ Coachens vurdering           │
│ [Åbn eksisterende noteflow]  │
│ [Videre til planlægning]     │
└─────────────────────────────┘
```

"Hvorfor?" viser det eksisterende moduls formel, periode, tærskel, datoer og tal. Belastning viser akut sum og kronisk ugeækvivalent af registreret tonnage; manglende dage beviser ikke hvile. Styrke viser separate varianter, ugentlige e1RM-toppe og kun afsluttede uger i signalet. Kost viser de seneste syv loggede datoer mod nuværende mål; ingen påstand om komplette kostdage eller historiske mål. Vægt viser tre 7-dages perioder og de to ændringer. Modellen leverer de oprindelige modulresultater i sections.<område>.data, men selve graferne og skærmkoblingen er stadig en senere opgave.

Compliance er bekræftede planlagte pas; ekstra pas vises nedenunder. Noter og spørgsmål udledes ikke automatisk fra private beskeder. Coachnoter sendes aldrig automatisk til atleten. Manglende data har en rolig oplysning uden rødt advarselsikon, så fravær ikke fremstilles som et helbredsproblem.

## Coachens planlægning før næste blok

```text
┌─────────────────────────────┐
│ ← Evaluering   Næste blok    │
│ Grundlag til og med 1/11     │
├─────────────────────────────┤
│ Før du planlægger            │
│ • Afklar rapporteret smerte  │
│ • Gennemgå høj belastning    │
│ • Protein: for lidt data     │
│ [Tilbage til grundlaget]     │
├─────────────────────────────┤
│ ▸ 12 uger · valgt løft       │
│ ▸ 4 uger · belastning/kost   │
│ ▸ Seneste 3 uger · vægt      │
│ ▸ Sidste uge · restitution   │
│ ▸ Sidste blok · pas og mål   │
├─────────────────────────────┤
│ [Åbn eksisterende program]   │
│ Ingen automatisk ændring     │
└─────────────────────────────┘
```

Vis evalueringsdato, programgrundlag og at kost sammenlignes med nuværende mål; påstå ikke en historisk målversion. Hvis data siden er rettet eller slettet, genberegn før beslutning og marker at grundlaget er ændret. Ingen uidentificeret "AI anbefaler +5%". Coachen beslutter selv, og eksisterende godkendelsesflow gælder for at sende noget til en atlet. Planlægningsgrundlag indeholder ingen cyklusafledninger og må derfor heller ikke afsløre privat kildebrug.

## Atletens enkle overblik

```text
┌─────────────────────────────┐
│ Dit overblik                 │
│ I dag · 2/11                 │
│ [Registrér dagens svar]      │
├─────────────────────────────┤
│ Din uge · 3/4 pas            │
│ Søvn: 7,1 t · 5/7 dage       │
│ [Se dine registreringer]     │
│ ▸ Kost og vægt               │
│ ▸ Ømhed og smerte            │
│ ▸ Min private cyklus         │
└─────────────────────────────┘
```

Formularplanen grupperer søvn (timer + kvalitet), energi/stress og ømhed/smerte. Den eksisterende readiness-skrivevej bevares for timer, energi, stress og ømhed 1–5 med dens egne steder. Kun søvnkvalitet og smerte 0–10 med sted gemmes som nye tracking-ekstra felter; de to gemninger får hver sin bekræftelse. Valgfri betyder at et felt kan springes over; vis skalaankre. "Ingen smerte" er et aktivt 0-svar, ikke en default. Vis gemmer/gemt/fejl; fejl beholder tastede data i formularen og giver mulighed for genforsøg. Ret/slet vises ved hver egen dato, og DB-bekræftelse kræves før tallet vises som gemt. Ingen ny permanent cykluskladde i browserlager.

"Min private cyklus" findes kun i atletens egen visning, med egne ret/slet-handlinger og separate delingsindstillinger. Privat som standard. Gem observation og giv samtykke er to handlinger. Delingsdialogen navngiver coachen og at også noter/tidligere registreringer bliver synlige. Ingen forudvalgt checkbox. Atleten ser egne aktive og inaktive modtagere og en tydelig "Stop deling". Vis først stoppet deling efter DB-bekræftelse; ved fejl vises "Delingen blev ikke stoppet — prøv igen". Lokal privat visning kan ryddes straks, men UI må ikke foregive at serveradgang er ændret før commit.

## Integrationens acceptkriterier

- 320 px mobil, tastatur og skærmlæser: labels, foldestatus, grafens datoliste, tydelige enheder og fokus tilbage til udløseren efter dialog.
- Loading, fetchfejl, helt tom, 3/4 dage, 4/4 dage, blandede mangler, 0 planlagte pas og én smerteobservation har hver sin korrekt tekst.
- Direkte DB-forespørgsler som coach uden samtykke returnerer ingen private rækker. UI viser intet privat antal, badge, tomt panel eller afledt signal.
- Aktivér, tilbagekald, slet og skift coach med to samtidige sessioner; test genåbning, fokus, logout og atletskift. Alle private caches ryddes; ingen privat værdi i logs/eksport.
- Appflag default OFF giver eksisterende oplevelse og ingen tracking-queries. Ingen sundheds-, kost- eller programændring sendes automatisk.

Disse UI-kriterier er en plan til næste opgave, ikke udført browser-QA i denne hermetiske worker.
