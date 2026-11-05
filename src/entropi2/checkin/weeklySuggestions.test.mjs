import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { draftKey, emptyDraft, loadDraft, saveDraft } from './weeklyDraft.mjs'
import { loadSuggestedDraft, previousDraftKey } from './weeklySuggestions.mjs'
import { createHost, descendants, memoryStorage, textContent } from './syntheticReact.mjs'

register('./syntheticReactLoader.mjs', import.meta.url)
const { default: WeeklyCheckIn } = await import('./WeeklyCheckIn.mjs')
const props = { enabled: true, athleteId: 'synthetic-suggestions', weekStart: '2026-11-02' }
const key = draftKey(props.athleteId, props.weekStart)
const previousKey = draftKey(props.athleteId, '2026-10-26')
const values = { sleep: '0', energy: '4', stress: '2', pain: '0', comment: 'Syntetisk <b>uge</b>' }
function setup() {
  const storage = memoryStorage()
  saveDraft(previousKey, values, storage)
  storage.calls.length = 0
  const host = createHost(WeeklyCheckIn, { ...props, storage })
  return { host, storage }
}
const field = (host, name) => descendants(host.tree).find(n => n.props.name === name)
const edit = (host, name, value) => { field(host, name).props.onChange({ target: { value } }); host.render() }
const confirm = host => {
  descendants(host.tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  host.render()
}

test('calendar boundary weeks use exactly seven days, including leap days and year changes', () => {
  for (const [current, previous] of [['2026-11-02', '2026-10-26'], ['2024-03-04', '2024-02-26'],
    ['2024-01-01', '2023-12-25']])
    assert.equal(previousDraftKey(props.athleteId, current), draftKey(props.athleteId, previous))
  for (const current of ['2026-11-03', '2026-02-30', '', null])
    assert.equal(previousDraftKey(props.athleteId, current), null)
})

test('actual form shows every prior answer, including zeros, as an unsaved suggestion without writing', () => {
  const { host, storage } = setup()
  for (const [name, value] of Object.entries(values)) {
    assert.equal(field(host, name).props.value, value)
    const hint = descendants(host.tree).find(n => n.props.id === field(host, name).props['aria-describedby'])
    assert.match(textContent(hint), /Forslag fra sidste uges lokale kladde · ikke gemt/)
  }
  assert.equal(descendants(host.tree).filter(n => n.type === 'button' && textContent(n) === 'Samme som sidst').length, 5)
  assert.equal(descendants(host.tree).find(n => n.props.type === 'submit').children[0], 'Bekræft forslag og gem kladde')
  assert.deepEqual(storage.calls, [['get', key], ['get', previousKey]])
  assert.equal(storage.data.has(key), false)
  assert.equal(field(host, 'comment').props.dangerouslySetInnerHTML, undefined)
})

test('one explicit confirmation saves the unchanged proposals only to the current namespace', () => {
  const { host, storage } = setup()
  const original = storage.data.get(previousKey)
  confirm(host)
  assert.deepEqual(storage.calls.filter(([op]) => op !== 'get'), [['set', key]])
  assert.deepEqual(loadDraft(key, storage).draft, values)
  assert.equal(storage.data.get(previousKey), original)
  assert.equal(storage.data.get('unrelated-key'), 'preserved')
  assert.match(textContent(host.tree), /Kladde gemt.*Intet er sendt til din coach/)
  assert.doesNotMatch(textContent(host.tree), /Forslag fra sidste uges/)
})

test('each same-as-last button restores only its own field, without implicit confirmation or writes', () => {
  const { host, storage } = setup()
  edit(host, 'comment', 'Syntetisk ny kommentar')
  for (const [name, value] of Object.entries(values)) {
    edit(host, name, '')
    const reuse = descendants(host.tree).find(n => n.props['aria-label']?.startsWith('Samme som sidst:') &&
      n.props['aria-label'].includes({ sleep: 'Søvn', energy: 'Energi', stress: 'Stress', pain: 'Smerte', comment: 'Kommentar' }[name]))
    assert.ok(reuse.props.style.minHeight >= 48)
    reuse.props.onClick(); host.render()
    assert.equal(field(host, name).props.value, value)
    if (name !== 'comment') assert.equal(field(host, 'comment').props.value, 'Syntetisk ny kommentar')
  }
  assert.ok(storage.calls.every(([op]) => op === 'get'))
  confirm(host)
  assert.deepEqual(loadDraft(key, storage).draft, values)
})

test('missing, corrupt, future-version and older history never produces guessed answers', () => {
  for (const raw of [null, '{', JSON.stringify({ version: 2, draft: values }),
    JSON.stringify({ version: 1, draft: { ...values, pain: '11' } })]) {
    const storage = memoryStorage()
    saveDraft(draftKey(props.athleteId, '2026-10-19'), values, storage)
    saveDraft(draftKey('synthetic-other', '2026-10-26'), values, storage)
    if (raw !== null) storage.data.set(previousKey, raw)
    storage.calls.length = 0
    const host = createHost(WeeklyCheckIn, { ...props, storage })
    for (const name of Object.keys(values)) assert.equal(field(host, name).props.value, '')
    assert.doesNotMatch(textContent(host.tree), /Samme som sidst|Forslag fra sidste/)
    assert.deepEqual(storage.calls, [['get', key], ['get', previousKey]])
  }
})

test('current saved answers and intentionally blank fields win over previous answers', () => {
  const { storage } = setup()
  const current = { ...emptyDraft(), comment: 'Syntetisk denne uge' }
  saveDraft(key, current, storage)
  storage.calls.length = 0
  const host = createHost(WeeklyCheckIn, { ...props, storage })
  for (const [name, value] of Object.entries(current)) assert.equal(field(host, name).props.value, value)
  assert.doesNotMatch(textContent(host.tree), /Forslag fra sidste/)
  assert.ok(storage.calls.every(([op]) => op === 'get'))
})

test('corrupt current drafts are preserved without falling back to historical answers', () => {
  const { storage } = setup()
  storage.data.set(key, '{')
  storage.calls.length = 0
  const loaded = loadSuggestedDraft(props.athleteId, props.weekStart, storage)
  assert.equal(loaded.status, 'unavailable')
  assert.deepEqual(loaded.draft, emptyDraft())
  assert.deepEqual(storage.calls, [['get', key]])
  assert.equal(storage.data.get(key), '{')
})

test('failed confirmation keeps suggestions and edits for an explicit retry', () => {
  const { host, storage } = setup()
  const write = storage.setItem
  storage.setItem = () => { throw Error('synthetic quota') }
  edit(host, 'comment', 'Syntetisk rettelse')
  confirm(host)
  assert.equal(storage.data.has(key), false)
  assert.match(textContent(host.tree), /kunne ikke læses eller gemmes/)
  assert.equal(field(host, 'comment').props.value, 'Syntetisk rettelse')
  assert.equal(field(host, 'sleep').props.value, '0')
  storage.setItem = write
  confirm(host)
  assert.equal(loadDraft(key, storage).draft.comment, 'Syntetisk rettelse')
})

test('partial edits name the visible confirmation button in both status and instructions', () => {
  const { host, storage } = setup()
  edit(host, 'comment', 'Syntetisk rettelse')
  const action = textContent(descendants(host.tree).find(n => n.props.type === 'submit'))
  assert.equal(action, 'Bekræft forslag og gem kladde')
  const status = descendants(host.tree).find(n => n.props.role === 'status')
  assert.match(textContent(status), /ikke gemt/)
  assert.ok(textContent(status).includes(`Tryk ${action} for at bekræfte dem.`))
  assert.ok(textContent(host.tree).includes(`når du trykker ${action}.`))
  assert.ok(storage.calls.every(([operation]) => operation === 'get'))
})

test('retry names the visible action with remaining suggestions and after all fields are edited', () => {
  for (const editAll of [false, true]) {
    const { host, storage } = setup()
    for (const name of editAll ? Object.keys(values) : ['comment']) edit(host, name, '')
    const action = textContent(descendants(host.tree).find(n => n.props.type === 'submit'))
    assert.equal(action, editAll ? 'Gem kladde' : 'Bekræft forslag og gem kladde')
    assert.ok(textContent(descendants(host.tree).find(n => n.props.role === 'status'))
      .includes(`Tryk ${action} for at bekræfte dem.`))
    const write = storage.setItem
    storage.setItem = () => { throw Error('synthetic quota') }
    confirm(host)
    const status = textContent(descendants(host.tree).find(n => n.props.role === 'status'))
    assert.ok(status.includes(`Prøv ${action} igen.`))
    assert.equal(storage.data.has(key), false)
    storage.setItem = write
    confirm(host)
    assert.equal(textContent(descendants(host.tree).find(n => n.props.type === 'submit')), 'Gem kladde')
    assert.match(textContent(host.tree), /Kladde gemt på denne enhed/)
  }
})

test('suggestion availability is explained for a new device, local history and unreadable drafts', () => {
  const { storage } = setup()
  for (const adapter of [memoryStorage(), storage, null]) {
    const host = createHost(WeeklyCheckIn, { ...props, storage: adapter })
    assert.match(textContent(host.tree), /Forslag vises kun, hvis sidste uges kladde findes på denne enhed\./)
    if (adapter !== storage) {
      for (const name of Object.keys(values)) assert.equal(field(host, name).props.value, '')
      assert.doesNotMatch(textContent(host.tree), /Samme som sidst|Forslag fra sidste/)
    }
  }
})

test('scope and adapter changes discard unsaved suggestions; clearing does not resurrect them', () => {
  const { host, storage } = setup()
  edit(host, 'comment', 'Syntetisk ændring')
  descendants(host.tree).find(n => n.type === 'button' && textContent(n) === 'Slet kladde').props.onClick(); host.render()
  for (const name of Object.keys(values)) assert.equal(field(host, name).props.value, '')
  assert.deepEqual(storage.calls.filter(([op]) => op !== 'get'), [['remove', key]])
  host.render({ ...host.props, storage: memoryStorage() })
  assert.equal(field(host, 'pain').props.value, '')
  host.render({ ...host.props, storage, athleteId: 'synthetic-other' })
  assert.equal(field(host, 'comment').props.value, '')
  host.render({ ...host.props, athleteId: props.athleteId, weekStart: '2026-11-09' })
  assert.equal(field(host, 'comment').props.value, '')
})

test('OFF never inspects scope, storage or suggestion inputs', () => {
  const forbidden = () => assert.fail('OFF accessed an input')
  assert.equal(WeeklyCheckIn({ enabled: false, get athleteId() { return forbidden() },
    get weekStart() { return forbidden() }, get storage() { return forbidden() } }), null)
})
