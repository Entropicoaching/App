import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

assert.match(athleteView, /const readinessCardRef = useRef\(null\)/)
assert.match(athleteView, /function openReadiness\(\) \{[\s\S]*?setTab\('hjem'\)[\s\S]*?requestAnimationFrame\(\(\) => requestAnimationFrame/)
assert.match(athleteView, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches/)
assert.match(athleteView, /scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth', block: 'start' \}\)/)
assert.equal((athleteView.match(/onClick=\{openReadiness\}/g) || []).length, 2,
  'Begge eksisterende readiness-prompts skal bruge samme navigation')
assert.match(athleteView, /<button type="button" aria-label="Gå til dagens parathed" onClick=\{openReadiness\}/)
assert.match(athleteView, /ref=\{readinessCardRef\} style=\{\{ \.\.\.s\.card, scrollMarginTop: '5rem' \}\}/)
assert.doesNotMatch(athleteView, /Log dagens parathed[^\n]*\n?[\s\S]{0,500}onClick=\{\(\) => setTab\('hjem'\)\}/)

const readinessStart = athleteView.indexOf('  function calcReadinessScore(')
const readinessEnd = athleteView.indexOf('  async function fetchProgram(', readinessStart)
assert.ok(readinessStart >= 0 && readinessEnd > readinessStart, 'Readinesslogikken skal kunne afgrænses')
const readinessCore = athleteView.slice(readinessStart, readinessEnd)
const readinessCoreHash = createHash('sha256').update(readinessCore).digest('hex').toUpperCase()
assert.equal(readinessCoreHash, 'CC214A5B865CFB9CABB2339A334E931406B35970F2F10DBC3BC8C716A4CA483B',
  'Readinessberegning og persistence må ikke ændres i navigationsopgaven')

console.log('Førstedagsflowet fører begge prompts til det uændrede parathedskort og respekterer reduced motion.')
