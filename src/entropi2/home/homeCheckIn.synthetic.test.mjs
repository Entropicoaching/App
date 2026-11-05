import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { createHost, descendants, memoryStorage, textContent } from '../checkin/syntheticReact.mjs'
import { draftKey, loadDraft } from '../checkin/weeklyDraft.mjs'
register('../checkin/syntheticReactLoader.mjs', import.meta.url)
register('./homeCheckInSyntheticLoader.mjs', import.meta.url)
const { default: HomeCheckIn } = await import('./HomeCheckIn.mjs')
const props = { enabled: true, athleteId: 'synthetic-a', now: new Date('2026-11-04T12:00:00Z') }
const find = (host, test) => descendants(host.tree).find(test)
const toggle = (host, open) => { host.tree.props.onToggle({ currentTarget: { open } }); host.render() }

test('actual copied components open, edit, close and retain a namespace-only local draft', () => {
  const storage = memoryStorage(), host = createHost(HomeCheckIn, { ...props, storage })
  assert.equal(find(host, n => n.type === 'summary').props['data-home-reminder'], '')
  assert.equal(textContent(find(host, n => n.type === 'summary')), 'Lyst til ugens check-in? Åbn check-in')
  assert.equal(descendants(host.tree).filter(n => n.type === 'summary').length, 1)
  assert.equal(descendants(host.tree).filter(n => /^h[1-6]$/.test(n.type)).length, 0)
  assert.equal(find(host, n => n.type === 'section').props['aria-label'], 'Ugentligt check-in')
  toggle(host, true)
  assert.equal(find(host, n => n.type === 'summary').props['data-home-reminder'], undefined)
  assert.equal(textContent(find(host, n => n.type === 'summary')), 'Ugentligt check-in')
  assert.equal((textContent(host.tree).match(/Ugentligt check-in/g) || []).length, 1)
  assert.equal(descendants(host.tree).filter(n => n.type === 'h2').length, 0)
  assert.equal(find(host, n => n.type === 'section').props['aria-label'], 'Ugentligt check-in')
  find(host, n => n.props.name === 'comment').props.onChange({ target: { value: 'Syntetisk uge' } });host.render()
  toggle(host, false)
  assert.equal(find(host, n => n.type === 'summary').props['data-home-reminder'], undefined)
  assert.equal(loadDraft(draftKey(props.athleteId, '2026-11-02'), storage).draft.comment, 'Syntetisk uge')
  assert.ok(storage.calls.every(([, key]) => key === draftKey(props.athleteId, '2026-11-02')))
  assert.equal(storage.data.get('unrelated-key'), 'preserved')
  host.render({ ...host.props, athleteId: 'synthetic-b' })
  assert.equal(find(host, n => n.props.name === 'comment').props.value, '')
  host.render({ ...host.props, now: new Date('2026-11-09T12:00:00Z') })
  assert.match(textContent(host.tree), /09.11.2026/)
  host.render({ ...host.props, enabled: false });assert.equal(host.tree, null)
})

test('storage failure stays honest and form retains unsaved text while open', () => {
  const storage = { getItem() { throw Error('synthetic') }, setItem() { throw Error('synthetic') } }
  const host = createHost(HomeCheckIn, { ...props, storage })
  assert.equal(find(host, n => n.type === 'summary').props['data-home-reminder'], undefined)
  assert.match(textContent(host.tree), /kunne ikke læses eller gemmes/)
  toggle(host, true)
  find(host, n => n.props.name === 'comment').props.onChange({ target: { value: 'Syntetisk tekst' } });host.render()
  toggle(host, false);toggle(host, true)
  assert.equal(find(host, n => n.props.name === 'comment').props.value, 'Syntetisk tekst')
  assert.match(textContent(host.tree), /kun her/)
  host.render({ ...host.props, storage: memoryStorage() })
  assert.equal(find(host, n => n.props.name === 'comment').props.value, '')
  host.render({ ...host.props, onHoliday: true });assert.equal(host.tree, null)
})
