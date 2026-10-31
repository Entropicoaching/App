import './trainingFullscreenRegister.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rel1101Enabled, DEFAULT_REL1101 } from '../rel1101.mjs'
const { default: TrainingFullscreen } = await import('./TrainingFullscreen.mjs')
const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
const prefix = [
  "import NytIAppen, { nytAthleteNavigation } from './nytIAppen.mjs'",
  "import { contactLatestEnabled, enterContact, scrollContactEnd } from './athlete/contactLatest.mjs'",
  "import { VIDEO_SET_SELECTION_ENABLED, videoOptionsForDay, resolveVideoSet } from './athlete/videoSetSelection.mjs'",
  "import { findDagensPas } from './nextSet.js'",
].join('\n') + '\n'
const addition = "import { indbakke2Enabled } from './indbakke2.mjs'"
const home = "        {tab === 'hjem' && (!enkelOn || ['traening', 'alle'].includes(route)) && <MobilityHomeworkHome key={athlete?.id} enabled={mobilitetHjemme} athleteId={athlete?.id} />}"
function contract(value) {
  const normalized = value.replace(/\r\n/g, '\n')
  assert.ok(normalized.startsWith(prefix), 'four initial Athlete imports')
  assert.ok(normalized.split('\n').includes(home), 'complete Home JSX')
  assert.match(normalized, /<MobilityHomeworkProgress enabled=\{mobilitetOpfoelgning === true && !coachAthleteId\} athleteId=\{athlete\?\.id\}>\s*\{tab === 'hjem'/)
}
test('integration 1: indbakke2 locked imports, Home and inbox wiring', () => {
  contract(source)
  assert.equal(source.split(/\r?\n/)[4], addition)
  assert.equal(source.split(addition).length - 1, 1)
  assert.match(source, /const indbakke2 = indbakke2Enabled\(/)
  assert.match(source, /indbakke2 \? indbakke2Factory : beskederFactory/)
})
test('integration 2: indbakke2 original counterexamples still reject both independent mutations', () => {
  const normalized = source.replace(/\r\n/g, '\n')
  assert.throws(() => contract(addition+'\n'+normalized.replace(addition+'\n', '')), /four initial Athlete imports/)
  assert.throws(() => contract(normalized.replace(home, home.trim())), /complete Home JSX/)
})
test('integration 3: rebMob7 exact CRLF prefix and complete Home wrapper survive', () => {
  assert.ok(source.startsWith(prefix.replaceAll('\n', '\r\n')))
  contract(source)
})
test('integration 4: indbakke4 fifth import and scoped OFF factory remain', () => {
  assert.equal(source.replace(/\r\n/g, '\n').split('\n')[4], addition)
  for (const pattern of [/factory=\{indbakke2 \? indbakke2Factory : beskederFactory\}/,
    /inboxReadEnabled: indbakke2 && role === 'athlete' && !coachAthleteId/,
    /inboxDatabase, athleteId: athlete\?\.id/, /setMessages, setUnreadMsgCount,/,
    /enterContact\(\{ enabled: contactLatest/]) assert.match(source, pattern)
})
test('counter: new imports occur once after five locked imports; public gate stays default OFF', () => {
  const lines = source.split(/\r?\n/)
  for (const value of ["import TrainingFullscreen from './athlete/TrainingFullscreen.mjs'", "import { rel1101Enabled } from './rel1101.mjs'"]) {
    assert.ok(lines.indexOf(value) >= 5)
    assert.equal(lines.filter(line => line === value).length, 1)
  }
  assert.equal(typeof TrainingFullscreen, 'function')
  assert.equal(DEFAULT_REL1101, false)
  assert.equal(rel1101Enabled(), false)
  assert.equal(rel1101Enabled(false, '?rel1101=1&rel1101=0'), false)
})
test('counter: source contract rejects missing wrapper independently of imports', () => {
  assert.throws(() => contract(source.replace('mobilitetOpfoelgning === true && !coachAthleteId', 'true')))
})
