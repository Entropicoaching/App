// ORDRE 76 — "stille fejl, runde 4", G12: parathedsformularens felter
// (søvn/energi/motivation/stress/ømhed) levede kun i React-state — lukkede
// atleten fanen midt i udfyldningen, var alt tastet væk. Se
// src/readinessDraft.js (ren logik, dækket af readinessDraft.test.js) for
// selve gem/hent/ryd-funktionerne. Dette script bekræfter statisk at
// AthleteView.jsx faktisk kobler dem ind: genindsætter et udkast ved
// åbning, gemmer løbende mens der skrives, og rydder udkastet når loggen
// er bekræftet gemt.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

assert.match(athleteView,
  /import \{ loadReadinessDraft, saveReadinessDraft, clearReadinessDraft, isEmptyReadinessDraft \} from '\.\/readinessDraft'/,
  'AthleteView.jsx skal importere readinessDraft-funktionerne')

// Genindsættelse: skal ske via loadReadinessDraft, og kun sætte staten når
// udkastet rent faktisk indeholder noget.
assert.match(athleteView, /loadReadinessDraft\(athlete\.id, today\(\)\)/,
  'skal forsøge at hente et gemt udkast for den aktuelle atlet+dato')
assert.match(athleteView, /if \(draft && !isEmptyReadinessDraft\(draft\)\) \{[\s\S]{0,300}setReadinessInput\(draft\)/,
  'et fundet, ikke-tomt udkast skal genindsætte formularen')

// Løbende gem: skal ske via saveReadinessDraft, styret af isEmptyReadinessDraft
// (så et tomt udkast ikke bare skriver tomme rækker til storage).
assert.match(athleteView, /isEmptyReadinessDraft\(readinessInput\)\) clearReadinessDraft\(athlete\.id, today\(\)\)/,
  'et tomt formularindhold skal rydde et evt. eksisterende udkast')
assert.match(athleteView, /else saveReadinessDraft\(athlete\.id, today\(\), readinessInput\)/,
  'et ikke-tomt formularindhold skal gemmes som udkast')

// Ryd ved gemt log: saveReadiness's succes-gren (efter et bekræftet insert)
// skal rydde udkastet, IKKE fejl-grenen (en fejlet skrivning må ikke slette
// det atleten lige har tastet).
const saveReadiness = (() => {
  const start = athleteView.match(/async function saveReadiness\(\) \{/)
  assert.ok(start, 'saveReadiness skal kunne findes')
  const bodyStart = start.index + start[0].length
  let depth = 1, i = bodyStart
  while (depth > 0 && i < athleteView.length) {
    if (athleteView[i] === '{') depth++
    else if (athleteView[i] === '}') depth--
    i++
  }
  return athleteView.slice(start.index, i)
})()
assert.match(saveReadiness, /setReadinessLog\(\{ \.\.\.payload \}\)[\s\S]{0,220}clearReadinessDraft\(athlete\.id, today\(\)\)/,
  'clearReadinessDraft skal kaldes EFTER setReadinessLog i succes-grenen, ikke i fejl-grenen')
assert.doesNotMatch(saveReadiness.split('setReadinessError(')[1] || '', /clearReadinessDraft/,
  'en fejlet gemning må ikke rydde udkastet — atleten skal kunne prøve igen uden at have tastet forgæves')

console.log('Parathedsudkastet genindsættes ved åbning, gemmes løbende, og ryddes når loggen er bekræftet gemt (ordre 76, G12).')
