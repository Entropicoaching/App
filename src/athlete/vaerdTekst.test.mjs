import assert from 'node:assert/strict'
import { vaerdTekst, ventendeSaetTekst } from './vaerdTekst.mjs'

// Små rekonstruktioner af de berørte visningsgrene. Ingen originalmoduler køres.
// Kun tekstkilden byttes mellem før og efter; syntetiske props er de samme.
const before = process.argv[2] === 'before'
const tekst = before ? {
  coach: 'Anbefalet', app: 'Forslag',
  note: 'Note til coachen, fx ryg stram',
  foersteSaet: 'Første sæt · tryk for at se', kost: 'Kost i dag',
} : vaerdTekst
const pendingText = before
  ? n => `☁ ${n} sæt gemt lokalt — sendes når forbindelsen er tilbage`
  : ventendeSaetTekst

function raad(ex, suggestion, smerteBesked = null) {
  if (ex.recommended_weight != null) return { label: tekst.coach, kg: ex.recommended_weight }
  if (suggestion?.stop) return { stop: true }
  if (suggestion) return { label: tekst.app, kg: suggestion.weight, rpe: suggestion.fromRpe }
  return smerteBesked ? { message: smerteBesked } : null
}
function pending(n) { return n > 0 ? pendingText(n) : null }
function note(open, value = '') {
  return open || value ? { placeholder: tekst.note, value, maxLength: 200 } : null
}
function pause(first, active = false, available = true) {
  return available && !active ? { label: first ? tekst.foersteSaet : 'Pause', action: first ? 'forklaring' : 'start' } : null
}
function kost(kcal, protein, targets, setTab) {
  return { label: kcal > 0 || protein > 0 ? tekst.kost : 'Kost', kcal, protein, targets, click: () => setTab('kost') }
}

const rows = [
  ['F1 Dagens pas og næste sæt', () => {
    assert.equal(raad({ recommended_weight: 100 }, null).label, 'Fra din coach')
    assert.equal(raad({}, { weight: 95, fromRpe: 8 }).label, 'Appens forslag')
  }],
  ['F1 Sætlog, tidligere sæt, ret og fortryd', () => {
    const field = note(true)
    assert.match(field.placeholder, /squat, sæt 3/)
    assert.match(field.placeholder, /sidste rep/)
  }],
  ['F1 Lokal log og afsendelsesstatus', () => {
    assert.match(pending(2), /Coachen har ikke modtaget dem endnu/)
    assert.match(pending(2), /2 sæt gemt lokalt/)
  }],
  ['F1 Pause og første-sæt-hjælp', () => {
    assert.equal(pause(true).label, 'Første sæt · se hvad du skal løfte')
  }],
  ['F4 Kalorier, protein og statusgenvej', () => {
    assert.equal(kost(350, 20, { kcal: 2200, protein: 140 }, () => {}).label, 'Registreret i dag')
  }],
  ['F7 Forbindelses-, adgangs- og kontohjælp', () => {
    for (const n of [1, 3]) assert.match(pending(n), new RegExp(`${n} sæt gemt lokalt på denne telefon`))
  }],
]
const guards = [
  ['coachvægt 0 og stop har samme prioritet', () => {
    assert.deepEqual(raad({ recommended_weight: 0 }, { stop: true }), { label: tekst.coach, kg: 0 })
    assert.deepEqual(raad({}, { stop: true, weight: 90 }), { stop: true })
    assert.deepEqual(raad({}, { weight: 95, fromRpe: 8 }), { label: tekst.app, kg: 95, rpe: 8 })
    assert.equal(raad({}, null), null)
    assert.deepEqual(raad({}, null, 'Stop her'), { message: 'Stop her' })
  }],
  ['ingen ventelinje uden ventende sæt', () => {
    assert.equal(pending(0), null)
    assert.equal(pending(undefined), null)
    assert.equal(pending(-1), null)
  }],
  ['fri note og maksimum bevares', () => {
    assert.equal(note(false), null)
    const value = 'Min egen note, uden øvelse eller sæt'
    assert.deepEqual(note(false, value), { placeholder: tekst.note, value, maxLength: 200 })
  }],
  ['pauseknappens eksisterende betingelser', () => {
    assert.equal(pause(true, true), null)
    assert.equal(pause(true, false, false), null)
    assert.equal(pause(true).action, 'forklaring')
    assert.equal(pause(false).action, 'start')
  }],
  ['kosttal, mål, tomtilstand og destination', () => {
    let selected
    const targets = { kcal: 2200, protein: 140 }
    const card = kost(350, 20, targets, tab => { selected = tab })
    assert.equal(card.kcal, 350)
    assert.equal(card.protein, 20)
    assert.equal(card.targets, targets)
    card.click()
    assert.equal(selected, 'kost')
    assert.equal(kost(0, 0, targets, () => {}).label, 'Kost')
    assert.equal(kost(0, 20, targets, () => {}).label, tekst.kost)
  }],
]
let failed = 0
for (const [name, run] of before ? rows : [...rows, ...guards]) {
  try { run(); console.log(`PASS ${name}`) }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`) }
}
console.log(`${before ? 'FOER' : 'EFTER'}: ${(before ? rows : [...rows, ...guards]).length - failed} bestået, ${failed} fejlet`)
process.exitCode = failed ? 1 : 0
