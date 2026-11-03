import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { resetFake } from '../appRev2Fakes.mjs'

// K-R3-ENTROPI-SAMLET fund 1: en afvist gemning må ikke lukke formularen stille.
registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) {
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavAtletHandlinger } = await import('./atletHandlinger.js')

function handlers() {
  const calls = { editing: [], flash: [], selected: [] }
  const h = lavAtletHandlinger({ editData: { kcal_target: '2500', protein_target: '160' }, selectedAthlete: { id: 'a' },
    setSaving() {}, setSelectedAthlete: v => calls.selected.push(v), setAthletes() {},
    setEditing: v => calls.editing.push(v), showFlash: (msg, kind) => calls.flash.push([msg, kind]) })
  return { h, calls }
}

test('afvist gemning (42501) returnerer false, bevarer formularen og viser en fejl', async () => {
  resetFake({ data: null, error: { code: '42501', message: 'synthetic' } })
  const { h, calls } = handlers()
  assert.equal(await h.saveEdit(), false)
  assert.deepEqual(calls.editing, [])
  assert.equal(calls.selected.length, 0)
  assert.equal(calls.flash.length, 1)
  assert.equal(calls.flash[0][1], 'error')
})

test('vellykket gemning returnerer true og lukker formularen', async () => {
  resetFake({ data: { id: 'a', kcal_target: 2500 }, error: null })
  const { h, calls } = handlers()
  assert.equal(await h.saveEdit(), true)
  assert.deepEqual(calls.editing, [null])
  assert.equal(calls.flash.length, 0)
})

test('ugyldige tal afvises foer skrivning med false', async () => {
  resetFake()
  const h = lavAtletHandlinger({ editData: { kcal_target: 'abc' }, selectedAthlete: { id: 'a' },
    setSaving() {}, setSelectedAthlete() {}, setAthletes() {}, setEditing() {}, showFlash() {} })
  assert.equal(await h.saveEdit(), false)
})

// K-R4-ENTROPI-SAMLET fund 1: en kastet fejl (fx netfejl) maa ikke laase gemningen.
test('kastet gemmefejl returnerer false, slipper ventetilstanden og viser en fejl', async () => {
  resetFake({ then(_resolve, reject) { reject(new Error('synthetic network')) } })
  const saving = [], calls = { editing: [], flash: [] }
  const h = lavAtletHandlinger({ editData: { kcal_target: '2500', protein_target: '160' }, selectedAthlete: { id: 'a' },
    setSaving: v => saving.push(v), setSelectedAthlete() {}, setAthletes() {},
    setEditing: v => calls.editing.push(v), showFlash: (msg, kind) => calls.flash.push([msg, kind]) })
  assert.equal(await h.saveEdit(), false)
  assert.equal(saving.at(-1), false)
  assert.deepEqual(calls.editing, [])
  assert.equal(calls.flash.length, 1)
  assert.equal(calls.flash[0][1], 'error')
})
