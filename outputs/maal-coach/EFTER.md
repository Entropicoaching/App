# Måling efter — coachens side (Ordre 130)

Målt 2026-09-12 15:41 UTC, 2 profiler × 10 skærme, med attrap-data (ingen atletdata).

**Den ægte, uændrede Dashboard-chunk** (det coachen reelt henter, uanset hvilken fane der vises): 241 KB (Dashboard-09qkvMQq.js (241 KB)).

**Tid til interaktiv, atletliste (12 attrap-atleter):** 791 ms (Lighthouse "interactive"-audit, desktop-formfaktor).

_Ærlig grænse: de ti skærme er isolerede harnesses (ægte style-objekter og ægte, uændrede hjælpefunktioner kopieret fra src/Dashboard.jsx, attrap-data) — Dashboard.jsx kræver en levende Supabase-session for slet at boote. Deres "sidevægt"/Perf/TTI-tal er harness-isolerede, ikke den ægte Dashboard-bundtvægt/boot-tid (se chunk-tallet ovenfor). Harness-TTI måler kun den statiske HTML's egen (minimale) JS — IKKE Dashboard.jsx's reelle React-hydrering + Supabase-dataheentning, som er markant tungere; det reelle mål for "tid til interaktiv" er derfor chunk-vægten ovenfor plus de faktiske netværkskald, ikke dette tal alene._

| Profil | Skærm | Perf | A11y | TTI (ms) | Sidevægt (KB) | Axe-fejl | Trykflader <44px | Vandret scroll | Tekst ud af boks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPad landscape 1180×820 | Atletliste (12 attrap-atleter) | 99 | 80 | 791 | 17 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Atletliste (tom tilstand) | 100 | 80 | 646 | 3 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Én atlets uge (hub) | 100 | 85 | 818 | 7 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Check-in-gennemgang | 100 | 85 | 673 | 7 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Check-in-gennemgang (tom tilstand) | 100 | 85 | 669 | 4 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Program-redigering (øvelsesformular, reps-interval) | 100 | 92 | 679 | 8 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Coach Briefing (indbakke) | 100 | 80 | 674 | 6 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Coach Briefing (tom tilstand) | 100 | 80 | 660 | 2 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Videoer (VideoCoach-analyser) | 98 | 85 | 838 | 6 | 1 | 0 | nej | 0 |
| iPad landscape 1180×820 | Videoer (tom tilstand) | 99 | 80 | 814 | 3 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Atletliste (12 attrap-atleter) | 99 | 80 | 888 | 17 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Atletliste (tom tilstand) | 100 | 80 | 712 | 3 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Én atlets uge (hub) | 99 | 85 | 738 | 7 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Check-in-gennemgang | 100 | 85 | 747 | 7 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Check-in-gennemgang (tom tilstand) | 100 | 85 | 737 | 4 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Program-redigering (øvelsesformular, reps-interval) | 100 | 92 | 690 | 8 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Coach Briefing (indbakke) | 100 | 80 | 688 | 6 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Coach Briefing (tom tilstand) | 100 | 80 | 665 | 2 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Videoer (VideoCoach-analyser) | 100 | 85 | 674 | 6 | 1 | 0 | nej | 0 |
| Desktop 1440×900 | Videoer (tom tilstand) | 100 | 80 | 666 | 3 | 1 | 0 | nej | 0 |

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
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (8 elementer)

### Desktop 1440×900 · Videoer (tom tilstand)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (3 elementer)


## Før → efter

- **iPad landscape 1180×820::Atletliste (12 attrap-atleter)**: perf 99, a11y 80, TTI 799 → 791 ms, sidevægt 16 → 17 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Atletliste (tom tilstand)**: perf 100, a11y 80, TTI 659 → 646 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Én atlets uge (hub)**: perf 100, a11y 85, TTI 785 → 818 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Check-in-gennemgang**: perf 99 → 100, a11y 85, TTI 794 → 673 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 1 → 0
- **iPad landscape 1180×820::Check-in-gennemgang (tom tilstand)**: perf 100, a11y 85, TTI 650 → 669 ms, sidevægt 4 KB, axe-fejl 1, trykflader<44px 1 → 0
- **iPad landscape 1180×820::Program-redigering (øvelsesformular, reps-interval)**: perf 100, a11y 74 → 92, TTI 643 → 679 ms, sidevægt 7 → 8 KB, axe-fejl 2 → 1, trykflader<44px 6 → 0
- **iPad landscape 1180×820::Coach Briefing (indbakke)**: perf 100, a11y 80, TTI 670 → 674 ms, sidevægt 6 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Coach Briefing (tom tilstand)**: perf 100, a11y 80, TTI 660 ms, sidevægt 2 KB, axe-fejl 1, trykflader<44px 0
- **iPad landscape 1180×820::Videoer (VideoCoach-analyser)**: perf 100 → 98, a11y 85, TTI 685 → 838 ms, sidevægt 5 → 6 KB, axe-fejl 1, trykflader<44px 4 → 0
- **iPad landscape 1180×820::Videoer (tom tilstand)**: perf 100 → 99, a11y 80, TTI 661 → 814 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Atletliste (12 attrap-atleter)**: perf 99, a11y 80, TTI 894 → 888 ms, sidevægt 16 → 17 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Atletliste (tom tilstand)**: perf 100, a11y 80, TTI 743 → 712 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Én atlets uge (hub)**: perf 100 → 99, a11y 85, TTI 714 → 738 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Check-in-gennemgang**: perf 100, a11y 85, TTI 750 → 747 ms, sidevægt 7 KB, axe-fejl 1, trykflader<44px 1 → 0
- **Desktop 1440×900::Check-in-gennemgang (tom tilstand)**: perf 100, a11y 85, TTI 749 → 737 ms, sidevægt 4 KB, axe-fejl 1, trykflader<44px 1 → 0
- **Desktop 1440×900::Program-redigering (øvelsesformular, reps-interval)**: perf 100, a11y 74 → 92, TTI 687 → 690 ms, sidevægt 7 → 8 KB, axe-fejl 2 → 1, trykflader<44px 6 → 0
- **Desktop 1440×900::Coach Briefing (indbakke)**: perf 100, a11y 80, TTI 670 → 688 ms, sidevægt 6 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Coach Briefing (tom tilstand)**: perf 100, a11y 80, TTI 658 → 665 ms, sidevægt 2 KB, axe-fejl 1, trykflader<44px 0
- **Desktop 1440×900::Videoer (VideoCoach-analyser)**: perf 100, a11y 85, TTI 773 → 674 ms, sidevægt 5 → 6 KB, axe-fejl 1, trykflader<44px 4 → 0
- **Desktop 1440×900::Videoer (tom tilstand)**: perf 100, a11y 80, TTI 662 → 666 ms, sidevægt 3 KB, axe-fejl 1, trykflader<44px 0
