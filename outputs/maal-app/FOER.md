# Måling før (Ordre 123)

Målt 2026-09-12 07:13 UTC, 3 profiler × 6 skærme, med attrap-data (ingen atletdata).

**Den autentificerede skal** (main + AthleteView-chunk — det SPA'en henter uanset hvilken atlet-fane der vises, "dagens pas"/"sæt-logger"/"opvarmning"/"check-in" deler denne): 658 KB (index-dL2w5QS2.js, AthleteView-D4p14IkW.js, index-nqMpL4T3.css). Login og videocoach-forsiden er selvstændige og har deres egen sidevægt i tabellen nedenfor.

_Ærlig grænse: "Dagens pas", "Sæt-logger", "Opvarmning" og "Check-in" er isolerede harnesses (ægte src/repsPrescription.js + src/warmup.js + ægte inline-stilarter kopieret fra AthleteView.jsx, syntetiske øvelser) — AthleteView.jsx kræver en levende Supabase-session for slet at boote (se scripts/verify-athlete-reps-per-set-mobile.mjs). Deres "sidevægt"/Perf-tal i tabellen er harness-isolerede, ikke den ægte AthleteView-bundtvægt (se skal-tallet ovenfor). Login og videocoach-forsiden er den ægte, uændrede app._

| Profil | Skærm | Perf | A11y | Sidevægt (KB) | Axe-fejl | Trykflader <44px | Vandret scroll | Tekst ud af boks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone 13 | Login | 66 | 75 | 415 | 2 | 3 | nej | 0 |
| iPhone 13 | Dagens pas | 100 | 91 | 8 | 1 | 3 | nej | 0 |
| iPhone 13 | Sæt-logger (interval-reps) | 100 | 75 | 8 | 2 | 0 | nej | 0 |
| iPhone 13 | Opvarmning | 100 | 86 | 14 | 1 | 10 | nej | 0 |
| iPhone 13 | Videocoach-forside (uden video) | 77 | 93 | 537 | 0 | 0 | nej | 0 |
| iPhone 13 | Check-in (parathed) | 100 | 87 | 13 | 1 | 5 | nej | 0 |
| Android 360×740 | Login | 74 | 75 | 415 | 2 | 3 | nej | 0 |
| Android 360×740 | Dagens pas | 100 | 91 | 8 | 1 | 3 | nej | 0 |
| Android 360×740 | Sæt-logger (interval-reps) | 100 | 75 | 8 | 2 | 0 | nej | 0 |
| Android 360×740 | Opvarmning | 100 | 86 | 14 | 1 | 10 | nej | 0 |
| Android 360×740 | Videocoach-forside (uden video) | 71 | 93 | 537 | 0 | 0 | nej | 0 |
| Android 360×740 | Check-in (parathed) | 100 | 87 | 13 | 1 | 5 | nej | 0 |
| Desktop 1280×800 | Login | — | — | 415 | 2 | 0 | nej | 0 |
| Desktop 1280×800 | Dagens pas | — | — | 8 | 1 | 3 | nej | 0 |
| Desktop 1280×800 | Sæt-logger (interval-reps) | — | — | 8 | 2 | 0 | nej | 0 |
| Desktop 1280×800 | Opvarmning | — | — | 14 | 1 | 10 | nej | 0 |
| Desktop 1280×800 | Videocoach-forside (uden video) | — | — | 547 | 0 | 3 | nej | 0 |
| Desktop 1280×800 | Check-in (parathed) | — | — | 13 | 1 | 5 | nej | 0 |

## Detaljer (trykflader og axe-fund under 44px / kritisk / alvorlig)

### iPhone 13 · Login
- Trykflade: "(uden tekst)" — 340×39px
- Trykflade: "(uden tekst)" — 340×39px
- Trykflade: "Log ind" — 340×40px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (6 elementer)
- Axe (critical): label — Form elements must have labels (2 elementer)

### iPhone 13 · Dagens pas
- Trykflade: "✓ Squat — uge 6 4 øvelser →" — 316×38px
- Trykflade: "▶ Bænkpres — topsæt Næste 5 øvelser →" — 316×37px
- Trykflade: "Dødløft — volumen Torsdag 4 øvelser →" — 316×37px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (9 elementer)

### iPhone 13 · Sæt-logger (interval-reps)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (10 elementer)
- Axe (critical): label — Form elements must have labels (2 elementer)

### iPhone 13 · Opvarmning
- Trykflade: "Opvarmningssæt 1: 20kg × 5" — 331×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 2: 47.5kg × 5" — 331×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 3: 72.5kg × 5" — 331×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 4: 95kg × 3" — 331×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 5: 117.5kg × 2" — 331×32px
- Trykflade: "✕" — 32×32px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### iPhone 13 · Check-in (parathed)
- Trykflade: "timer" — 90×39px
- Trykflade: "Ben" — 49×29px
- Trykflade: "Ryg" — 49×29px
- Trykflade: "Skuldre/Arme" — 103×29px
- Trykflade: "Core" — 55×29px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (21 elementer)

### Android 360×740 · Login
- Trykflade: "(uden tekst)" — 310×39px
- Trykflade: "(uden tekst)" — 310×39px
- Trykflade: "Log ind" — 310×40px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (6 elementer)
- Axe (critical): label — Form elements must have labels (2 elementer)

### Android 360×740 · Dagens pas
- Trykflade: "✓ Squat — uge 6 4 øvelser →" — 286×38px
- Trykflade: "▶ Bænkpres — topsæt Næste 5 øvelser →" — 286×37px
- Trykflade: "Dødløft — volumen Torsdag 4 øvelser →" — 286×37px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (9 elementer)

### Android 360×740 · Sæt-logger (interval-reps)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (10 elementer)
- Axe (critical): label — Form elements must have labels (2 elementer)

### Android 360×740 · Opvarmning
- Trykflade: "Opvarmningssæt 1: 20kg × 5" — 301×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 2: 47.5kg × 5" — 301×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 3: 72.5kg × 5" — 301×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 4: 95kg × 3" — 301×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 5: 117.5kg × 2" — 301×32px
- Trykflade: "✕" — 32×32px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### Android 360×740 · Check-in (parathed)
- Trykflade: "timer" — 90×39px
- Trykflade: "Ben" — 49×29px
- Trykflade: "Ryg" — 49×29px
- Trykflade: "Skuldre/Arme" — 103×29px
- Trykflade: "Core" — 55×29px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (21 elementer)

### Desktop 1280×800 · Login
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (6 elementer)
- Axe (critical): label — Form elements must have labels (2 elementer)

### Desktop 1280×800 · Dagens pas
- Trykflade: "✓ Squat — uge 6 4 øvelser →" — 606×38px
- Trykflade: "▶ Bænkpres — topsæt Næste 5 øvelser →" — 606×37px
- Trykflade: "Dødløft — volumen Torsdag 4 øvelser →" — 606×37px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (9 elementer)

### Desktop 1280×800 · Sæt-logger (interval-reps)
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (10 elementer)
- Axe (critical): label — Form elements must have labels (2 elementer)

### Desktop 1280×800 · Opvarmning
- Trykflade: "Opvarmningssæt 1: 20kg × 5" — 621×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 2: 47.5kg × 5" — 621×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 3: 72.5kg × 5" — 621×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 4: 95kg × 3" — 621×32px
- Trykflade: "✕" — 32×32px
- Trykflade: "Opvarmningssæt 5: 117.5kg × 2" — 621×32px
- Trykflade: "✕" — 32×32px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (11 elementer)

### Desktop 1280×800 · Videocoach-forside (uden video)
- Trykflade: "Video" — 78×36px
- Trykflade: "Bane" — 78×36px
- Trykflade: "Eksport" — 78×36px

### Desktop 1280×800 · Check-in (parathed)
- Trykflade: "timer" — 90×39px
- Trykflade: "Ben" — 49×29px
- Trykflade: "Ryg" — 49×29px
- Trykflade: "Skuldre/Arme" — 103×29px
- Trykflade: "Core" — 55×29px
- Axe (serious): color-contrast — Elements must meet minimum color contrast ratio thresholds (21 elementer)

