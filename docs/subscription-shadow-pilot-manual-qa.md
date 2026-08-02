# Entropi subscription — aktuel launch-QA

Status: lokal launch-kandidat, 2. august 2026. Appen arbejder kun mod Supabase
shadow `maxhsefxbrvsgolscqwh`. Ingen branch, commit, push, deploy, produktion,
1:1-data eller ændring af sikkerhedsgrænsen indgår.

## Automatiske og manuelle beviser

- 159 subscription-tests er grønne.
- Programmatrixen dækker mål × nybegynder/øvet × 2/3/4 dage × Full
  Gym/Hjemmetræning, inklusive alle eksplicitte squat- og dødløftvarianter.
- Subscription-build, lint, separation guard, smoke og completion guard er grønne.
- Mobilrejsen er kørt visuelt gennem onboarding, tungt sæt, program, 32 sæt i
  uge 1–2, to ugevurderinger, to accepterede forslag og en refresh-sikker uge 3.
- En passende, komplet uge gav præcis +2,5 kg på gym-hovedløftene fra uge 1 til
  2 og igen fra uge 2 til 3. Assistance beholdt senest loggede vægt.
- Et pas blev lukket efter første sæt og genoptaget fra medlemshjemmet uden tab.
- En første assistancevægt blev automatisk kopieret til næste sæt.
- Historikken viste seneste pas, hovedløft, sammenlignelige vægtændringer og
  ugevurderinger. Den aktuelle programfane viste uge og brugerens programvalg.
- Alle øvelser i den genererbare programflade har korte danske teknikfokuspunkter;
  ukendte katalog-id'er fejler lukket uden opdigtet vejledning.
- Medlemsrejsen er bundet til den immutable shadow-programversion. Hele den
  understøttede aktive historik bruges til recovery; kun de seneste 64 pas
  vises/caches lokalt.

## QA-matrix

| Gren | Automatisk | Manuel | Resultat |
| --- | --- | --- | --- |
| Nybegynder / øvet | 96-scenarie matrix | Nybegynder gennem uge 3 | Grøn |
| 2 / 3 / 4 dage | Fuld matrix | 2 dage gennem uge 3 | Grøn |
| Full Gym / hjemmetræning | Fuld matrix | Full Gym gennem uge 3 | Grøn |
| High-bar / low-bar | Deterministisk varianttest | High-bar vist i aktiv plan | Grøn |
| Konventionel / sumo | Deterministisk varianttest | Konventionel vist i aktiv plan | Grøn |
| 1RM / tungt sæt | Baseline-tests | 5 reps ved RPE 8 | Grøn |
| God uge | Progressionstests | +2,5 kg to uger i træk | Grøn |
| For hård / missede reps / høj RPE | Hold-tests | — | Grøn |
| Assistancevægt | Storage/progressionstest | Kopiering og ugecarry | Grøn |
| Kropsvægt 0 kg | Storage/modeltest | — | Grøn |
| Luk og genoptag pas | Storage-test | Efter 1 af 8 sæt | Grøn |
| Uge 2 → uge 3+ | Ongoing storage/proposal-test | Uge 3 + refresh | Grøn |
| Eksisterende medlem / ny enhed | Recovery, pagination og skip-tests | — | Grøn, fail-closed |
| Offline/synkkø | Cache/RPC-tests | Netværkstest mangler | Delvis |
| Magic-link callback | Klientkontrakt | Rigtig mail mangler | Delvis |

## Marc tester nu

1. Åbn `http://localhost:5199/subscription.html` og send et login-link til den
   eksisterende pilotkonto.
2. Åbn linket på samme enhed og refresh én gang på medlemshjemmet.
3. Start næste pas, log mindst ét sæt, vælg **Gem og gå tilbage**, og fortsæt.
4. Afslut et pas online og bekræft status **Gemt**.
5. Afslut et nyt pas kortvarigt offline og bekræft **Gemt på denne enhed ·
   synkroniserer**; gå online og tryk igen ved fejl.
6. Åbn **Historik** og **Program** fra bundnavigationen.

## Kendte begrænsninger

- Et pas hvor alle sæt springes over kan kun ligge på den aktuelle enhed, fordi
  workout-RPC'en kun gemmer gennemførte sæt. Den lokale markør overlever refresh,
  vises i historikken og står ærligt som **Gemt på denne enhed**, men kan ikke
  genskabes på en ny enhed før serverkontrakten får plan/skip-metadata.
- Tidsrecepter har en fungerende countdown, men aktiveres ikke i et træningspas,
  før workout-kontrakten kan gemme sekunder som varighed. Sekunder bliver aldrig
  forklædt som reps.
- Den sidste virkelige magic-link-, offline- og synk-returtest kræver Marcs
  aktive shadow-session.
- Branded auth-mail kræver Supabase Email Template-konfiguration og, for en ny
  free-tier-instans, egen SMTP. Det ændres ikke af klientkoden alene.
