import test from 'node:test'
import assert from 'node:assert/strict'
import { bindInstantSend } from './vcInstantSend.mjs'

function fixture(overrides = {}) {
  const f = { saveButton: { disabled: false }, discardButton: { disabled: false },
    calls: [], ready: true, current: 'done' }
  f.options = {
    saveButton: f.saveButton, discardButton: f.discardButton,
    bridgeReady: () => f.ready,
    upload: async () => { f.calls.push('upload'); f.current = 'sent' },
    state: () => f.current, alert: message => f.calls.push(message), ...overrides,
  }
  bindInstantSend(f.options)
  return f
}

test('F1 A1: runtime binder knappen og sender først ved et faktisk klik', async () => {
  const f = fixture()
  assert.equal(f.saveButton.textContent, 'Send video til coach')
  assert.deepEqual(f.calls, [])
  assert.equal(typeof f.saveButton.onclick, 'function')
  await f.saveButton.onclick()
  assert.deepEqual(f.calls, ['upload'])
  assert.equal(f.saveButton.disabled, true)
  assert.equal(f.discardButton.disabled, true)
})

test('F1 A1: broens aktuelle parathed læses ved klik', async () => {
  const f = fixture()
  f.ready = false
  await f.saveButton.onclick()
  assert.deepEqual(f.calls, ['Forbindelsen til appen er ikke klar. Luk VideoCoach og åbn den fra appen igen.'])
  assert.equal(f.saveButton.disabled, false)
  assert.equal(f.discardButton.disabled, false)
  f.ready = true
  await f.saveButton.onclick()
  assert.equal(f.calls.at(-1), 'upload')
})

test('F1 A1: begge knapper låses under upload og åbnes ved fanget fejl', async () => {
  let complete
  const pending = new Promise(resolve => { complete = resolve })
  const f = fixture({ upload: () => pending })
  const click = f.saveButton.onclick()
  assert.equal(f.saveButton.disabled, true)
  assert.equal(f.discardButton.disabled, true)
  complete()
  await click
  assert.equal(f.saveButton.disabled, false)
  assert.equal(f.discardButton.disabled, false)
})

test('F1 A1: ny montering giver igen sendetekst uden automatisk upload', () => {
  const f = fixture()
  f.saveButton.textContent = 'Sender video ...'
  bindInstantSend(f.options)
  assert.equal(f.saveButton.textContent, 'Send video til coach')
  assert.deepEqual(f.calls, [])
})

test('F1 OFF: en side uden atletknapper monterer ingen sendehandling', () => {
  let touched = false
  bindInstantSend({ saveButton: null, discardButton: null,
    bridgeReady: () => { touched = true }, upload: () => { touched = true } })
  assert.equal(touched, false)
})
