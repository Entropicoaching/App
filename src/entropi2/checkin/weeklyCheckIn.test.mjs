import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { COMMENT_LIMIT, clearDraft, draftKey, emptyDraft, loadDraft, saveDraft, validDraft } from './weeklyDraft.mjs'
import { createHost, descendants, memoryStorage, textContent } from './syntheticReact.mjs'

register('./syntheticReactLoader.mjs', import.meta.url)
const { default: WeeklyCheckIn } = await import('./WeeklyCheckIn.mjs')
const scope = { enabled: true, athleteId: 'synthetic-athlete-a', weekStart: '2026-11-02' }
const key = draftKey(scope.athleteId, scope.weekStart)
const setup = (extra = {}) => createHost(WeeklyCheckIn, { ...scope, storage: memoryStorage(), ...extra })
const control = (host, name) => descendants(host.tree).find(node => node.props.name === name)
const change = (host, name, value) => {
  control(host, name).props.onChange({ target: { value } })
  host.render()
}
const button = (host, type) => descendants(host.tree).find(node => node.type === 'button' && node.props.type === type)
const submit = host => {
  let prevented = false
  descendants(host.tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  host.render()
}

test('standalone heading stays; embedded form keeps its accessible name without a repeated heading', () => {
  const standalone = setup()
  const heading = descendants(standalone.tree).find(node => node.type === 'h2')
  assert.equal(textContent(heading), 'Ugentligt check-in')
  assert.equal(standalone.tree.props['aria-labelledby'], heading.props.id)
  const embedded = setup({ showHeading: false })
  assert.equal(descendants(embedded.tree).filter(node => node.type === 'h2').length, 0)
  assert.equal(embedded.tree.props['aria-labelledby'], undefined)
  assert.equal(embedded.tree.props['aria-label'], 'Ugentligt check-in')
  assert.equal(descendants(embedded.tree).filter(node => ['input', 'select', 'textarea'].includes(node.type)).length, 5)
})

test('OFF and invalid scope never access storage, including a throwing global getter', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { assert.fail('OFF storage access') } })
  try {
    for (const enabled of [undefined, false, 1, 'true']) assert.equal(setup({ enabled }).tree, null)
    const store = memoryStorage()
    for (const props of [{ athleteId: '' }, { weekStart: '2026-11-03' }, { weekStart: '2026-02-30' }]) {
      assert.match(textContent(setup({ ...props, storage: store }).tree), /gyldig uge/)
    }
    assert.deepEqual(store.calls, [])
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('keys isolate athletes and Monday weeks; malformed identities and dates are safe', () => {
  assert.notEqual(key, draftKey('synthetic-athlete-b', scope.weekStart))
  assert.notEqual(key, draftKey(scope.athleteId, '2026-11-09'))
  assert.ok(draftKey('synthetic:a/b', scope.weekStart).includes('synthetic%3Aa%2Fb'))
  for (const id of ['', ' ', null, 1, 'a'.repeat(129), '\uD800']) assert.equal(draftKey(id, scope.weekStart), null)
  for (const day of ['', null, '2026-11-03', '2026-02-30', '2026-13-02', '02-11-2026']) assert.equal(draftKey('synthetic', day), null)
})

test('draft round-trip preserves explicit zero, missing answers and plain text; no unknown fields', () => {
  const store = memoryStorage()
  const draft = { ...emptyDraft(), sleep: '7.5', pain: '0', comment: '<script>synthetic</script>', extra: 'discard' }
  assert.ok(saveDraft(key, draft, store))
  const { extra, ...expected } = draft
  assert.equal(extra, 'discard')
  assert.deepEqual(loadDraft(key, store), { status: 'saved', draft: expected })
  assert.ok(clearDraft(key, store))
  assert.deepEqual(loadDraft(key, store), { status: 'empty', draft: emptyDraft() })
  assert.equal(store.data.get('unrelated-key'), 'preserved')
})

test('all public storage helpers reject keys outside the exact namespace before any access', () => {
  const store = memoryStorage()
  for (const bad of [null, '', 'unrelated-key', 'entropi2:checkin:v1:x:2026-11-03',
    'entropi2:checkin:v1:%ZZ:2026-11-02', 'entropi2:checkin:v1:%61:2026-11-02']) {
    assert.equal(saveDraft(bad, emptyDraft(), store), false)
    assert.equal(clearDraft(bad, store), false)
    assert.equal(loadDraft(bad, store).status, 'unavailable')
  }
  assert.deepEqual(store.calls, [])
})

test('range, type, step and length validation rejects invalid data without coercion or writes', () => {
  const store = memoryStorage()
  for (const [field, values] of Object.entries({ sleep: ['-1', '24.5', '7.2', 'NaN', 'Infinity', ' 7', 7, null],
    energy: ['0', '6', '2.5'], stress: ['0', '6'], pain: ['-1', '11', '1.5'], comment: [null, COMMENT_LIMIT + 1, 'x'.repeat(COMMENT_LIMIT + 1)] })) {
    for (const value of values) {
      const draft = { ...emptyDraft(), [field]: value }
      assert.equal(validDraft(draft), false, `${field}: ${String(value).slice(0, 20)}`)
      assert.equal(saveDraft(key, draft, store), false)
    }
  }
  assert.deepEqual(store.calls, [])
  for (const draft of [{ ...emptyDraft(), sleep: '24', energy: '5', stress: '1', pain: '10' },
    { ...emptyDraft(), sleep: '0', comment: 'x'.repeat(COMMENT_LIMIT) }]) assert.ok(validDraft(draft))
})

test('corrupt, future, oversized and invalid saved drafts are not silently accepted or overwritten', () => {
  const store = memoryStorage()
  for (const raw of ['{', 'null', '[]', 'x'.repeat(20001), JSON.stringify({ version: 2, draft: emptyDraft() }),
    JSON.stringify({ version: 1, draft: { ...emptyDraft(), pain: '99' } })]) {
    store.data.set(key, raw)
    assert.deepEqual(loadDraft(key, store), { status: 'unavailable', draft: emptyDraft() })
    assert.equal(store.data.get(key), raw)
  }
  assert.ok(store.calls.every(([op]) => op === 'get'))
})

test('getter, read, quota and removal errors are contained; no fallback to unrelated storage', () => {
  const denied = { getItem() { throw Error('synthetic read') }, setItem() { throw Error('synthetic quota') }, removeItem() { throw Error('synthetic remove') } }
  for (const store of [null, {}, denied]) {
    assert.equal(loadDraft(key, store).status, 'unavailable')
    assert.equal(saveDraft(key, emptyDraft(), store), false)
    assert.equal(clearDraft(key, store), false)
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('synthetic getter') } })
  try {
    assert.equal(loadDraft(key).status, 'unavailable')
    assert.equal(saveDraft(key, emptyDraft()), false)
    assert.equal(clearDraft(key), false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('actual form edits all five fields without writing; explicit save persists and prevents navigation', () => {
  const host = setup()
  assert.ok(host.props.storage.calls.every(([op]) => op === 'get'))
  assert.deepEqual(['sleep', 'energy', 'stress', 'pain', 'comment'].map(name => control(host, name).props.value), ['', '', '', '', ''])
  const values = { sleep: '8.5', energy: '4', stress: '2', pain: '0', comment: 'Syntetisk uge <b>rolig</b>' }
  for (const [name, value] of Object.entries(values)) change(host, name, value)
  assert.match(textContent(host.tree), /ikke gemt/)
  assert.ok(host.props.storage.calls.every(([op]) => op === 'get'))
  submit(host)
  const again = setup({ storage: host.props.storage })
  for (const [name, value] of Object.entries(values)) assert.equal(control(again, name).props.value, value)
  assert.equal(control(again, 'comment').props.dangerouslySetInnerHTML, undefined)
  assert.ok(host.props.storage.calls.filter(([op]) => op !== 'get').every(([, usedKey]) => usedKey === key))
})

test('failed persistence retains typed values and retry succeeds; invalid values do not overwrite last good draft', () => {
  const store = memoryStorage()
  const realSet = store.setItem
  store.setItem = () => { throw Error('synthetic quota') }
  const host = setup({ storage: store })
  change(host, 'comment', 'Syntetisk kommentar')
  assert.ok(store.calls.every(([op]) => op === 'get'))
  submit(host)
  assert.equal(control(host, 'comment').props.value, 'Syntetisk kommentar')
  assert.match(textContent(host.tree), /kun her/)
  store.setItem = realSet
  submit(host)
  assert.match(textContent(host.tree), /Kladde gemt/)
  change(host, 'sleep', '25')
  assert.match(textContent(host.tree), /ikke gemt/)
  assert.equal(loadDraft(key, store).draft.sleep, '')
  change(host, 'sleep', '7.5')
  assert.equal(loadDraft(key, store).draft.sleep, '')
  submit(host)
  assert.equal(loadDraft(key, store).draft.sleep, '7.5')
})

test('scope changes and OFF/remount cannot expose the previous unsaved draft', () => {
  const host = setup({ storage: null })
  change(host, 'comment', 'Syntetisk A')
  host.render({ ...host.props, athleteId: 'synthetic-athlete-b' })
  assert.equal(control(host, 'comment').props.value, '')
  change(host, 'comment', 'Syntetisk B')
  host.render({ ...host.props, weekStart: '2026-11-09' })
  assert.equal(control(host, 'comment').props.value, '')
  host.render({ ...host.props, enabled: false })
  assert.equal(host.tree, null)
  host.render({ ...host.props, enabled: true })
  assert.equal(control(host, 'comment').props.value, '')
})

test('changing the storage adapter reloads the same scope without copying prior answers', () => {
  const host = setup()
  change(host, 'comment', 'Syntetisk tidligere adapter')
  const store = memoryStorage()
  host.render({ ...host.props, storage: store })
  assert.equal(control(host, 'comment').props.value, '')
  assert.ok(store.calls.every(([op]) => op === 'get'))
})

test('clear removes only current scope; failure retains answers with an honest status', () => {
  const host = setup()
  change(host, 'energy', '3')
  const otherKey = draftKey('synthetic-athlete-b', scope.weekStart)
  saveDraft(otherKey, { ...emptyDraft(), pain: '0' }, host.props.storage)
  const remove = host.props.storage.removeItem
  host.props.storage.removeItem = () => { throw Error('synthetic remove') }
  button(host, 'button').props.onClick(); host.render()
  assert.equal(control(host, 'energy').props.value, '3')
  assert.match(textContent(host.tree), /kunne ikke slettes/)
  host.props.storage.removeItem = remove
  button(host, 'button').props.onClick(); host.render()
  assert.equal(control(host, 'energy').props.value, '')
  assert.equal(host.props.storage.data.has(key), false)
  assert.equal(loadDraft(otherKey, host.props.storage).draft.pain, '0')
  assert.equal(host.props.storage.data.get('unrelated-key'), 'preserved')
})

test('form exposes associated labels, hints, large controls, numeric bounds and local-only status', () => {
  const host = setup()
  const nodes = descendants(host.tree)
  for (const name of ['sleep', 'energy', 'stress', 'pain', 'comment']) {
    const node = control(host, name)
    assert.ok(node.props.style.minHeight >= 48)
    assert.ok(nodes.some(item => item.type === 'label' && item.props.htmlFor === node.props.id))
    assert.ok(nodes.some(item => item.props.id === node.props['aria-describedby']))
  }
  for (const item of nodes.filter(node => node.type === 'button')) assert.ok(item.props.style.minHeight >= 48)
  assert.equal(control(host, 'sleep').props.step, 0.5)
  assert.equal(control(host, 'sleep').props.max, 24)
  assert.equal(control(host, 'comment').props.maxLength, COMMENT_LIMIT)
  assert.equal(control(host, 'pain').children[1].props.value, '0')
  assert.ok(nodes.some(node => node.props.role === 'status' && node.props['aria-live'] === 'polite'))
  assert.match(textContent(host.tree), /De deles ikke med din coach/)
  assert.match(textContent(host.tree), /delt enhed/)
})
