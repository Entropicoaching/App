import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { coachNotesFlag, COACH_NOTES_ENABLED, appendCoachNote, coachNoteRows, createCoachNoteSaver } from './coachNotes.mjs'
import { load, mount, nodes, text, button, client, calls, results, sourcePath } from './coachNotesHarness.mjs'
const { default: Tab } = await load('NoterTab.jsx')
const { default: BaseTab } = await load('coachNotesTabBase.txt')
const { default: Dashboard } = await load('Dashboard.jsx')
const { default: BaseDashboard } = await load('coachNotesDashboardBase.txt')
const { default: Page } = await load('CoachNotesPage.mjs')
const date = new Date('2026-10-28T10:00:00.000Z')
const event = { preventDefault() {} }
const find = (tree, type) => nodes(tree, n => n.type === type)[0]
const normalized = tree => JSON.parse(JSON.stringify(tree, (k, v) => typeof v === 'function' ? 'handler' : typeof v === 'symbol' ? 'fragment' : v))

test('default OFF and only exact query opt-in', () => {
  assert.equal(COACH_NOTES_ENABLED, false)
  for (const search of ['', '?coachNotes=0', '?coachNotes=true', '?coachNotes=01', '?other=1']) assert.equal(coachNotesFlag(search), false)
  assert.equal(coachNotesFlag('?coachNotes=1'), true)
})

test('date order, case insensitive search, empty and legacy notes with no invented date', () => {
  const raw = appendCoachNote(appendCoachNote('Tidligere fokus', 'Ældre squat', date), 'Ny BÆNK', new Date('2026-10-29T09:00:00.000Z'))
  assert.deepEqual(coachNoteRows(raw).map(r => r.text), ['Ny BÆNK', 'Ældre squat', 'Tidligere fokus'])
  assert.equal(coachNoteRows(raw).at(-1).date, null)
  assert.deepEqual(coachNoteRows(raw, '  bænk ').map(r => r.text), ['Ny BÆNK'])
  assert.equal(coachNoteRows(raw, '2026-10-29').length, 1)
  assert.equal(coachNoteRows(raw, 'umuligt').length, 0)
  for (const value of ['', null, undefined, '  \r\n ']) assert.deepEqual(coachNoteRows(value), [])
})

test('multiline, LF/CRLF, embedded headers and markup stay literal note content', () => {
  const body = '<script>synthetic</script>\n[Coach-note 2027-01-01T00:00:00.000Z]\n  Indrykket\n\nSlut'
  const raw = appendCoachNote('Gammel\r\ntekst', body, date)
  assert.equal(coachNoteRows(raw)[0].text, body)
  assert.deepEqual(coachNoteRows(raw), coachNoteRows(raw.replace(/\r?\n/g, '\r\n')))
  const malformed = '[Coach-note 2026-02-30T00:00:00.000Z]\n  Bevar mig'
  assert.equal(coachNoteRows(malformed)[0].date, null)
  assert.throws(() => appendCoachNote('', ' '))
  assert.throws(() => appendCoachNote('', 'x'.repeat(10001)))
})

test('NoterTab OFF matches pinned baseline including existing editor handlers', () => {
  const startEdit = (...args) => received.push(args), received = []
  const props = { a: { id: 'a', notes: 'Syntetisk gammel note' }, editData: { notes: 'Udkast' }, startEdit, saveEdit() {}, setEditing() {}, setEditData() {} }
  for (const editing of [null, 'notes']) {
    const off = mount(Tab, { ...props, editing }).render()
    assert.deepEqual(normalized(off), normalized(mount(BaseTab, { ...props, editing }).render()))
    assert.deepEqual(normalized(mount(Tab, { ...props, editing, coachNotesEnabled: 'true' }).render()), normalized(off))
    button(off, 'Rediger').props.onClick()
  }
  assert.deepEqual(received, [['notes', { notes: props.a.notes }], ['notes', { notes: props.a.notes }]])
})

test('page search and empty states operate through actual input handlers', () => {
  const view = mount(Tab, { coachNotesEnabled: true, a: { id: 'a', notes: appendCoachNote('Gammel', 'Squat', date) } })
  let tree = view.render()
  assert.match(text(tree), /Coachens noter/)
  find(tree, 'input').props.onChange({ target: { value: 'squat' } })
  tree = view.render(); assert.equal(nodes(tree, n => n.type === 'li').length, 1)
  find(tree, 'input').props.onChange({ target: { value: 'intet' } })
  assert.match(text(view.render()), /Ingen noter matcher/)
  assert.equal(button(view.render(), 'Nulstil søgning').props.type, 'button')
  button(view.render(), 'Nulstil søgning').props.onClick()
  tree = view.render()
  assert.equal(find(tree, 'input').props.value, '')
  assert.equal(nodes(tree, n => n.type === 'li').length, 2)
  assert.equal(nodes(tree, n => n.type === 'time').length, 1)
  assert.doesNotMatch(text(tree), /Dato ukendt|Tidligere noter uden dato/)
  assert.match(text(tree), /Gammel/)
  assert.match(text(mount(Page, { athlete: { id: 'b', notes: '' } }).render()), /Ingen noter endnu/)
})

test('submit persists, blocks duplicate submit, clears only on success and retains failure draft', async () => {
  let resolve, count = 0
  const view = mount(Page, { athlete: { id: 'a', notes: '' }, onAddNote: () => { count++; return new Promise(r => { resolve = r }) } })
  let tree = view.render()
  find(tree, 'textarea').props.onChange({ target: { value: 'Syntetisk ny note' } })
  tree = view.render()
  const pending = find(tree, 'form').props.onSubmit(event)
  await find(tree, 'form').props.onSubmit(event)
  assert.equal(count, 1)
  assert.equal(find(view.render(), 'textarea').props.disabled, true)
  resolve(true); await pending
  assert.equal(find(view.render(), 'textarea').props.value, '')
  assert.match(text(view.render()), /Noten er gemt/)
  tree = view.render({ athlete: { id: 'a' }, onAddNote: async () => { throw Error('synthetic') } })
  find(tree, 'textarea').props.onChange({ target: { value: 'Bevar denne' } })
  await find(view.render(), 'form').props.onSubmit(event)
  assert.equal(find(view.render(), 'textarea').props.value, 'Bevar denne')
  assert.match(text(view.render()), /ikke gemt/)
})

test('saver uses only scoped notes update and rejects conflicts, empty results and disabled calls', async () => {
  calls.length = 0
  const saved = []
  const options = { enabled: true, athlete: { id: 'a', notes: 'Gammel' }, coachId: 'c', client, onSaved: row => saved.push(row), now: () => date }
  results.push({ data: { id: 'a', notes: 'Resultat' }, error: null })
  assert.equal(await createCoachNoteSaver(options)('Ny'), true)
  assert.deepEqual(calls[0], { table: 'athletes', steps: [
    ['update', { notes: appendCoachNote('Gammel', 'Ny', date) }], ['eq', 'id', 'a'], ['eq', 'coach_id', 'c'], ['eq', 'notes', 'Gammel'], ['select'], ['single'],
  ] })
  assert.equal(saved.length, 1)
  for (const result of [{ error: { code: 'conflict' } }, { data: null }, { data: { id: 'b' } }]) {
    results.push(result); await assert.rejects(createCoachNoteSaver(options)('Ny'))
  }
  results.push({ data: { id: 'a' } })
  await createCoachNoteSaver({ ...options, athlete: { id: 'a', notes: null } })('Ny')
  assert.ok(calls.at(-1).steps.some(s => s[0] === 'is' && s[1] === 'notes' && s[2] === null))
  const count = calls.length
  for (const enabled of [false, undefined, 'true', 1]) assert.equal(await createCoachNoteSaver({ ...options, enabled })('Ny'), false)
  assert.equal(calls.length, count)
})

function dashboardValues(baseName, activeTab = 'noter') {
  const source = readFileSync(sourcePath(baseName), 'utf8')
  const hooks = [...source.matchAll(/const (?:\[([^\]]+)\]|(\w+)) = use(?:State|Ref)\(/g)].map(m => (m[1] || m[2]).split(',')[0])
  const values = []
  for (const [key, value] of Object.entries({ view: 'profile', selectedAthlete: { id: 'a', name: 'Syntetisk A', status: 'active', notes: 'Gammel note' }, activeTab, navMenuOpen: true })) {
    const index = hooks.indexOf(key); assert.ok(index >= 0, key); values[index] = value
  }
  return values
}

test('actual Dashboard and Mere navigation retain baseline OFF and open the flagged notes page', async () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => null }
  globalThis.window = { location: { search: '' }, innerWidth: 1200 }
  const props = { session: { user: { id: 'c' } }, programCopyEnabled: false }
  try {
    const off = mount(Dashboard, props, dashboardValues('Dashboard.jsx')).render()
    const base = mount(BaseDashboard, props, dashboardValues('coachNotesDashboardBase.txt')).render()
    assert.deepEqual(normalized(off), normalized(base))
    globalThis.window.location.search = '?coachNotes=1'
    const view = mount(Dashboard, props, dashboardValues('Dashboard.jsx', 'log'))
    let tree = view.render()
    const noteButton = nodes(tree, n => n.type === 'button' && text(n).includes('Noter'))[0]
    assert.ok(noteButton); noteButton.props.onClick()
    tree = view.render(); assert.match(text(tree), /Coachens noter/)
    find(tree, 'textarea').props.onChange({ target: { value: 'Ny fra profil' } })
    results.push({ data: { id: 'a', name: 'Syntetisk A', status: 'active', notes: appendCoachNote('Gammel note', 'Ny fra profil', date) } })
    await find(view.render(), 'form').props.onSubmit(event)
    tree = view.render(); assert.match(text(tree), /Ny fra profil/)
    assert.equal(calls.at(-1).table, 'athletes')
  } finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow
    if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage
  }
})
