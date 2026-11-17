// Ordre 1568: RPE med ét tryk. Fejler før (rpeTrin.mjs fandtes ikke), grøn efter.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chooseRpeInput, stepRpe, stepRpeInInputs } from '../rpeEvidence.mjs'
const RPE_VALUES = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
import { logStil } from './dagensPasLayout.mjs'

const kilde = readFileSync(new URL('./DagensPasCard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('ét tryk på + ændrer RPE med 0,5 og markerer den som valgt', () => {
  const input = { weight: '100', reps: '5', note: '', rpe: '8' }
  const ud = stepRpeInInputs({ a_1: input }, 'a_1', input, 8, 0.5)
  assert.equal(ud.a_1.rpe, '8.5')
  assert.deepEqual(ud, chooseRpeInput({ a_1: input }, 'a_1', 8.5, input))
  assert.equal(stepRpeInInputs({ a_1: input }, 'a_1', input, 8, -0.5).a_1.rpe, '7.5')
})

test('første tryk tager udgangspunkt i planlagt RPE, ellers 8', () => {
  const tom = { weight: '', reps: '', note: '', rpe: '' }
  assert.equal(stepRpeInInputs({}, 'k', tom, 9, 0.5).k.rpe, '9.5')
  assert.equal(stepRpeInInputs({}, 'k', tom, null, 0.5).k.rpe, '8.5')
  assert.equal(stepRpeInInputs({}, 'k', tom, null, -0.5).k.rpe, '7.5')
  assert.equal(stepRpe('', 7.25, 0.5), 8)
})

test('grænserne 5,5 og 10 holder', () => {
  assert.equal(stepRpe(10, null, 0.5), 10)
  assert.equal(stepRpe('10', null, 0.5), 10)
  assert.equal(stepRpe(5.5, null, -0.5), 5.5)
  assert.equal(stepRpe('', 4, -0.5), 5.5)
  assert.equal(stepRpe('', 12, 0.5), 10)
  assert.deepEqual(RPE_VALUES, [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10])
  for (let v = 5.5; v <= 10; v += 0.5) {
    assert.ok(RPE_VALUES.includes(stepRpe(v, null, 0.5)))
    assert.ok(RPE_VALUES.includes(stepRpe(v, null, -0.5)))
  }
})

test('værdien ender som samme streng som valg i vælgeren, så logget rpe_actual er ens', () => {
  const input = { weight: '60', reps: '5', note: 'n', rpe: '' }
  for (const v of RPE_VALUES) {
    const fraVaelger = chooseRpeInput({ k: input }, 'k', v, input)
    const startFor = v === 10 ? 9.5 : v - 0.5
    const fraTrin = stepRpeInInputs({ k: input }, 'k', input, startFor, 0.5)
    if (v === 10 || v > 5.5) assert.deepEqual(fraTrin, fraVaelger, String(v))
  }
})

test('kortet: knapper med aria-label, 44 px flade, vælgeren åbner stadig, Program-fanen urørt', () => {
  assert.match(kilde, /aria-label="RPE 0,5 lavere" onClick=\{\(\) => stepRpeBy\(-0\.5\)\}/)
  assert.match(kilde, /aria-label="RPE 0,5 højere" onClick=\{\(\) => stepRpeBy\(0\.5\)\}/)
  assert.match(kilde, /onClick=\{\(\) => setRpeOpenFor\(rpeOpenFor === key \? null : key\)\}\n\s+style=\{st\.rpeTrinVaerdi\}/)
  assert.match(kilde, /Vælg RPE for sæt/)
  const st = logStil()
  for (const k of ['rpeTrinKnap', 'rpeTrinVaerdi']) assert.ok(parseFloat(st[k].minHeight) >= 44, k)
  assert.ok(parseFloat(st.rpeTrinKnap.minWidth) >= 44)
  assert.ok(parseFloat(st.rpeTrin.minHeight) >= 44)
  const program = readFileSync(new URL('./ProgramTab.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(program, /RPE 0,5 (lavere|højere)/)
})
