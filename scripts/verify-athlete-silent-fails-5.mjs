// ORDRE 131 — "stille fejl, runde 5", commit 2: G14-G16 (se
// docs/STILLE-FEJL-5.md for kataloget). Dette script bekræfter statisk
// (samme metode som ordre 41/64/68/76's verify-athlete-*-failures.mjs) at
// de tre rettede fund rent faktisk er koblet korrekt i kildeteksten — ikke
// en levende test mod en rigtig Supabase-instans, se "Ærlige grænser" i
// RAPPORT-131.md. Coach-visningen (commit 3) har sit eget script,
// verify-athlete-silent-fail-visibility.mjs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

const extractFn = (name) => {
  const match = athleteView.match(new RegExp(`async function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`))
  assert.ok(match, `${name} skal kunne findes som en samlet funktion`)
  return match[0]
}

assert.match(athleteView,
  /import \{ recordSilentFail, attachPendingSilentFails, clearPendingSilentFails, markUploadInflight,\s*\n\s*clearUploadInflight, takeStaleUploadInflight \} from '\.\/athleteSilentFailLog'/,
  'AthleteView.jsx skal importere hele stille-fejl-log-API\'et fra athleteSilentFailLog.js')

// --- G14: PR-detektion viste "PR!" selv når INSERT'en på personal_records fejlede ---
const logSet = extractFn('logSet')
assert.match(logSet, /queueWrite\(\(\) => supabase\.from\('personal_records'\)\.insert/,
  'PR-INSERT skal gå igennem queueWrite (samme genforsøg-med-backoff som resten af skrivningerne)')
assert.match(logSet, /error: baselineError[\s\S]*recordSilentFail\(athlete\.id, 'silent:pr-insert-failed'\)/,
  'en fejlet baseline-INSERT skal registreres som en stille fejl')
assert.match(logSet, /error: prSaveError[\s\S]*recordSilentFail\(athlete\.id, 'silent:pr-insert-failed'\)/,
  'en fejlet PR-INSERT skal registreres som en stille fejl')
// Det konkrete symptom: setPrToast må ALDRIG stå ubetinget efter savePR() længere.
assert.doesNotMatch(logSet, /await savePR\(\)\s*\n\s*setPrToast/,
  'setPrToast må ikke kaldes ubetinget efter savePR() — kun når INSERT\'en er bekræftet')
assert.match(logSet, /if \(prSaveError\) \{[\s\S]*?\} else \{\s*\n\s*setPrToast/,
  'setPrToast skal stå i else-grenen af en fejltjekket PR-INSERT')

// --- G15: logWeight ryddede feltet og genindlæste uden noget fejltjek ---
const logWeight = extractFn('logWeight')
assert.match(logWeight, /runGuardedWrite\(/, 'logWeight skal gå igennem write-garden')
assert.match(logWeight, /recordSilentFail\(athlete\.id, 'silent:weight-log-failed'\)/,
  'en fejlet vægtlogning skal registreres som en stille fejl')
assert.match(logWeight, /if \(!ok\) return[\s\S]*setWeightInput\(''\)/,
  'Vægtfeltet må først ryddes EFTER en bekræftet skrivning')
assert.doesNotMatch(logWeight.split('runGuardedWrite')[0], /setWeightInput\(''\)/,
  'Vægtfeltet må ikke ryddes FØR skrivningen er forsøgt')

// --- G16: en afbrudt (fane lukket/genindlæst) videoupload var helt usynlig ---
assert.match(athleteView, /markUploadInflight\(currentAthlete\.id, message\.requestId\)/,
  'en inflight-markør skal sættes FØR selve overførslen begynder')
assert.match(athleteView, /if \(currentAthlete\?\.id\) clearUploadInflight\(currentAthlete\.id\)/,
  'reply()-lukningen skal rydde inflight-markøren ved ethvert bekræftet udfald')
// Markøren skal sættes FØR upload()-kaldet, ikke efter.
const uploadAndGoBlock = athleteView.slice(
  athleteView.indexOf('ATHLETE_VIDEOCOACH_PREFIX}:upload-and-go`'),
  athleteView.indexOf('ATHLETE_VIDEOCOACH_PREFIX}:save-draft`'))
assert.ok(
  uploadAndGoBlock.indexOf('markUploadInflight(') < uploadAndGoBlock.indexOf('.upload(path, file'),
  'markUploadInflight skal kaldes FØR storage.upload(), ikke efter')
assert.match(athleteView, /if \(!takeStaleUploadInflight\(athlete\.id\)\) return[\s\S]{0,300}recordSilentFail\(athlete\.id, 'silent:video-upload-interrupted'\)[\s\S]{0,300}setFlash\(/,
  'en fundet stale inflight-markør ved app-åbning skal registreres og vises til atleten (setFlash)')

console.log('G14 (PR-detektion), G15 (vægtlogning) og G16 (afbrudt videoupload) viser nu en ærlig fejl/aldrig en falsk succes.')
