# Subscription launch-repair · manual QA-matrix

Dato: 2. august 2026
Miljø: kun `entropi-subscription-shadow` (`maxhsefxbrvsgolscqwh`)
Primær mobilbredde: 390 px

## Samme manuelle rejse for hver programgren

1. Vælg mål, erfaring, 2/3/4 dage, Full Gym/Hjemmetræning og begge løftevarianter.
2. Angiv enten 1RM (`1 rep · RPE 10`) eller et tungt sæt (`1–12 reps · RPE 5–10`) for squat, bænkpres og dødløft.
3. Kontrollér at preview og uge 1 viser samme konservative startbelastning og RPE-loft.
4. Kontrollér programmets antal pas, øvelses-id/variant, begynderdosis og udstyrsbane.
5. Åbn et pas. Alle øvelser og planlagte sæt skal være synlige; et assistance-load uden evidens skal stå blankt.
6. Log hvert sæt. `Spring over` er sekundært, kræver bekræftelse og må ikke gemme 0 kg som et udført sæt.
7. Afslut alle uge-1-pas, vælg ugentlig vurdering og kontrollér den konkrete forklaring i uge-2-forslaget.
8. Vælg både `Accepter` og `Behold uge-1-planen` i hver sin kørsel. Refresh skal genoptage det valgte spor.

## Programgrene

`Logic` dækkes af den deterministiske scenario-test; `Mobil` afkrydses ved den konkrete browser-/telefonrunde. Stilparrene roteres, så både high-/low-bar og konventionel/sumo kontrolleres i begge miljøer og på begge mål.

| ID | Mål | Erfaring | Dage | Miljø | Squat | Dødløft | Forventet ramme | Logic | Mobil |
|---|---|---:|---:|---|---|---|---|---|---|
| M01 | Generel styrke | Begynder | 2 | Full Gym | High-bar | Konventionel | `general-strength-2` | PASS | ☐ |
| M02 | Generel styrke | Begynder | 2 | Hjemme | Low-bar | Sumo | `general-strength-2-home` | PASS | ☐ |
| M03 | Generel styrke | Begynder | 3 | Full Gym | High-bar | Sumo | `general-strength-3` | PASS | ☐ |
| M04 | Generel styrke | Begynder | 3 | Hjemme | Low-bar | Konventionel | `general-strength-3-home` | PASS | ☐ |
| M05 | Generel styrke | Begynder | 4 | Full Gym | Low-bar | Sumo | `general-strength-4` · maks. 2 sæt/RPE 6 | PASS | ☐ |
| M06 | Generel styrke | Begynder | 4 | Hjemme | High-bar | Konventionel | `general-strength-4-home` · maks. 2 sæt/RPE 6 | PASS | ☐ |
| M07 | Generel styrke | Øvet | 2 | Full Gym | Low-bar | Konventionel | `general-strength-2` | PASS | ☐ |
| M08 | Generel styrke | Øvet | 2 | Hjemme | High-bar | Sumo | `general-strength-2-home` | PASS | ☐ |
| M09 | Generel styrke | Øvet | 3 | Full Gym | High-bar | Konventionel | `general-strength-3` | PASS | ☐ |
| M10 | Generel styrke | Øvet | 3 | Hjemme | Low-bar | Sumo | `general-strength-3-home` | PASS | ☐ |
| M11 | Generel styrke | Øvet | 4 | Full Gym | High-bar | Sumo | `general-strength-4` | PASS | ☐ |
| M12 | Generel styrke | Øvet | 4 | Hjemme | Low-bar | Konventionel | `general-strength-4-home` | PASS | ☐ |
| M13 | Styrkeløftfundament | Begynder | 2 | Full Gym | High-bar | Sumo | `powerlifting-foundation-2` | PASS | ☐ |
| M14 | Styrkeløftfundament | Begynder | 2 | Hjemme | Low-bar | Konventionel | `powerlifting-foundation-2-home` | PASS | ☐ |
| M15 | Styrkeløftfundament | Begynder | 3 | Full Gym | Low-bar | Sumo | `powerlifting-foundation-3` | PASS | ☐ |
| M16 | Styrkeløftfundament | Begynder | 3 | Hjemme | High-bar | Konventionel | `powerlifting-foundation-3-home` | PASS | ☐ |
| M17 | Styrkeløftfundament | Begynder | 4 | Full Gym | High-bar | Konventionel | `powerlifting-foundation-4` · maks. 2 sæt/RPE 6 | PASS | ☐ |
| M18 | Styrkeløftfundament | Begynder | 4 | Hjemme | Low-bar | Sumo | `powerlifting-foundation-4-home` · maks. 2 sæt/RPE 6 | PASS | PASS |
| M19 | Styrkeløftfundament | Øvet | 2 | Full Gym | Low-bar | Sumo | `powerlifting-foundation-2` | PASS | ☐ |
| M20 | Styrkeløftfundament | Øvet | 2 | Hjemme | High-bar | Konventionel | `powerlifting-foundation-2-home` | PASS | ☐ |
| M21 | Styrkeløftfundament | Øvet | 3 | Full Gym | High-bar | Sumo | `powerlifting-foundation-3` | PASS | ☐ |
| M22 | Styrkeløftfundament | Øvet | 3 | Hjemme | Low-bar | Konventionel | `powerlifting-foundation-3-home` | PASS | ☐ |
| M23 | Styrkeløftfundament | Øvet | 4 | Full Gym | Low-bar | Konventionel | `powerlifting-foundation-4` | PASS | ☐ |
| M24 | Styrkeløftfundament | Øvet | 4 | Hjemme | High-bar | Sumo | `powerlifting-foundation-4-home` | PASS | ☐ |

Den automatiske fuldmatrix supplerer tabellen med alle 96 kombinationer af mål × erfaring × dage × miljø × squatvariant × dødløftvariant. Ingen kombination må falde tilbage til en anden variant eller et andet miljø.

### Gennemført mobilrunde · M18

- 390 × 844 px: onboarding → tungt-sæt-baselines → 4-pas preview → aktiv uge 1 → 32/32 sæt → uge-review → forklarligt uge-2-forslag → eksplicit accept → uge 2 klar.
- Low-bar-input blev til den eksplicitte hjemme-squatbane; sumo-input blev bevaret som `Sumo-dødløft med håndvægt`.
- Begynder/4 dage viste højst 2 sæt pr. øvelse og RPE 6. Assistance stod uden opdigtet startvægt og krævede eksplicit indtastning.
- Øvelser og sæt var visuelt adskilt, alle kommende sæt kunne åbnes, og `Spring over dette sæt` var sekundært.
- Hvert skærmskift nulstillede scroll til toppen efter den fundne og rettede mobilregression.

### Gennemført offentlig shadow-rejse · 3. august 2026

- En ny, syntetisk og tidsbegrænset shadow-bruger blev inviteret, bekræftet og
  aktiveret gennem den kontrollerede servervej. Ingen direkte entitlement-write.
- Offentlig login → onboarding → tungt-sæt-baselines → programoprettelse blev
  gennemført med styrkeløftfundament, øvet, 3 dage, Full Gym, low-bar og sumo.
- Preview og aktiv uge 1 var enige om 105 kg squat, 65 kg bænkpres og 125 kg
  sumo-dødløft. Præcis én aktiv assignment blev oprettet med den valgte 3-dages
  programvariant.
- Alle 3 pas og 28/28 sæt blev gennemført. En valgt assistancevægt blev kopieret
  automatisk fra første til andet og tredje sæt; refresh bevarede den aktive
  member-rejse.
- Vurderingen `Passende` foreslog præcis +2,5 kg på low-bar squat, bænkpres og
  sumo-dødløft. Assistance beholdt senest brugte vægt uden et opdigtet løft.
- Forslaget blev accepteret. Uge 2 viste 107,5 / 67,5 / 127,5 kg og overlevede
  en fuld browser-refresh uden onboarding-loop eller ny assignment.

## Adgang, refresh og fejltilstande

| ID | Starttilstand | Handling | Forventning | Resultat |
|---|---|---|---|---|
| A01 | Ingen session | Send magic-link, åbn callback, refresh | Samme lokale auth-key; callback udveksles; ingen hvid skærm | Statisk kontrakt PASS · rigtig mail-click afventer Marc |
| A02 | Pilot-UUID med member-entitlement, ingen member/assignment | Login/refresh | Præcis én `Sæt dit program op`-vej; ingen terminal tom state | Shadow-data + 390 px onboarding PASS |
| A03 | Eksisterende member med aktiv assignment + canonical baselines | Refresh midt i uge 1 | Samme assignment/program og user-scoped kladde genoptages | Regressionstest PASS · offentlig shadow-rejse PASS |
| A04 | Free-tier | Login/refresh | Kun fast `start-2`; ingen memberprofil, assignment, log eller progression åbnes | Repository-test PASS · mobilrunde ☐ |
| A05 | Korrupt/stale localStorage | Refresh | Korrupt snapshot slettes; menneskelig sikker start, ingen white screen | Regressionstest PASS |
| A06 | Netværk afbrydes efter pas | Afslut pas, gå online igen | Sæt bliver lokalt; outbox synkroniserer idempotent mod aktiv assignment | RPC/outbox-test PASS · browserrunde ☐ |
| A07 | Member udløbet | Refresh | Free-visning; ingen læsning af memberprogram gennem tier-genvej | Repository-test PASS |
| A08 | Genbrug af setup request-id | Gentag identisk / ændret payload | Identisk replay returnerer samme assignment; ændret payload fejler uden erstatning | Statisk kontrakt + autentificeret shadow-dry-run PASS |
| A09 | Gammel assignment eller ændret programfingerprint | Refresh | Gammel uge åbnes ikke under ny assignment; tydelig retry-handling | Regressionstest PASS |
| A10 | Loading/error/localStorage-fejl | Fremprovokér hver state | Ingen rå Supabase-fejl; altid retry eller logout; ingen blank skærm | Mobilrunde ☐ |
| A11 | Member-access | Kald tier-opslag som autentificeret pilot | Kun subscription-tier; ingen læsning af `athletes`, `profiles.role` eller 1:1-politikker | Isoleret `sub_my_access_v2` shadow-kontrol PASS |

## Visuel accept

- 390 px: ingen vandret scroll, 44–48 px trykflader og synlig primær handling.
- Øvelseskort og sætrækker er visuelt adskilt; `Spring over` er tekstsekundært.
- Ingen label bruger “Kommer senere”; alle planlagte sæt kan åbnes direkte.
- Dansk tekst er hel og læsbar; ingen `Ã`, `Â`, afbrudte labels eller rå databasefejl i browseren.
- Free og Member kan skelnes uden at kende backendbegreber.
