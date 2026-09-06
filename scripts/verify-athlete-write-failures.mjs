// ORDRE 41 — fund #1: besked-afsendelse og kostlogning skrev direkte til
// Supabase uden at kigge på `{ error }`. Ved et netværksdrop virkede skærmen
// som om det lykkedes (feltet blev ryddet, listen genindlæst uden det nye
// punkt) — atleten fik aldrig at vide at intet blev gemt. Se
// src/athleteWriteGuard.js (ren logik, dækket af athleteWriteGuard.test.js)
// og src/athleteWriteGuard.test.js for selve garden. Dette script bekræfter
// at hvert af de identificerede skrivepunkter i AthleteView.jsx rent faktisk
// er koblet igennem den garde, og at det værste symptom — at
// beskedfeltet ryddes FØR skrivningen er bekræftet — er væk.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

assert.match(athleteView, /import \{ runGuardedWrite \} from '\.\/athleteWriteGuard'/)

const extractFn = (name) => {
  const match = athleteView.match(new RegExp(`async function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`))
  assert.ok(match, `${name} skal kunne findes som en samlet funktion`)
  return match[0]
}

// Som extractFn, men uafhængig af indrykningsniveau — finder funktionens
// åbnings-brace og tæller sig frem til den matchende lukke-brace. Nødvendig
// for funktioner defineret dybt inde i JSX (fx markGoodAndSave), hvor den
// simple "\n  }"-formodning ovenfor ikke holder.
const extractFnBalanced = (name) => {
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

// sendAthleteMessage: det konkrete symptom var at inputtet blev ryddet
// UANSET om skrivningen lykkedes. Tjek at rydningen kommer EFTER garden,
// altså kun når den lykkedes.
const sendMessage = extractFn('sendAthleteMessage')
assert.match(sendMessage, /runGuardedWrite\(/, 'sendAthleteMessage skal gå igennem write-garden')
assert.match(sendMessage, /if \(!ok\) return[\s\S]*setMessageInput\(''\)/,
  'Beskedfeltet må først ryddes EFTER en bekræftet skrivning')
assert.doesNotMatch(sendMessage.split('runGuardedWrite')[0], /setMessageInput\(''\)/,
  'Beskedfeltet må ikke ryddes FØR skrivningen er forsøgt')

// Kostlog-funktionerne: alle skal gå igennem garden, og ingen må længere have
// et rått, utjekket meal_logs/meal_templates-kald.
for (const name of ['quickLogFood', 'copyYesterday', 'saveTemplate', 'logTemplate', 'addFromSearch', 'quickAddSearchFood', 'deleteLog', 'saveEditLog']) {
  const fn = extractFn(name)
  assert.match(fn, /runGuardedWrite\(/, `${name} skal gå igennem write-garden`)
  assert.doesNotMatch(fn, /await supabase\s*\n?\s*\.from\('meal_(logs|templates)'\)\.(insert|update|delete)/,
    `${name} må ikke skrive direkte uden om garden`)
}

// ORDRE 64 — "de stille fejl, runde 2": F4 fra ordre 41's fundliste havde
// samme mønster som F1/F2 herover. Samme tjek, nye steder.
for (const name of ['skipSet', 'skipExercise', 'unskipSet']) {
  const fn = extractFn(name)
  assert.match(fn, /runGuardedWrite\(/, `${name} skal gå igennem write-garden`)
  assert.match(fn, /if \(!ok\) return[\s\S]*fetchExerciseLogs\(/,
    `${name} må først genindlæse sæt-loggen EFTER en bekræftet skrivning`)
}

// F5: markGoodAndSave må kun opdatere athlete.squat/bench/deadlift i UI'en når
// RPC'en har svaret uden fejl.
const markGoodAndSave = extractFnBalanced('markGoodAndSave')
assert.match(markGoodAndSave, /runGuardedWrite\(/, 'markGoodAndSave skal gå igennem write-garden')
assert.match(markGoodAndSave, /if \(ok\) setAthlete\(/,
  'setAthlete må kun kaldes når update_competition_max har bekræftet skrivningen')

// F6: logSet skal skelne en fejlet SELECT på personal_records fra en tom (men
// fejlfri) SELECT, og logge den fejlede variant til frontend_errors i stedet
// for at gemme en ny baseline.
const logSet = extractFn('logSet')
assert.match(logSet, /error:\s*prFetchError/, 'logSet skal kigge på fejlen fra SELECT på personal_records')
assert.match(logSet, /if \(prFetchError\)[\s\S]*logFrontendError\(/,
  'en fejlet SELECT skal logges til frontend_errors, ikke tolkes som "ingen tidligere data"')

// F7: saveReadiness må ikke vise den rå Supabase-fejlbesked til atleten.
const saveReadiness = extractFn('saveReadiness')
assert.match(saveReadiness, /logFrontendError\(/, 'saveReadiness skal logge fejldetaljen til frontend_errors')
assert.doesNotMatch(saveReadiness, /setReadinessError\(error\.message\)/,
  'atleten må ikke se den rå Supabase-fejlbesked — den skal oversættes til én sætning')

console.log('Besked- og kostlog-skrivninger viser en fejl og lader IKKE som succes, når skrivningen fejler.')
console.log('Spring-over, stævnemaks, PR-detektion og parathed følger nu samme mønster (ordre 64).')
