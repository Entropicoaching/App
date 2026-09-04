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
