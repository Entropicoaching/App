import test from 'node:test'
import assert from 'node:assert/strict'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'

const props = { enabled: true, today: '2026-11-08', athlete: { id: 'boundary-athlete', age: 33, bodyweight: 80, goal: 'cut' },
  session: { user: { id: 'boundary-coach' } }, client: { from() { throw Error('synthetic offline') } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const launchText = 'Åbn kostplan med Frida-fødevarer'

test('regression 10+1: real StrictMode keeps original disclosure closed, visible reference button and immediate legacy opening', async () => {
  let loads = 0
  const storage = memoryStorage()
  await mountFridaPortal(storage, { ...props, loadReferenceFoods: () => { loads++; throw Error('Legacy must not load reference') } }, async ui => {
    const d = ui.host.querySelector('details')
    assert.equal(d.querySelector('summary').textContent, 'Kostplan')
    assert.equal(Boolean(d.open), false)
    assert.equal(ui.host.querySelectorAll('form,input,select').length, 0)
    assert.equal(ui.host.querySelectorAll('details').some(n => Boolean(n.open)), false)
    const launch = ui.find('button', launchText)
    assert.ok(launch)
    assert.equal(launch.getAttribute('type'), 'button')
    assert.equal(launch.getAttribute('disabled'), null)
    assert.equal(launch.getAttribute('hidden'), null)
    const retained = ui.handler(launch, 'onClick')
    await ui.openRaw()
    assert.ok(field(ui, 'draft-name-0'))
    assert.equal(field(ui, 'draft-food-0-0').querySelectorAll('option').length, 201)
    await ui.invoke(field(ui, 'draft-name-0'), 'onChange', { currentTarget: { value: 'Original legacy typed name' } })
    await ui.invoke(field(ui, 'draft-grams-0-0'), 'onChange', { currentTarget: { value: '19,123456789' } })
    await ui.act(() => retained())
    assert.equal(field(ui, 'draft-name-0').value, 'Original legacy typed name')
    assert.equal(field(ui, 'draft-grams-0-0').value, '19,123456789')
    assert.equal(loads, 0)
    assert.equal(storage.calls.some(c => c[0] === 'set'), false)
  })
})

test('retired reference launch is inert after OFF, owner/date changes and actual unmount under StrictMode', async () => {
  for (const patch of [{ enabled: false }, { today: '2026-11-09' },
    { athlete: { ...props.athlete, id: 'boundary-new-athlete' } }, { session: { user: { id: 'boundary-new-coach' } } }]) {
    let loads = 0, retired
    const storage = memoryStorage()
    await mountFridaPortal(storage, { ...props, loadReferenceFoods: () => { loads++; throw Error('Retired launch') } }, async ui => {
      retired = ui.handler(ui.find('button', launchText), 'onClick')
      await ui.render({ ...props, ...patch })
      await ui.act(() => retired())
      assert.equal(loads, 0)
      assert.equal(Boolean(field(ui, 'draft-name-0')), false)
      if (patch.enabled !== false) assert.ok(ui.find('button', launchText))
    })
    retired()
    assert.equal(loads, 0)
    assert.equal(storage.calls.some(c => c[0] === 'set'), false)
  }
  let retired, loads = 0
  const storage = memoryStorage()
  await mountFridaPortal(storage, { ...props, loadReferenceFoods: () => { loads++; throw Error('Unmounted launch') } }, async ui => {
    retired = ui.handler(ui.find('button', launchText), 'onClick')
  })
  retired()
  await Promise.resolve()
  assert.equal(loads, 0)
  assert.equal(storage.calls.some(c => c[0] === 'set'), false)
})
