import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { appendCoachNote, coachNoteRows, createCoachNoteSaver } from './coachNotes.mjs'
import { load, mount, nodes, text, client, calls, results, sourcePath } from './coachNotesHarness.mjs'
const { default: Page } = await load('CoachNotesPage.mjs')
const { default: Tab } = await load('NoterTab.jsx')
const date = new Date('2026-10-28T12:00:00.000Z')
const find = (tree, type) => nodes(tree, n => n.type === type)[0]
const event = { preventDefault() {} }

test('counter: exact pinned baselines and unchanged Mere/profile modules', () => {
  for (const [name, sha] of Object.entries({
    'coachNotesDashboardBase.txt': 'a92f2ae91402ac8a36cfeb9faa785cd40b5078c98e6ff07867fb54385fda0974',
    'coachNotesTabBase.txt': '2ed0318b70936b77730e331fb960c62f66379c69f0e412f79fcebd910a13a983',
    'ProfilHoved.jsx': '500fd858e18dd024b2cae09060e5a81aaaf3b38c682841a4e7aaf6bd9b28c378',
    'hubSektioner.jsx': '38e1961e332551e8f81963e3c3593a2c4596ec8ce35beae8745c6b3accbba6b8',
  })) assert.equal(createHash('sha256').update(readFileSync(sourcePath(name), 'utf8').replace(/\r\n/g, '\n')).digest('hex'), sha, name)
})

test('counter: failed write keeps all input, false result cannot announce success, retry succeeds', async () => {
  let result = false
  const props = { athlete: { id: 'a' }, onAddNote: async () => result }
  const view = mount(Page, props)
  find(view.render(), 'textarea').props.onChange({ target: { value: 'Syntetisk kladde' } })
  await find(view.render(), 'form').props.onSubmit(event)
  assert.equal(find(view.render(), 'textarea').props.value, 'Syntetisk kladde')
  assert.doesNotMatch(text(view.render()), /Noten er gemt/)
  result = true
  await find(view.render(), 'form').props.onSubmit(event)
  assert.equal(find(view.render(), 'textarea').props.value, '')
})

test('counter: profile key resets draft and search, late completion never fills another athlete', async () => {
  let resolve
  const view = mount(Tab, { coachNotesEnabled: true, a: { id: 'a', notes: 'Kun A' }, onAddNote: () => new Promise(r => { resolve = r }) })
  find(view.render(), 'textarea').props.onChange({ target: { value: 'Kladde A' } })
  find(view.render(), 'input').props.onChange({ target: { value: 'Kun A' } })
  const pending = find(view.render(), 'form').props.onSubmit(event)
  let tree = view.render({ coachNotesEnabled: true, a: { id: 'b', notes: 'Kun B' }, onAddNote: async () => true })
  assert.equal(find(tree, 'textarea').props.value, '')
  assert.equal(find(tree, 'input').props.value, '')
  assert.match(text(tree), /Kun B/); assert.doesNotMatch(text(tree), /Kun A|Kladde A/)
  resolve(true); await pending
  tree = view.render()
  assert.doesNotMatch(text(tree), /Kun A|Noten er gemt/)
})

test('counter: two saves from same loaded state cannot overwrite each other', async () => {
  let stored = 'Eksisterende', written = 0
  const memory = { from(table) {
    assert.equal(table, 'athletes')
    let payload; const filters = []
    const request = {
      update(value) { payload = value; return request },
      eq(key, value) { filters.push([key, value]); return request },
      select() { return request },
      async single() {
        assert.deepEqual(filters.slice(0, 2), [['id', 'a'], ['coach_id', 'c']])
        if (filters.find(([k]) => k === 'notes')[1] !== stored) return { error: { code: 'conflict' } }
        stored = payload.notes; written++; return { data: { id: 'a', notes: stored } }
      },
    }
    return request
  } }
  const options = { enabled: true, athlete: { id: 'a', notes: stored }, coachId: 'c', client: memory, onSaved() {}, now: () => date }
  const first = createCoachNoteSaver(options), second = createCoachNoteSaver(options)
  assert.equal(await first('Første'), true)
  await assert.rejects(second('Anden'))
  assert.equal(written, 1)
  assert.match(stored, /Første/); assert.doesNotMatch(stored, /Anden/)
})

test('counter: double call before response and thrown transport are recoverable', async () => {
  calls.length = 0
  let resolve, count = 0
  const memory = { from() { count++; throw Error('synthetic transport') } }
  const options = { enabled: true, athlete: { id: 'a', notes: '' }, coachId: 'c', client: memory, onSaved() {}, now: () => date }
  const failed = createCoachNoteSaver(options)
  await assert.rejects(failed('Ny')); await assert.rejects(failed('Ny'))
  assert.equal(count, 2)
  results.push(new Promise(r => { resolve = r }))
  const save = createCoachNoteSaver({ ...options, client })
  const pending = save('Ny')
  assert.equal(await save('Duplikat'), false)
  assert.equal(calls.length, 1)
  resolve({ data: { id: 'a' } }); assert.equal(await pending, true)
})

test('counter: markup and very long tokens render only as text; raw old notes remain intact on append', () => {
  const old = '  Syntetisk gammel note\r\nmed mellemrum  '
  const body = '<img src=x onerror=alert(1)>\n' + 'x'.repeat(9000)
  const raw = appendCoachNote(old, body, date)
  assert.ok(raw.startsWith(old + '\n\n'))
  assert.equal(coachNoteRows(raw)[0].text, body)
  const tree = mount(Page, { athlete: { id: 'a', notes: raw } }).render()
  assert.equal(nodes(tree, n => n.type === 'img' || n.type === 'script' || n.props.dangerouslySetInnerHTML).length, 0)
  assert.ok(text(tree).includes(body))
})
