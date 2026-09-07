// ORDRE 76 — "stille fejl, runde 4", G1: fetchProgram og stort set alle
// andre rå Supabase-læsninger på atletens vej (AthleteView.jsx) tjekkede
// ikke `{ error }`. Ved en fejl var `data` tom/undefined, og koden viste
// den SAMME tomme-tilstand som et ægte tomt resultat — for programmet
// betød det konkret: en atlet kunne ikke se forskel på "din coach er ikke
// færdig endnu" og "noget gik galt, prøv igen". Se src/athleteReadGuard.js
// (ren logik, dækket af athleteReadGuard.test.js). Dette script bekræfter
// statisk at hvert identificeret læsepunkt rent faktisk går gennem
// runGuardedRead, og at kalderen kun opdaterer sin tilstand EFTER et
// bekræftet svar (dvs. "if (!ok) return" før setteren).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

assert.match(athleteView, /import \{ runGuardedRead \} from '\.\/athleteReadGuard'/)

const extractFn = (name) => {
  const startMatch = athleteView.match(new RegExp(`async function ${name}\\([^)]*\\) \\{`))
  assert.ok(startMatch, `${name} skal kunne findes som en samlet funktion`)
  const bodyStart = startMatch.index + startMatch[0].length
  let depth = 1
  let i = bodyStart
  while (depth > 0 && i < athleteView.length) {
    if (athleteView[i] === '{') depth++
    else if (athleteView[i] === '}') depth--
    i++
  }
  return athleteView.slice(startMatch.index, i)
}

// Læsninger der sætter én tilstand direkte efter et enkelt runGuardedRead-kald.
// setter = null betyder "returnerer data til kalderen" (fetchWeekLogs), ikke en setter.
const SIMPLE_READS = [
  ['fetchPRs', 'setPrs'],
  ['fetchMeetPlan', 'setHasMeetPlan'],
  ['fetchMeetResults', 'setMeetResults'],
  ['fetchWarmupTemplates', 'setWarmupTemplates'],
  ['fetchWeeklyTonnage', 'setWeeklyTonnage'],
  ['fetchWeekLogs', null],
  ['fetchPastLogs', 'setPastLogs'],
  ['fetchExerciseLogs', 'setExerciseLogs'],
  ['fetchLastLogs', 'setLastLogByExerciseName'],
  ['fetchExerciseHistory', 'setExerciseHistory'],
  ['fetchWeightLogs', 'setWeightLogs'],
  ['fetchAthleteMessages', 'setMessages'],
  ['fetchLogs', 'setLogs'],
  ['fetchHistoricalMealLogs', 'setHistoricalMealLogs'],
  ['fetchFrequentFoods', 'setFrequentFoods'],
  ['fetchMealTemplates', 'setMealTemplates'],
  ['fetchCustomFoods', 'setCustomFoods'],
]

for (const [name, setter] of SIMPLE_READS) {
  const fn = extractFn(name)
  assert.match(fn, /runGuardedRead\(/, `${name} skal gå igennem læse-garden`)
  assert.match(fn, /if \(!ok(?:\s*\|\|\s*!data)?\) return/, `${name} skal returnere tidligt når læsningen er fejlet`)
  if (setter) {
    const guardIdx = fn.indexOf('runGuardedRead(')
    const returnIdx = fn.indexOf('if (!ok', guardIdx)
    // Søg EFTER returIdx — nogle funktioner har en tidlig guard-klausul
    // (fx "ingen øvelser i ugen") der lovligt kalder samme setter FØR
    // læsningen overhovedet forsøges; det er ikke det denne test tjekker.
    const setterIdx = fn.indexOf(setter + '(', returnIdx)
    assert.ok(setterIdx > returnIdx && returnIdx > guardIdx,
      `${name}: ${setter} skal kaldes EFTER det tidlige return, ikke før`)
  }
}

// fetchReadiness: to uafhængige læsninger (i dag, sidste), begge garderede.
const fetchReadiness = extractFn('fetchReadiness')
assert.equal((fetchReadiness.match(/runGuardedRead\(/g) || []).length, 2,
  'fetchReadiness skal have to garderede læsninger (dagens og sidste parathed)')
assert.match(fetchReadiness, /if \(!ok\) return[\s\S]*setReadinessLog\(/,
  'setReadinessLog skal kun kaldes når dagens parathed er bekræftet hentet')
assert.match(fetchReadiness, /if \(!prevOk\) return[\s\S]*setLastReadiness\(/,
  'setLastReadiness skal kun kaldes når sidste parathed er bekræftet hentet')

// fetchProgram: den flagskibs-fejl fra ordre 70/76's fund — programError
// skal skelne "programmet er tomt" fra "programmet kunne ikke hentes", og
// UI'en skal IKKE vise "Dit program er på vej" ved en fejl.
const fetchProgram = extractFn('fetchProgram')
assert.match(fetchProgram, /runGuardedRead\(/, 'fetchProgram skal gå igennem læse-garden')
assert.match(fetchProgram, /if \(!ok\) \{ setProgramError\(true\); return \}/,
  'en fejlet programhentning skal sætte programError, ikke stille returnere')
assert.match(fetchProgram, /setProgramError\(false\)/,
  'et bekræftet (om end tomt) svar skal rydde en tidligere fejlvisning')
// Rækkefølgen i JSX'en afgør hvilken tekst der vises: programError skal
// afgøre valget FØR nogen af de to tekster, og fejlteksten skal stå i
// programError-grenen (ikke i "på vej"-grenen, som ellers ville vise begge).
const emptyProgramBlockStart = athleteView.indexOf('allWeeks.length === 0 ?')
const ternaryIdx = athleteView.indexOf('programError ? (', emptyProgramBlockStart)
const errorTextIdx = athleteView.indexOf('Dit program kunne ikke hentes.', ternaryIdx)
const onVejTextIdx = athleteView.indexOf('Dit program er på vej.', ternaryIdx)
assert.ok(emptyProgramBlockStart > 0, 'skal kunne finde allWeeks.length === 0-grenen')
assert.ok(ternaryIdx > emptyProgramBlockStart, 'programError skal afgøre visningen inde i den tomme-program-gren')
assert.ok(errorTextIdx > ternaryIdx && errorTextIdx < onVejTextIdx,
  '"Dit program kunne ikke hentes." skal stå i programError-grenen, FØR "på vej"-teksten')

console.log('fetchProgram og 18 andre rå læsninger i AthleteView.jsx går nu gennem runGuardedRead (ordre 76, G1).')
console.log('En fejlet programhentning viser en ærlig fejllinje, ikke "Dit program er på vej".')
