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

console.log('Besked- og kostlog-skrivninger viser en fejl og lader IKKE som succes, når skrivningen fejler.')
