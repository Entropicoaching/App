# Måling efter (Ordre 123)

Målt 2026-09-12 13:13 UTC, 3 profiler × 6 skærme, med attrap-data (ingen atletdata).

**Den autentificerede skal** (main + AthleteView-chunk — det SPA'en henter uanset hvilken atlet-fane der vises, "dagens pas"/"sæt-logger"/"opvarmning"/"check-in" deler denne): 658 KB (index-CI55-E0h.js, AthleteView-3qMwiKRS.js, index-nqMpL4T3.css). Login og videocoach-forsiden er selvstændige og har deres egen sidevægt i tabellen nedenfor.

_Ærlig grænse: "Dagens pas", "Sæt-logger", "Opvarmning" og "Check-in" er isolerede harnesses (ægte src/repsPrescription.js + src/warmup.js + ægte inline-stilarter kopieret fra AthleteView.jsx, syntetiske øvelser) — AthleteView.jsx kræver en levende Supabase-session for slet at boote (se scripts/verify-athlete-reps-per-set-mobile.mjs). Deres "sidevægt"/Perf-tal i tabellen er harness-isolerede, ikke den ægte AthleteView-bundtvægt (se skal-tallet ovenfor). Login og videocoach-forsiden er den ægte, uændrede app._

| Profil | Skærm | Perf | A11y | Sidevægt (KB) | Axe-fejl | Trykflader <44px | Vandret scroll | Tekst ud af boks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone 13 | Login | 65 | 87 | 416 | 1 | 2 | nej | 0 |
| iPhone 13 | Dagens pas | 100 | 91 | 8 | 1 | 0 | nej | 0 |
| iPhone 13 | Sæt-logger (interval-reps) | 100 | 92 | 8 | 1 | 0 | nej | 0 |
| iPhone 13 | Opvarmning | 100 | 86 | 14 | 1 | 0 | nej | 0 |
| iPhone 13 | Videocoach-forside (uden video) | 78 | 93 | 544 | 0 | 0 | nej | 0 |
| iPhone 13 | Check-in (parathed) | 100 | 87 | 14 | 1 | 1 | nej | 0 |
| Android 360×740 | Login | 65 | 87 | 416 | 1 | 2 | nej | 0 |
| Android 360×740 | Dagens pas | 100 | 91 | 8 | 1 | 0 | nej | 0 |
| Android 360×740 | Sæt-logger (interval-reps) | 100 | 92 | 8 | 1 | 0 | nej | 0 |
| Android 360×740 | Opvarmning | 100 | 86 | 14 | 1 | 0 | nej | 0 |
| Android 360×740 | Videocoach-forside (uden video) | 71 | 93 | 544 | 0 | 0 | nej | 0 |
| Android 360×740 | Check-in (parathed) | 99 | 87 | 14 | 1 | 1 | nej | 0 |
| Desktop 1280×800 | Login | — | — | 416 | 1 | 0 | nej | 0 |
| Desktop 1280×800 | Dagens pas | — | — | 8 | 1 | 0 | nej | 0 |
| Desktop 1280×800 | Sæt-logger (interval-reps) | — | — | 8 | 1 | 0 | nej | 0 |
| Desktop 1280×800 | Opvarmning | — | — | 14 | 1 | 0 | nej | 0 |
| Desktop 1280×800 | Videocoach-forside (uden video) | — | — | 554 | 0 | 0 | nej | 0 |
| Desktop 1280×800 | Check-in (parathed) | — | — | 14 | 1 | 1 | nej | 0 |

## Detaljer (trykflader og axe-fund under 44px / kritisk / alvorlig)

### iPhone 13 · Login
- Trykflade: "(uden tekst)" — 340×39px
- Trykflade: "(uden tekst)" — 340×39px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (6 elementer)

### iPhone 13 · Dagens pas
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (9 elementer)

### iPhone 13 · Sæt-logger (interval-reps)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (10 elementer)

### iPhone 13 · Opvarmning
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### iPhone 13 · Check-in (parathed)
- Trykflade: "timer" — 90×39px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (21 elementer)

### Android 360×740 · Login
- Trykflade: "(uden tekst)" — 310×39px
- Trykflade: "(uden tekst)" — 310×39px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (6 elementer)

### Android 360×740 · Dagens pas
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (9 elementer)

### Android 360×740 · Sæt-logger (interval-reps)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (10 elementer)

### Android 360×740 · Opvarmning
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### Android 360×740 · Check-in (parathed)
- Trykflade: "timer" — 90×39px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (21 elementer)

### Desktop 1280×800 · Login
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (6 elementer)

### Desktop 1280×800 · Dagens pas
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (9 elementer)

### Desktop 1280×800 · Sæt-logger (interval-reps)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (10 elementer)

### Desktop 1280×800 · Opvarmning
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### Desktop 1280×800 · Check-in (parathed)
- Trykflade: "timer" — 90×39px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (21 elementer)


## Før → efter

- **iPhone 13::Login**: perf 66 → 65, a11y 75 → 87, sidevægt 415 → 416 KB, axe-fejl 2 → 1, trykflader<44px 3 → 2
- **iPhone 13::Dagens pas**: perf 100, a11y 91, sidevægt 8 KB, axe-fejl 1, trykflader<44px 3 → 0
- **iPhone 13::Sæt-logger (interval-reps)**: perf 100, a11y 75 → 92, sidevægt 8 KB, axe-fejl 2 → 1, trykflader<44px 0
- **iPhone 13::Opvarmning**: perf 100, a11y 86, sidevægt 14 KB, axe-fejl 1, trykflader<44px 10 → 0
- **iPhone 13::Videocoach-forside (uden video)**: perf 71 → 78, a11y 93, sidevægt 537 → 544 KB, axe-fejl 0, trykflader<44px 0
- **iPhone 13::Check-in (parathed)**: perf 100, a11y 87, sidevægt 13 → 14 KB, axe-fejl 1, trykflader<44px 5 → 1
- **Android 360×740::Login**: perf 74 → 65, a11y 75 → 87, sidevægt 415 → 416 KB, axe-fejl 2 → 1, trykflader<44px 3 → 2
- **Android 360×740::Dagens pas**: perf 100, a11y 91, sidevægt 8 KB, axe-fejl 1, trykflader<44px 3 → 0
- **Android 360×740::Sæt-logger (interval-reps)**: perf 100, a11y 75 → 92, sidevægt 8 KB, axe-fejl 2 → 1, trykflader<44px 0
- **Android 360×740::Opvarmning**: perf 100, a11y 86, sidevægt 14 KB, axe-fejl 1, trykflader<44px 10 → 0
- **Android 360×740::Videocoach-forside (uden video)**: perf 78 → 71, a11y 93, sidevægt 537 → 544 KB, axe-fejl 0, trykflader<44px 0
- **Android 360×740::Check-in (parathed)**: perf 100 → 99, a11y 87, sidevægt 13 → 14 KB, axe-fejl 1, trykflader<44px 5 → 1
- **Desktop 1280×800::Login**: perf undefined, a11y undefined, sidevægt 415 → 416 KB, axe-fejl 2 → 1, trykflader<44px 0
- **Desktop 1280×800::Dagens pas**: perf undefined, a11y undefined, sidevægt 8 KB, axe-fejl 1, trykflader<44px 3 → 0
- **Desktop 1280×800::Sæt-logger (interval-reps)**: perf undefined, a11y undefined, sidevægt 8 KB, axe-fejl 2 → 1, trykflader<44px 0
- **Desktop 1280×800::Opvarmning**: perf undefined, a11y undefined, sidevægt 14 KB, axe-fejl 1, trykflader<44px 10 → 0
- **Desktop 1280×800::Videocoach-forside (uden video)**: perf undefined, a11y undefined, sidevægt 547 → 554 KB, axe-fejl 0, trykflader<44px 3 → 0
- **Desktop 1280×800::Check-in (parathed)**: perf undefined, a11y undefined, sidevægt 13 → 14 KB, axe-fejl 1, trykflader<44px 5 → 1
