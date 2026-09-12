# Måling efter — coachens side (Ordre 130)

Målt 2026-09-12 14:47 UTC, 2 profiler × 10 skærme, med attrap-data (ingen atletdata).

**Den ægte, uændrede Dashboard-chunk** (det coachen reelt henter, uanset hvilken fane der vises): 241 KB (Dashboard-B4nvGwgg.js (241 KB)).

**Tid til interaktiv, atletliste (12 attrap-atleter):** 909 ms (Lighthouse "interactive"-audit, desktop-formfaktor).

_Ærlig grænse: de ti skærme er isolerede harnesses (ægte style-objekter og ægte, uændrede hjælpefunktioner kopieret fra src/Dashboard.jsx, attrap-data) — Dashboard.jsx kræver en levende Supabase-session for slet at boote. Deres "sidevægt"/Perf/TTI-tal er harness-isolerede, ikke den ægte Dashboard-bundtvægt/boot-tid (se chunk-tallet ovenfor). Harness-TTI måler kun den statiske HTML's egen (minimale) JS — IKKE Dashboard.jsx's reelle React-hydrering + Supabase-dataheentning, som er markant tungere; det reelle mål for "tid til interaktiv" er derfor chunk-vægten ovenfor plus de faktiske netværkskald, ikke dette tal alene._

| Profil | Skærm | Perf | A11y | TTI (ms) | Sidevægt (KB) | Axe-fejl | Trykflader <44px | Vandret scroll | Tekst ud af boks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPad landscape 1180×820 | Atletliste (12 attrap-atleter) | 99 | 80 | 909 | 16 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Atletliste (tom tilstand) | 100 | 80 | 751 | 3 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Én atlets uge (hub) | 99 | 85 | 838 | 7 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Check-in-gennemgang | 100 | 85 | 644 | 7 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Check-in-gennemgang (tom tilstand) | 100 | 85 | 664 | 4 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Program-redigering (øvelsesformular, reps-interval) | 100 | 92 | 675 | 8 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Coach Briefing (indbakke) | 100 | 80 | 669 | 6 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Coach Briefing (tom tilstand) | 99 | 80 | 819 | 2 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Videoer (VideoCoach-analyser) | 100 | 85 | 666 | 5 | 1 | 3 | nej | 0 |
| iPad landscape 1180×820 | Videoer (tom tilstand) | 99 | 80 | 817 | 3 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Atletliste (12 attrap-atleter) | 99 | 80 | 806 | 16 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Atletliste (tom tilstand) | 99 | 80 | 788 | 3 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Én atlets uge (hub) | 100 | 85 | 690 | 7 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Check-in-gennemgang | 100 | 85 | 673 | 7 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Check-in-gennemgang (tom tilstand) | 100 | 85 | 665 | 4 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Program-redigering (øvelsesformular, reps-interval) | 100 | 92 | 673 | 8 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Coach Briefing (indbakke) | 100 | 80 | 639 | 6 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Coach Briefing (tom tilstand) | 100 | 80 | 765 | 2 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Videoer (VideoCoach-analyser) | 100 | 85 | 685 | 5 | 1 | 3 | nej | 0 |
| Desktop 1440×900 | Videoer (tom tilstand) | 100 | 80 | 743 | 3 | 1 | 0 | nej | 0 |

## Detaljer (trykflader og axe-fund under 44px / kritisk / alvorlig)

### iPad landscape 1180×820 · Atletliste (12 attrap-atleter)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### iPad landscape 1180×820 · Atletliste (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### iPad landscape 1180×820 · Én atlets uge (hub)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (16 elementer)

### iPad landscape 1180×820 · Check-in-gennemgang
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### iPad landscape 1180×820 · Check-in-gennemgang (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (7 elementer)

### iPad landscape 1180×820 · Program-redigering (øvelsesformular, reps-interval)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### iPad landscape 1180×820 · Coach Briefing (indbakke)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### iPad landscape 1180×820 · Coach Briefing (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### iPad landscape 1180×820 · Videoer (VideoCoach-analyser)
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
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (15 elementer)

### Desktop 1440×900 · Check-in-gennemgang (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (7 elementer)

### Desktop 1440×900 · Program-redigering (øvelsesformular, reps-interval)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### Desktop 1440×900 · Coach Briefing (indbakke)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### Desktop 1440×900 · Coach Briefing (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)

### Desktop 1440×900 · Videoer (VideoCoach-analyser)
- Trykflade: "Åbn" — 53×29px
- Trykflade: "Åbn" — 53×29px
- Trykflade: "Åbn" — 53×29px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### Desktop 1440×900 · Videoer (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)


## Før → efter

- **iPad landscape 1180×820::Atletliste (12 attrap-atleter)**: perf 99, a11y 80, TTI 799 → 909 ms, sidevægt 16 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Atletliste (tom tilstand)**: perf 100, a11y 80, TTI 659 → 751 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Én atlets uge (hub)**: perf 100 → 99, a11y 85, TTI 785 → 838 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Check-in-gennemgang**: perf 99 → 100, a11y 85, TTI 794 → 644 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 1 → 0
- **iPad landscape 1180×820::Check-in-gennemgang (tom tilstand)**: perf 100, a11y 85, TTI 650 → 664 ms, sidevægt 4 KB, axe-fejl 1, trykflader<44px 1 → 0
- **iPad landscape 1180×820::Program-redigering (øvelsesformular, reps-interval)**: perf 100, a11y 74 → 92, TTI 643 → 675 ms, sidevægt 7 → 8 KB, axe-fejl 2 → 1, trykflader<44px 6 → 0
- **iPad landscape 1180×820::Coach Briefing (indbakke)**: perf 100, a11y 80, TTI 670 → 669 ms, sidevægt 6 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Coach Briefing (tom tilstand)**: perf 100 → 99, a11y 80, TTI 660 → 819 ms, sidevægt 2 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Videoer (VideoCoach-analyser)**: perf 100, a11y 85, TTI 685 → 666 ms, sidevægt 5 KB, axe-fejl 1, trykflader<44px 4 → 3
- **iPad landscape 1180×820::Videoer (tom tilstand)**: perf 100 → 99, a11y 80, TTI 661 → 817 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Atletliste (12 attrap-atleter)**: perf 99, a11y 80, TTI 894 → 806 ms, sidevægt 16 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Atletliste (tom tilstand)**: perf 100 → 99, a11y 80, TTI 743 → 788 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Én atlets uge (hub)**: perf 100, a11y 85, TTI 714 → 690 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Check-in-gennemgang**: perf 100, a11y 85, TTI 750 → 673 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 1 → 0
- **Desktop 1440×900::Check-in-gennemgang (tom tilstand)**: perf 100, a11y 85, TTI 749 → 665 ms, sidevægt 4 KB, axe-fejl 1, trykflader<44px 1 → 0
- **Desktop 1440×900::Program-redigering (øvelsesformular, reps-interval)**: perf 100, a11y 74 → 92, TTI 687 → 673 ms, sidevægt 7 → 8 KB, axe-fejl 2 → 1, trykflader<44px 6 → 0
- **Desktop 1440×900::Coach Briefing (indbakke)**: perf 100, a11y 80, TTI 670 → 639 ms, sidevægt 6 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Coach Briefing (tom tilstand)**: perf 100, a11y 80, TTI 658 → 765 ms, sidevægt 2 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Videoer (VideoCoach-analyser)**: perf 100, a11y 85, TTI 773 → 685 ms, sidevægt 5 KB, axe-fejl 1, trykflader<44px 4 → 3
- **Desktop 1440×900::Videoer (tom tilstand)**: perf 100, a11y 80, TTI 662 → 743 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
