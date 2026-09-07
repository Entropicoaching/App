// ORDRE 76 — "stille fejl, runde 4", G5: hviletimerne i mobilisering
// (ExerciseTimer, MobilityGuideStep) talte ned via setTimeout(...,1000) og
// et tick-tal i state — låses skærmen midt i et hold, driver eller springer
// nedtællingen uforudsigeligt ved genoptagelse. Se src/restTimer.js (ren
// logik, dækket af restTimer.test.js) for selve tidsstempel-udregningen.
// Dette script bekræfter statisk at AthleteView.jsx faktisk er koblet om:
// ingen af de to timere tæller længere ned via "setSeconds(s => s - 1)"
// eller lignende, og begge genregner ved visibilitychange.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

assert.match(athleteView, /import \{ remainingSeconds \} from '\.\/restTimer'/,
  'AthleteView.jsx skal importere den tidsstempel-baserede udregning')

// Det gamle, tick-baserede mønster må ikke længere findes noget sted.
assert.doesNotMatch(athleteView, /setTimeout\(\(\) => set\w*Seconds\(s => s - 1\), 1000\)/,
  'ingen timer må stadig tælle ned via "s => s - 1" pr. tick')

const extractFn = (name) => {
  const startMatch = athleteView.match(new RegExp(`function ${name}\\([^)]*\\) \\{`))
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

// ExerciseTimer (sæt-loggerens/programmets stopur for tids-øvelser).
const exerciseTimer = extractFn('ExerciseTimer')
assert.match(exerciseTimer, /remainingSeconds\(/, 'ExerciseTimer skal bruge den tidsstempel-baserede udregning')
assert.match(exerciseTimer, /visibilitychange/, 'ExerciseTimer skal genregne ved visibilitychange (fx skærmen låses op igen)')
assert.doesNotMatch(exerciseTimer, /setSeconds\(s => s - 1\)/, 'ExerciseTimer må ikke længere tælle ned pr. tick')

// Den delte mobilitets-timer (MobilityGuideStep + opvarmningsguiden), ejet
// af AthleteView selv og sendt ind som props (timerSeconds/timerActive/...).
const timerEffectMatch = athleteView.match(/useEffect\(\(\) => \{\s*\/\/ G5:[\s\S]*?\}, \[timerActive\]\)/)
assert.ok(timerEffectMatch, 'den delte mobilitets-timers effekt (nøglet på [timerActive]) skal kunne findes')
const timerEffect = timerEffectMatch[0]
assert.match(timerEffect, /remainingSeconds\(/, 'mobilitets-timeren skal bruge den tidsstempel-baserede udregning')
assert.match(timerEffect, /visibilitychange/, 'mobilitets-timeren skal genregne ved visibilitychange')
assert.doesNotMatch(timerEffect, /setTimerSeconds\(s => s - 1\)/, 'mobilitets-timeren må ikke længere tælle ned pr. tick')

console.log('ExerciseTimer og den delte mobilitets-timer regner nu ud fra tidsstempler, ikke ticks (ordre 76, G5).')
console.log('Begge genregner ved visibilitychange, så en genoptaget/oplåst fane retter sig med det samme.')
