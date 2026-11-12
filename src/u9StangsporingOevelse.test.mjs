import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// U9 punkt 4 (Marc 11. nov.): "skal man vælge hvilken øvelse man laver før man kan sætte bar trackeren på,
// jeg forstod ikke hvorfor den ikke gad tracke skiven, og opdagede det først 3. gang".
// Grunden stod i statuskortet, som er skjult i starttrinnet. Nu siger starttrinnet det med det samme.
const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const slice = (from, to) => { const a = html.indexOf(from); assert.ok(a > 0, from); return html.slice(a, html.indexOf(to, a) + to.length) }

function gate({ lift = '', start = null, state = 'ready' } = {}) {
  const src = slice('  const athleteNeedsLift = ', '\n  };\n  syncAthleteLiftGate = () => {')
    .replace(/\n  syncAthleteLiftGate = \(\) => \{$/, '')
  const allBtn = { dataset: {}, disabled: false }, text = { textContent: '' }, mark = { dataset: {}, textContent: '' }
  const liftSel = { value: lift, dataset: {} }
  const document = { body: { dataset: { athleteState: state } }, getElementById: id => id === 'liftSel' ? liftSel : null }
  const vcV3Lift = v => ({ Squat: 'squat', Bænkpres: 'bench', Dødløft: 'deadlift' })[v] || null
  const run = new Function('document', 'allBtn', 'athleteStartGuideText', 'athleteMarkStartBtn', 'manualTrackingBounds', 'vcV3Lift', 'athleteTime', 'ATHLETE',
    `${src}\nresetAthleteStartGuide(); syncAthleteStartGate();`)
  run(document, allBtn, text, mark, { start }, vcV3Lift, s => `0:0${s}.0`, true)
  return { allBtn, text: text.textContent, liftSel }
}

test('U9 4: uden øvelse står grunden ved tidslinjen med det samme, og knappen siger "Vælg øvelse først"', () => {
  const g = gate()
  assert.equal(g.allBtn.dataset.label, 'Vælg øvelse først')
  assert.equal(g.allBtn.disabled, true)
  assert.match(g.text, /Vælg øvelse øverst/)
  assert.match(g.text, /sporingen bruger øvelsen/i)
  assert.equal(g.liftSel.dataset.mangler, 'true')
})

test('U9 4: med øvelse er porten væk, og start-trinnet er som før', () => {
  const g = gate({ lift: 'Squat' })
  assert.equal(g.allBtn.dataset.label, 'Sæt start først')
  assert.equal(g.text, 'Spol til lige før løftet starter')
  const klar = gate({ lift: 'Squat', start: 1 })
  assert.equal(klar.allBtn.dataset.label, 'Stangbane'); assert.equal(klar.allBtn.disabled, false)
})

test('U9 4: et øvelsesvalg opdaterer porten straks, og det blokerede tryk viser grunden synligt', () => {
  const listener = slice("document.getElementById('liftSel').addEventListener('change', e => {", 'vcSyncPriorSetup();')
  assert.match(listener, /syncAthleteLiftGate\?\.\(\)/)
  const block = slice("  if (ATHLETE && !vcV3Lift(document.getElementById('liftSel').value)) {", 'return;')
  assert.match(block, /syncAthleteLiftGate\?\.\(\)/)
})
