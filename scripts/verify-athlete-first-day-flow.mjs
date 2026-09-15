import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')
// Programmets readiness-prompt flyttede til sin egen lazy-loadede fane i
// ordre 232 · commit 3 (ren udflytning, se docs/RAPPORT-232.md) — tælles nu
// på tværs af begge filer.
const programTab = readFileSync(new URL('../src/athlete/ProgramTab.jsx', import.meta.url), 'utf8')

assert.match(athleteView, /const readinessCardRef = useRef\(null\)/)
assert.match(athleteView, /function openReadiness\(\) \{[\s\S]*?setTab\('hjem'\)[\s\S]*?requestAnimationFrame\(\(\) => requestAnimationFrame/)
assert.match(athleteView, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches/)
assert.match(athleteView, /scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth', block: 'start' \}\)/)
const openReadinessCount = (athleteView.match(/onClick=\{openReadiness\}/g) || []).length
  + (programTab.match(/onClick=\{openReadiness\}/g) || []).length
assert.equal(openReadinessCount, 2,
  'Begge eksisterende readiness-prompts skal bruge samme navigation')
assert.match(athleteView, /<button type="button" aria-label="Gå til dagens parathed" onClick=\{openReadiness\}/)
assert.match(athleteView, /ref=\{readinessCardRef\} style=\{\{ \.\.\.s\.card, scrollMarginTop: '5rem' \}\}/)
assert.doesNotMatch(athleteView, /Log dagens parathed[^\n]*\n?[\s\S]{0,500}onClick=\{\(\) => setTab\('hjem'\)\}/)

const readinessStart = athleteView.indexOf('  function calcReadinessScore(')
const readinessEnd = athleteView.indexOf('  async function fetchProgram(', readinessStart)
assert.ok(readinessStart >= 0 && readinessEnd > readinessStart, 'Readinesslogikken skal kunne afgrænses')
const readinessCore = athleteView.slice(readinessStart, readinessEnd).replace(/\r\n/g, '\n')
const readinessCoreHash = createHash('sha256').update(readinessCore).digest('hex').toUpperCase()
// Hash'en er opdateret ved ordre 76 (G12, commit 34064aa: rydder parathedsudkastet
// efter et bekræftet gem) og ordre 64 (F6+F7, commit 8fa3058: viser en oversat
// fejlbesked og logger detaljen til frontend_errors i stedet for Supabases rå fejl).
// Formålet er uændret: lås readiness-kernen mod utilsigtede ændringer i FREMTIDIGE
// navigationsopgaver, ikke mod allerede besluttede ordrer.
assert.equal(readinessCoreHash, '2649BFDF9AEBAB75A996F3EBE566B91447FE13437A5BBD8BDA75E05E47C2F803',
  'Readinessberegning og persistence må ikke ændres i navigationsopgaven')

console.log('Førstedagsflowet fører begge prompts til det uændrede parathedskort og respekterer reduced motion.')
