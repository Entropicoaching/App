// ORDRE 41 — fund #2: "Log" og "Spring over" i sæt-loggeren var omkring 33px
// høje (0.65rem lodret padding + en 0.55-0.65rem skrifttype, ingen fast
// højde) — under de anbefalte 44px tommelfinger-trykflade, og placeret side
// om side som to knapper med MODSATTE effekter (gem sættet vs. kassér det),
// trykket flere gange for hvert sæt i hver eneste træning. RPE-vælgeren var
// endnu mindre (~24px). Dette script låser at de tre nu har en eksplicit
// min-height på mindst 44px, så en fremtidig style-justering ikke kan snige
// trykfladen under grænsen igen uden at et script fejler synligt.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

const MIN_TAP_TARGET_PX = 44

function assertMinHeightAtLeast(snippet, label) {
  const match = snippet.match(/minHeight:\s*'(\d+(?:\.\d+)?)px'/)
  assert.ok(match, `${label}: mangler en eksplicit minHeight i px`)
  const px = Number(match[1])
  assert.ok(px >= MIN_TAP_TARGET_PX, `${label}: minHeight er ${px}px, skal være mindst ${MIN_TAP_TARGET_PX}px`)
}

// Log-knappen (bekræfter et sæt)
const logButtonMatch = athleteView.match(/style=\{\{ \.\.\.s\.btnPrimary, minHeight: '44px'[^}]*\}\}\s*\n\s*onClick=\{\(\) => logSet\(/)
assert.ok(logButtonMatch, '"Log"-knappen i sæt-loggeren skal findes med en eksplicit minHeight')
assertMinHeightAtLeast(logButtonMatch[0], '"Log"-knappen')

// Spring over-knappen (kasserer sættet) — ligger lige efter Log i samme række
const skipButtonMatch = athleteView.match(/style=\{\{ \.\.\.s\.btnGhost, minHeight: '44px'[^}]*\}\}\s*\n\s*onClick=\{\(\) => skipSet\(/)
assert.ok(skipButtonMatch, '"Spring over"-knappen i sæt-loggeren skal findes med en eksplicit minHeight')
assertMinHeightAtLeast(skipButtonMatch[0], '"Spring over"-knappen')

// RPE-vælgeren (åbner RPE-listen for det aktuelle sæt)
const rpeButtonMatch = athleteView.match(/onClick=\{\(\) => setOpenRpePicker\(openRpePicker === key \? null : key\)\}\s*\n\s*style=\{\{[\s\S]*?\}\}/)
assert.ok(rpeButtonMatch, 'RPE-vælgerknappen skal findes')
assertMinHeightAtLeast(rpeButtonMatch[0], 'RPE-vælgerknappen')

console.log('"Log", "Spring over" og RPE-vælgeren i sæt-loggeren har alle mindst 44px trykflade.')

// ORDRE 76 — "stille fejl, runde 4", G9/G10/G13: de sidste trykflader under
// 44px fra ordre 41's fundliste (afsnit 3). Samme metode: minHeight (+
// boxSizing/display:inline-flex hvor der er tekst der skal centreres
// lodret) uden at ændre bredden på tekstknapperne. Målt headless mod en
// isoleret gengivelse af de eksakte inline-styles, se ordre 76's rapport.

// G9 — blok-skift-chippen ("næste blok ›"), ~17px høj.
const nextBlockChipMatch = athleteView.match(/style=\{\{ \.\.\.chipStyle, textAlign: 'right', justifyContent: 'flex-end' \}\}\s*\n?\s*onClick=\{\(\) => goToWeek\(phaseStart\[viewedPhaseIdx \+ 1\]\)\}/)
assert.ok(nextBlockChipMatch, '"næste blok"-chippen skal findes')
const chipStyleMatch = athleteView.match(/const chipStyle = \{[\s\S]*?\n\s*\}/)
assert.ok(chipStyleMatch, 'chipStyle-definitionen skal findes')
assertMinHeightAtLeast(chipStyleMatch[0], 'Blok-skift-chippen (chipStyle)')

// G10 — "Log parathed" (~27px høj) og vægtlogningens "Ret" (~17px høj).
const logReadinessMatch = athleteView.match(/style=\{\{ \.\.\.s\.btnPrimary, width: '100%', minHeight: '44px'[\s\S]{0,300}?\}\}\s*\n\s*onClick=\{saveReadiness\}/)
assert.ok(logReadinessMatch, '"Log parathed"-knappen skal findes med en eksplicit minHeight')
assertMinHeightAtLeast(logReadinessMatch[0], '"Log parathed"-knappen')

const retWeightMatch = athleteView.match(/style=\{\{ \.\.\.s\.btnGhost, fontSize: '0\.5rem', padding: '0\.2rem 0\.5rem', minHeight: '44px'[\s\S]{0,150}?\}\}\s*\n?\s*onClick=\{\(\) => setWeightInput\(todayLog\.weight\.toString\(\)\)\}/)
assert.ok(retWeightMatch, 'vægtlogningens "Ret"-knap skal findes med en eksplicit minHeight')
assertMinHeightAtLeast(retWeightMatch[0], 'Vægtlogningens "Ret"-knap')

// G13 — session-vurderingens 1-5-knapper, 40×40px.
const ratingButtonMatch = athleteView.match(/onClick=\{\(\) => setFeedbackInputs\(p => \(\{ \.\.\.p, \[session\.id\]: \{ \.\.\.\(p\[session\.id\] \|\| \{\}\), rating: n \} \}\)\)\}[\s\S]{0,250}?style=\{\{[\s\S]*?\}\}/)
assert.ok(ratingButtonMatch, 'session-vurderingens 1-5-knapper skal findes')
assert.match(ratingButtonMatch[0], /width: '44px', height: '44px'/, 'session-vurderingens knapper skal være 44×44px (kvadratisk, som F13)')

console.log('Blok-skift-chippen, "Log parathed", vægtlogningens "Ret" og session-vurderingens 1-5-knapper har alle mindst 44px trykflade (ordre 76, G9/G10/G13).')
