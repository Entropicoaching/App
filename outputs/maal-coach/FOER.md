# Måling før — coachens side (Ordre 130)

Målt 2026-09-12 14:09 UTC, 2 profiler × 10 skærme, med attrap-data (ingen atletdata).

**Den ægte, uændrede Dashboard-chunk** (det coachen reelt henter, uanset hvilken fane der vises): 334 KB (Dashboard-D0jNT0g3.js (334 KB)).

**Tid til interaktiv, atletliste (12 attrap-atleter):** 799 ms (Lighthouse "interactive"-audit, desktop-formfaktor).

_Ærlig grænse: de ti skærme er isolerede harnesses (ægte style-objekter og ægte, uændrede hjælpefunktioner kopieret fra src/Dashboard.jsx, attrap-data) — Dashboard.jsx kræver en levende Supabase-session for slet at boote. Deres "sidevægt"/Perf/TTI-tal er harness-isolerede, ikke den ægte Dashboard-bundtvægt/boot-tid (se chunk-tallet ovenfor). Harness-TTI måler kun den statiske HTML's egen (minimale) JS — IKKE Dashboard.jsx's reelle React-hydrering + Supabase-dataheentning, som er markant tungere; det reelle mål for "tid til interaktiv" er derfor chunk-vægten ovenfor plus de faktiske netværkskald, ikke dette tal alene._

| Profil | Skærm | Perf | A11y | TTI (ms) | Sidevægt (KB) | Axe-fejl | Trykflader <44px | Vandret scroll | Tekst ud af boks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPad landscape 1180×820 | Atletliste (12 attrap-atleter) | 99 | 80 | 799 | 16 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Atletliste (tom tilstand) | 100 | 80 | 659 | 3 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Én atlets uge (hub) | 100 | 85 | 785 | 7 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Check-in-gennemgang | 99 | 85 | 794 | 7 | 1 | 1 | nej | 0 |
| iPad landscape 1180×820 | Check-in-gennemgang (tom tilstand) | 100 | 85 | 650 | 4 | 1 | 1 | nej | 0 |
| iPad landscape 1180×820 | Program-redigering (øvelsesformular, reps-interval) | 100 | 74 | 643 | 7 | 2 | 6 | nej | 0 |
| iPad landscape 1180×820 | Coach Briefing (indbakke) | 100 | 80 | 670 | 6 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Coach Briefing (tom tilstand) | 100 | 80 | 660 | 2 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Videoer (VideoCoach-analyser) | 100 | 85 | 685 | 5 | 1 | 4 | nej | 0 |
| iPad landscape 1180×820 | Videoer (tom tilstand) | 100 | 80 | 661 | 3 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Atletliste (12 attrap-atleter) | 99 | 80 | 894 | 16 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Atletliste (tom tilstand) | 100 | 80 | 743 | 3 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Én atlets uge (hub) | 100 | 85 | 714 | 7 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Check-in-gennemgang | 100 | 85 | 750 | 7 | 1 | 1 | nej | 0 |
| Desktop 1440×900 | Check-in-gennemgang (tom tilstand) | 100 | 85 | 749 | 4 | 1 | 1 | nej | 0 |
| Desktop 1440×900 | Program-redigering (øvelsesformular, reps-interval) | 100 | 74 | 687 | 7 | 2 | 6 | nej | 0 |
| Desktop 1440×900 | Coach Briefing (indbakke) | 100 | 80 | 670 | 6 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Coach Briefing (tom tilstand) | 100 | 80 | 658 | 2 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Videoer (VideoCoach-analyser) | 100 | 85 | 773 | 5 | 1 | 4 | nej | 0 |
| Desktop 1440×900 | Videoer (tom tilstand) | 100 | 80 | 662 | 3 | 1 | 0 | nej | 0 |

## Detaljer (trykflader og axe-fund under 44px / kritisk / alvorlig)

### iPad landscape 1180×820 · Atletliste (12 attrap-atleter)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### iPad landscape 1180×820 · Atletliste (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### iPad landscape 1180×820 · Én atlets uge (hub)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (16 elementer)

### iPad landscape 1180×820 · Check-in-gennemgang
- Trykflade: "Rediger" — 56×18px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### iPad landscape 1180×820 · Check-in-gennemgang (tom tilstand)
- Trykflade: "Rediger" — 56×18px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (7 elementer)

### iPad landscape 1180×820 · Program-redigering (øvelsesformular, reps-interval)
- Trykflade: "Søg øvelse..." — 243×30px
- Trykflade: "Sæt" — 61×30px
- Trykflade: "Reps (fx 6-8)" — 85×30px
- Trykflade: "RPE" — 56×30px
- Trykflade: "f.eks. 8" — 183×30px
- Trykflade: "Note" — 182×30px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)
- Axe (critical): select-name — Select element must have an accessible name (1 element)

### iPad landscape 1180×820 · Coach Briefing (indbakke)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### iPad landscape 1180×820 · Coach Briefing (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### iPad landscape 1180×820 · Videoer (VideoCoach-analyser)
- Trykflade: "+ Ny optagelse" — 110×25px
- Trykflade: "Åbn" — 53×29px
- Trykflade: "Åbn" — 53×29px
- Trykflade: "Åbn" — 53×29px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### iPad landscape 1180×820 · Videoer (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### Desktop 1440×900 · Atletliste (12 attrap-atleter)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### Desktop 1440×900 · Atletliste (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### Desktop 1440×900 · Én atlets uge (hub)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (16 elementer)

### Desktop 1440×900 · Check-in-gennemgang
- Trykflade: "Rediger" — 56×18px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### Desktop 1440×900 · Check-in-gennemgang (tom tilstand)
- Trykflade: "Rediger" — 56×18px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (7 elementer)

### Desktop 1440×900 · Program-redigering (øvelsesformular, reps-interval)
- Trykflade: "Søg øvelse..." — 321×30px
- Trykflade: "Sæt" — 80×30px
- Trykflade: "Reps (fx 6-8)" — 112×30px
- Trykflade: "RPE" — 56×30px
- Trykflade: "f.eks. 8" — 261×30px
- Trykflade: "Note" — 240×30px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)
- Axe (critical): select-name — Select element must have an accessible name (1 element)

### Desktop 1440×900 · Coach Briefing (indbakke)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### Desktop 1440×900 · Coach Briefing (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### Desktop 1440×900 · Videoer (VideoCoach-analyser)
- Trykflade: "+ Ny optagelse" — 110×25px
- Trykflade: "Åbn" — 53×29px
- Trykflade: "Åbn" — 53×29px
- Trykflade: "Åbn" — 53×29px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### Desktop 1440×900 · Videoer (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

