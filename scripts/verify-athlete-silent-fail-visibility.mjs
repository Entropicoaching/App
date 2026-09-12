// ORDRE 131 — "stille fejl, runde 5", commit 3: Marc får det at vide. G14-
// G16's koder tømmes ind i video_analyses.session_context (ingen migration,
// samme felt som ordre 109 · commit 3) og vises som én linje i coachens
// atlet-visning. Bekræfter statisk at Dashboard.jsx (og siden ordre 137's
// rebase: src/dashboard/AnalyseTab.jsx, se nedenfor) kun er rørt det ene
// sted ordren tillod, og at kø'en først tømmes ind i en NY række, aldrig
// ryddes før en gemning er bekræftet.
//
// ORDRE 137 · commit 1: ordre 130 (mergede efter 131) splittede analyse-
// fanens JSX ud af Dashboard.jsx i sin egen lazy chunk. Rette-stedet for
// 131's eneste tilladte rendering flyttede derfor med — fra Dashboard.jsx
// til src/dashboard/AnalyseTab.jsx (samme placering, lige før "Kropsvægt"-
// kortet). Dashboard.jsx selv importerer og renderer nu INGEN AthleteSilent-
// FailNote — tjekket ligger derfor på AnalyseTab.jsx i stedet, samme
// "præcis ét sted"-krav som før, blot i den fil koden faktisk bor i nu.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8')
const analyseTab = readFileSync(new URL('../src/dashboard/AnalyseTab.jsx', import.meta.url), 'utf8')
const note = readFileSync(new URL('../src/AthleteSilentFailNote.jsx', import.meta.url), 'utf8')
const silentFailLog = readFileSync(new URL('../src/athleteSilentFailLog.js', import.meta.url), 'utf8')

// --- upload-and-go: koderne lægges i rækken FØR gemning, ryddes kun EFTER ---
const uploadAndGoBlock = athleteView.slice(
  athleteView.indexOf('ATHLETE_VIDEOCOACH_PREFIX}:upload-and-go`'),
  athleteView.indexOf('ATHLETE_VIDEOCOACH_PREFIX}:save-draft`'))
assert.match(uploadAndGoBlock, /attachPendingSilentFails\(row\.session_context, currentAthlete\.id\)/,
  'upload-and-go skal lægge ventende stille-fejl-koder ind i den nye rækkes session_context')
assert.ok(
  uploadAndGoBlock.indexOf('attachPendingSilentFails(') < uploadAndGoBlock.indexOf('await saveVideoCoachDraft'),
  'koderne skal lægges i rækken FØR den forsøges gemt')
assert.ok(
  uploadAndGoBlock.indexOf('clearPendingSilentFails(') > uploadAndGoBlock.indexOf('await saveVideoCoachDraft'),
  'ventekø\'en må først ryddes EFTER saveVideoCoachDraft er kaldt (aldrig før en bekræftet gemning)')

// --- den ældre save-draft-vej (vcV3RequestSave) skal have samme dækning ---
const saveDraftBlock = athleteView.slice(athleteView.indexOf('ATHLETE_VIDEOCOACH_PREFIX}:save-draft`'))
assert.match(saveDraftBlock, /attachPendingSilentFails\(safeRow\.session_context, currentAthlete\.id\)/,
  'save-draft-vejen skal også lægge ventende koder ind i sin række (ordre 109 dokumenterede denne vej som en tidligere blind vinkel)')
assert.match(saveDraftBlock, /clearPendingSilentFails\(currentAthlete\.id\)/,
  'save-draft-vejen skal rydde ventekø\'en ved en bekræftet gemning')

// --- Dashboard.jsx skal siden ordre 137 IKKE selv røre komponenten længere
// (analyse-fanen er en lazy chunk, se AnalyseTab.jsx nedenfor) ---
const dashboardImports = dashboard.match(/^import AthleteSilentFailNote from '\.\/AthleteSilentFailNote'/gm) || []
assert.equal(dashboardImports.length, 0, 'Dashboard.jsx skal ikke længere importere AthleteSilentFailNote — den bor i AnalyseTab.jsx siden ordre 130\'s split (ordre 137)')
const dashboardUsages = dashboard.match(/<AthleteSilentFailNote\b/g) || []
assert.equal(dashboardUsages.length, 0, 'Dashboard.jsx skal ikke længere rendere AthleteSilentFailNote — den bor i AnalyseTab.jsx siden ordre 130\'s split (ordre 137)')

// --- AnalyseTab.jsx: præcis ét import + én rendering (grænsen i ordren, flyttet hertil ordre 137) ---
const analyseTabImports = analyseTab.match(/^import AthleteSilentFailNote from '\.\.\/AthleteSilentFailNote'/gm) || []
assert.equal(analyseTabImports.length, 1, 'AnalyseTab.jsx skal importere AthleteSilentFailNote præcis ét sted')
const analyseTabUsages = analyseTab.match(/<AthleteSilentFailNote\b/g) || []
assert.equal(analyseTabUsages.length, 1, 'AnalyseTab.jsx skal rendere AthleteSilentFailNote præcis ét sted')

// --- AthleteSilentFailNote: kun session_context + created_at hentes, ingen atletdata ---
assert.match(note, /\.select\('session_context, created_at'\)/,
  'komponenten må kun hente session_context og created_at — ingen atletdata')

// --- Whitelist: aldrig fri tekst ind i session_context ---
assert.match(silentFailLog, /'silent:pr-insert-failed',/)
assert.match(silentFailLog, /'silent:weight-log-failed',/)
assert.match(silentFailLog, /'silent:video-upload-interrupted',/)

console.log('Ventende stille-fejl-koder tømmes korrekt ind i næste video_analyses-række (begge gemme-veje).')
console.log('AnalyseTab.jsx er kun rørt det ene sted ordren tillod (import + rendering af AthleteSilentFailNote); Dashboard.jsx rører den slet ikke længere (ordre 137).')
