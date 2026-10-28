import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install } from './nytTestLoader.mjs'
import { mount, button, text } from './nytTestDom.mjs'
install()
const { default: NytIAppen } = await import('./nytIAppen.mjs')
const { nytIAppenText: copy } = await import('./nytIAppenText.mjs')
const { DEFAULT_REL1030, rel1030Enabled } = await import('./rel1030.mjs')

test('fresh final gate uses the byte-identical pinned default OFF release module', () => {
  const bytes = readFileSync(new URL('./rel1030.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '84efbc0c720e87883bd5f8d538eda0d6bc3c1574297bed451648d550c5d625c5')
  assert.equal(DEFAULT_REL1030, false)
  assert.equal(rel1030Enabled(''), false)
})

test('OFF/ON toggle and same-instance identity changes preserve only the correct dismissal', () => {
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) }
  const a = { search: '?rel1030=1', role: 'athlete', profileId: 'A', storage, onNavigate() {} }
  const ui = mount(NytIAppen, a)
  button(ui.render(), copy.close).onClick()
  assert.equal(ui.render({ ...a, search: '' }), null)
  assert.equal(ui.render(a), null)
  assert.match(text(ui.render({ ...a, profileId: 'B' })), /Nyt i appen/)
  assert.match(text(ui.render({ ...a, role: 'coach' })), /Nyt i appen/)
  assert.equal(data.size, 1)
  assert.equal(ui.render(a), null)
})

test('link clicks never save dismissal and do not suppress a later first view', () => {
  let writes = 0
  const a = { search: '?rel1030=1', role: 'athlete', profileId: 'A', storage: {
    getItem: () => null, setItem() { writes++ },
  }, onNavigate() {} }
  const ui = mount(NytIAppen, a)
  for (const item of copy.items.filter(i => i.roles.includes('athlete'))) button(ui.render(), item.label).onClick()
  assert.equal(writes, 0)
  assert.match(text(mount(NytIAppen, a).render()), /Nyt i appen/)
})
