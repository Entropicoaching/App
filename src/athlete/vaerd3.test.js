import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './vaerd3Loader.mjs'
import { mount, nodes, text, button, io } from './vaerd3Dom.mjs'

install()
const { default: DinUgeKort } = await import('./DinUgeKort.jsx')
const { default: KostUge } = await import('./KostUge.jsx')
const { default: MeetDayPlanner } = await import('./MeetDayPlanner.jsx')
const { default: StaevnedagTab } = await import('./StaevnedagTab.jsx')

const uge = { ugeNr: 8, pasKlaret: 3, pasIalt: 3, tonnage: 1200, sprunget: 1, rekorder: [], vurderinger: [{ id: 'p1', titel: 'Pas A', rating: 4 }] }
const attempts = () => Object.fromEntries(['squat', 'bench', 'deadlift'].map(key => [key, [{ w: '100', r: 'good' }, { w: '105', r: 'fail' }, { w: '110', r: null }]]))
const input = () => ({
  asOfDate: '2026-10-22', coveredDates: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'],
  logs: [{ date: '2026-10-19', kcal: 100, protein: null }, { date: '2026-10-20', kcal: null, protein: 20 }, { date: '2026-10-21', kcal: null, protein: 30 }],
  targetHistory: [{ effectiveFrom: '2026-10-19', kcal: 2000, protein: 100 }],
})
const byType = (tree, type) => nodes(tree, n => n.type === type)

test('F2 Din uge: konkret, frivilligt felt med samme maksimum og faktisk sendehandler', async () => {
  const stored = new Map(), sent = []
  const previous = globalThis.localStorage
  globalThis.localStorage = { getItem: key => stored.get(key), setItem: (key, val) => stored.set(key, val) }
  try {
    let ok = false
    const app = mount(DinUgeKort, { uge, athleteId: 'synthetic-a', weekId: 'synthetic-w', sendUgeLinje: async (...args) => { sent.push(args); return ok } })
    let tree = app.render()
    const field = byType(tree, 'input')[0]
    assert.equal(field.props.placeholder, 'Hvad skal din coach vide før næste uge?')
    assert.equal(field.props.maxLength, 500)
    assert.equal(field.props.required, undefined)
    assert.equal(button(tree, 'Send').props.disabled, true)
    await button(tree, 'Send').props.onClick()
    assert.equal(sent.length, 0)
    field.props.onChange({ target: { value: 'Squat var tung i sæt 3' } })
    tree = app.render()
    assert.equal(button(tree, 'Send').props.disabled, false)
    await button(tree, 'Send').props.onClick()
    tree = app.render()
    assert.equal(byType(tree, 'input')[0].props.value, 'Squat var tung i sæt 3')
    assert.equal(stored.size, 0)
    ok = true
    await byType(tree, 'input')[0].props.onKeyDown({ key: 'Enter' })
    // Existing key handler calls async send without returning its Promise.
    await Promise.resolve()
    tree = app.render()
    assert.equal(byType(tree, 'input').length, 0)
    assert.match(text(tree), /Sendt til din coach/)
    assert.deepEqual(sent, [[8, 'Squat var tung i sæt 3'], [8, 'Squat var tung i sæt 3']])
    assert.equal(stored.get('entropi_din_uge_sendt:synthetic-a:synthetic-w'), '1')
    assert.match(text(tree), /1200|1.200/)
    assert.match(text(tree), /4\/5/)
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous }
})

test('F4 Kostuge: resumé skelner sammenlignelige kalorier og protein, tabel og ukendt bevares', () => {
  const props = { selectedDate: '2026-10-21', input: input() }
  const before = structuredClone(props)
  const tree = mount(KostUge, props).render()
  const paragraphs = byType(tree, 'p').map(text)
  assert.equal(paragraphs[0], 'Dage logget: 3 · Dage med sammenlignelige kalorimål: 1 · Dage med sammenlignelige proteinmål: 2')
  assert.match(paragraphs[1], /1 dage uden logning.*3 kommende dage/)
  assert.match(text(tree), /Dage uden logning tælles ikke som nul/)
  assert.equal(byType(tree, 'tbody')[0].props.children.length, 7)
  assert.match(text(tree), /Sammenlignelige dage: 1/)
  assert.match(text(tree), /Sammenlignelige dage: 2/)
  assert.match(text(tree), /Ingen logning/)
  assert.match(text(tree), /Kommende dag/)
  assert.deepEqual(props, before)
})

test('F6 Stævnetjekliste: brug i denne visning validerer, bruger rettelser og glemmer ved genåbning', () => {
  const props = { meetAttempts: attempts(), meetType: 'bench' }
  const before = structuredClone(props)
  const app = mount(MeetDayPlanner, props)
  let tree = app.render()
  assert.match(text(tree), /Ændringer af tider, opvarmningssæt og tjek gemmes ikke efter genåbning/)
  const initialRows = byType(tree, 'li').map(text)
  byType(tree, 'input').find(n => n.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  byType(tree, 'input').find(n => n.props.type === 'time').props.onChange({ target: { value: '12:00' } })
  button(tree, 'Rediger med coach').props.onClick()
  tree = app.render()
  const weight = byType(tree, 'input').find(n => n.props.type === 'number')
  weight.props.onChange({ target: { value: '9999' } })
  tree = app.render()
  button(tree, 'Brug i denne visning').props.onClick()
  tree = app.render()
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 1)
  byType(tree, 'input').find(n => n.props.type === 'number').props.onChange({ target: { value: '25' } })
  tree = app.render()
  button(tree, 'Brug i denne visning').props.onClick()
  tree = app.render()
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 0)
  assert.match(text(byType(tree, 'li')[0]), /^25 kg/)
  assert.match(text(byType(tree, 'li')[0]), /11:35/)
  assert.equal(byType(tree, 'input').find(n => n.props.type === 'checkbox').props.checked, true)
  assert.equal(byType(tree, 'input').find(n => n.props.type === 'time').props.value, '12:00')
  tree = mount(MeetDayPlanner, props).render()
  assert.deepEqual(byType(tree, 'li').map(text), initialRows)
  assert.equal(byType(tree, 'input').find(n => n.props.type === 'checkbox').props.checked, false)
  assert.equal(byType(tree, 'input').find(n => n.props.type === 'time').props.value, '')
  assert.deepEqual(props, before)
})

test('F6 Nulstil: afvisning bevarer forsøg; accept rydder kun forsøgsfelter uden backend', () => {
  let state = attempts(), writes = 0, answer = false
  const prompts = [], history = [{ id: 'history-a', meet_date: '2026-01-01', meet_name: 'Syntetisk stævne', squat: 90, bench: 60, deadlift: 100, total: 250 }]
  const historyBefore = structuredClone(history), stateBefore = structuredClone(state)
  const previous = globalThis.window
  globalThis.window = { confirm: message => { prompts.push(message); return answer } }
  try {
    const props = { athlete: { id: 'a', name: 'Syntetisk Atlet' }, coachAthleteId: null, hasMeetPlan: true, meetAttempts: state, meetPlanNotes: 'Syntetisk coachnote', meetResults: history, meetType: 'sbd',
      setMeetAttempts: next => { writes++; state = typeof next === 'function' ? next(state) : next },
      setAthlete: () => assert.fail('Reset must not change athlete'), setMeetType: () => assert.fail('Reset must not change meet type'), showFlash: () => assert.fail('Reset must not invoke save') }
    const app = mount(StaevnedagTab, props)
    let tree = app.render()
    assert.match(text(tree), /300 kg/)
    button(tree, 'Nulstil').props.onClick()
    assert.equal(writes, 0)
    assert.deepEqual(state, stateBefore)
    assert.match(prompts[0], /forsøgsfelterne.*squat.*bænkpres.*dødløft/)
    assert.match(prompts[0], /Vægte og forsøgsresultater ryddes.*Tidligere stævner bevares/)
    answer = true
    button(tree, 'Nulstil').props.onClick()
    assert.equal(writes, 1)
    assert.equal(prompts.length, 2)
    for (const key of ['squat', 'bench', 'deadlift']) assert.deepEqual(state[key], [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }])
    tree = app.render({ ...props, meetAttempts: state })
    assert.equal(nodes(tree, n => n.type === 'button' && text(n).trim() === 'Nulstil').length, 0)
    assert.match(text(tree), /Syntetisk stævne/)
    assert.match(text(tree), /Syntetisk coachnote/)
    assert.deepEqual(history, historyBefore)
    assert.deepEqual(props.meetAttempts, stateBefore)
    assert.equal(io.rpc, 0)
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
})
