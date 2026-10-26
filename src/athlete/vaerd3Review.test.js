// Fresh counterexamples against the final imported component modules.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vaerd3Loader.mjs'
import { mount, nodes, text, button, io } from './vaerd3Dom.mjs'
import { jsx } from './vaerd3Jsx.mjs'

install()
const { default: DinUgeKort } = await import('./DinUgeKort.jsx')
const { default: KostUge } = await import('./KostUge.jsx')
const { default: MeetDayPlanner } = await import('./MeetDayPlanner.jsx')
const { default: StaevnedagTab } = await import('./StaevnedagTab.jsx')
const uge = { ugeNr: null, pasKlaret: 1, pasIalt: 1, tonnage: 0, rekorder: null, vurderinger: [] }
const byType = (tree, type) => nodes(tree, n => n.type === type)
const attempts = { squat: [{ w: '150', r: 'good' }, { w: '', r: null }, { w: '', r: null }], bench: [{ w: '80', r: 'good' }, { w: '', r: null }, { w: '', r: null }], deadlift: [{ w: '180', r: 'fail' }, { w: '', r: null }, { w: '', r: null }] }

test('Modprøve: uge uden data eller sendevej, blank tekst og utilgængelig storage', async () => {
  assert.equal(mount(DinUgeKort, { uge: null }).render(), null)
  assert.equal(byType(mount(DinUgeKort, { uge }).render(), 'input').length, 0)
  let sends = 0
  const old = globalThis.localStorage
  globalThis.localStorage = { getItem() { throw Error('synthetic blocked storage') } }
  try {
    const app = mount(DinUgeKort, { uge, athleteId: 'b', weekId: 'c', sendUgeLinje: async () => { sends++; return true } })
    let tree = app.render()
    byType(tree, 'input')[0].props.onChange({ target: { value: '   ' } })
    tree = app.render()
    await button(tree, 'Send').props.onClick()
    byType(tree, 'input')[0].props.onKeyDown({ key: 'Enter' })
    assert.equal(sends, 0)
    assert.equal(button(tree, 'Send').props.disabled, true)
  } finally { if (old === undefined) delete globalThis.localStorage; else globalThis.localStorage = old }
})

test('Modprøve: loggede kostdage uden snapshots bliver ikke sammenlignelige', () => {
  const data = { asOfDate: '2026-10-25', coveredDates: ['2026-10-19'], logs: [{ date: '2026-10-19', kcal: 0, protein: 0 }], targetHistory: [] }
  const tree = mount(KostUge, { selectedDate: '2026-10-19', input: data }).render()
  assert.equal(text(byType(tree, 'p')[0]), 'Dage logget: 1 · Dage med sammenlignelige kalorimål: 0 · Dage med sammenlignelige proteinmål: 0')
  assert.match(text(tree), /6 dage uden datadækning/)
  assert.equal(byType(tree, 'tbody')[0].props.children.length, 7)
  assert.match(text(tree), /Data ikke tilgængelige/)
  assert.match(text(tree), /0 \/ —/)
})

test('Modprøve: manglende og ugyldige kostdata beholder deres fejltilstand', () => {
  assert.match(text(mount(KostUge, { selectedDate: '2026-10-19' }).render()), /Ugedata er ikke tilgængelige/)
  const tree = mount(KostUge, { selectedDate: 'invalid', input: {} }).render()
  assert.match(text(tree), /Ugedata kunne ikke vises/)
  assert.equal(byType(tree, 'table').length, 0)
  assert.doesNotMatch(text(tree), /Dage logget:/)
})

test('Modprøve: annuller og gendan opvarmning bevarer eksisterende handleradfærd', () => {
  const app = mount(MeetDayPlanner, { meetAttempts: attempts, meetType: 'bench' })
  let tree = app.render()
  const initial = byType(tree, 'li').map(text)
  button(tree, 'Rediger med coach').props.onClick()
  tree = app.render()
  byType(tree, 'input').find(n => n.props.type === 'number').props.onChange({ target: { value: '30' } })
  button(tree, 'Annuller').props.onClick()
  tree = app.render()
  assert.deepEqual(byType(tree, 'li').map(text), initial)
  button(tree, 'Rediger med coach').props.onClick()
  tree = app.render()
  byType(tree, 'input').find(n => n.props.type === 'number').props.onChange({ target: { value: '30' } })
  tree = app.render()
  button(tree, 'Brug i denne visning').props.onClick()
  tree = app.render()
  assert.match(text(byType(tree, 'li')[0]), /^30 kg/)
  button(tree, 'Gendan forslag').props.onClick()
  assert.deepEqual(byType(app.render(), 'li').map(text), initial)
  assert.equal(byType(mount(MeetDayPlanner, { meetAttempts: {}, meetType: 'bench' }).render(), 'li').length, 0)
})

test('Modprøve: nulstilling i bænkvisning beholder eksisterende omfang for alle forsøgsfelter', () => {
  let state = structuredClone(attempts), prompted = 0
  const previous = globalThis.window
  globalThis.window = { confirm(message) { prompted++; assert.match(message, /squat, bænkpres og dødløft/); return true } }
  try {
    const props = { athlete: { id: 'fake' }, hasMeetPlan: true, meetAttempts: state, meetResults: [], meetType: 'bench', setMeetAttempts: next => { state = next } }
    const tree = mount(StaevnedagTab, props).render()
    assert.match(text(tree), /80 kg/)
    button(tree, 'Nulstil').props.onClick()
    assert.equal(prompted, 1)
    assert.deepEqual(Object.keys(state), ['squat', 'bench', 'deadlift'])
    for (const rows of Object.values(state)) assert.ok(rows.every(row => row.w === '' && row.r === null))
    assert.equal(io.rpc, 0)
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
})

test('Modprøve: uden stævneplan eller positiv total vises ingen nulstilling og intet bekræftelseskald', () => {
  const props = { athlete: {}, hasMeetPlan: false, meetAttempts: attempts, meetResults: [], meetType: 'sbd' }
  assert.equal(nodes(mount(StaevnedagTab, props).render(), n => n.type === 'button' && text(n).trim() === 'Nulstil').length, 0)
  const noGood = Object.fromEntries(Object.entries(attempts).map(([key, rows]) => [key, rows.map(row => ({ ...row, r: 'fail' }))]))
  assert.equal(nodes(mount(StaevnedagTab, { ...props, hasMeetPlan: true, meetAttempts: noGood }).render(), n => n.type === 'button' && text(n).trim() === 'Nulstil').length, 0)
})

test('Modprøve: JSX-adapter bevarer betingelser, handler, attributter og CRLF', () => {
  const code = 'flag => <section data-scope="x">\r\n  {flag && <button onClick={() => ({ n: 2 })}>Brug &amp; behold</button>}\r\n</section>'
  const h = (type, props, unused, ...children) => ({ type, props, children })
  const component = Function('__h', 'return (' + jsx(code) + ')')(h)
  assert.equal(component(false).children[0], false)
  const child = component(true).children[0]
  assert.equal(child.children[0], 'Brug & behold')
  assert.deepEqual(child.props.onClick(), { n: 2 })
  assert.equal(component(true).props['data-scope'], 'x')
})
