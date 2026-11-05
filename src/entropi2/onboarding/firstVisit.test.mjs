import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHost, descendants, textContent } from './firstVisitTestHost.mjs'
import { memoryStorage } from './syntheticDom.mjs'
import { firstVisitKey, readFirstVisit, rememberFirstVisit, welcomeTitle } from './firstVisitState.mjs'
register('./firstVisitTestLoader.mjs', import.meta.url)
const { default: Introduction } = await import('./AthleteIntroduction.mjs')
const props = extra => ({ enabled: true, athleteId: 'synthetic-a', firstName: 'Testfornavn Testefternavn', storage: memoryStorage(), canLogReadiness: true, canLogWeight: true, ...extra })
const find = (host, tag) => descendants(host.tree).find(node => node.type === tag)
const button = (host, label) => descendants(host.tree).find(node => node.type === 'button' && textContent(node) === label)
const click = (host, label) => { assert.ok(button(host, label), label); button(host, label).props.onClick(); host.render() }

test('first visit imports the actual component: one step, first name, no mount write or focus theft', () => {
  const p = props(), host = createHost(Introduction, p)
  assert.match(textContent(host.tree), /Trin 1 af 4.*Velkommen, Testfornavn/)
  assert.doesNotMatch(textContent(host.tree), /Testefternavn|Log et sæt|Dagsform og vægt/)
  assert.equal(find(host, 'section').props['aria-label'], 'Introduktion')
  assert.equal(find(host, 'p').props['aria-live'], 'polite')
  assert.equal(find(host, 'h2').props.tabIndex, -1)
  assert.equal(host.focus, null)
  assert.deepEqual(p.storage.writes, [])
  for (const b of descendants(host.tree).filter(n => n.type === 'button')) {
    assert.equal(b.props.type, 'button'); assert.ok(b.props.style.minHeight >= 44); assert.equal(b.props.style.width, '100%')
  }
})

test('four short steps cover actual pass, set approval, readiness and weight; completion persists', () => {
  const storage = memoryStorage({ unrelated: 'keep' }), focused = []
  const host = createHost(Introduction, props({ storage, headingRef: { current: { focus() { focused.push('home') } } } }))
  click(host, 'Næste')
  assert.match(textContent(host.tree), /Find dit pas.*Start dagens pas.*intet program endnu/)
  assert.equal(host.focus, find(host, 'h2'))
  click(host, 'Næste')
  assert.match(textContent(host.tree), /Log et sæt.*kg.*gentagelser.*Godkendt.*endnu ikke bekræftet gemt/)
  click(host, 'Tilbage'); assert.match(textContent(host.tree), /Trin 2 af 4/)
  click(host, 'Næste'); click(host, 'Næste')
  assert.match(textContent(host.tree), /Trin 4 af 4.*Dagsform og vægt.*Dagsform på Hjem.*Vægt i dag på Hjem.*Gem/)
  click(host, 'Kom i gang')
  assert.equal(host.tree, null)
  assert.deepEqual(storage.writes, [[firstVisitKey('synthetic-a'), '1']])
  assert.equal(storage.getItem('unrelated'), 'keep')
  assert.deepEqual(focused, ['home'])
  host.unmount()
  assert.equal(createHost(Introduction, props({ storage })).tree, null)
})

test('skip is available at every step, writes once, and does not hide another athlete', () => {
  for (let step = 0; step < 4; step++) {
    const storage = memoryStorage(), p = props({ storage }), host = createHost(Introduction, p)
    for (let i = 0; i < step; i++) click(host, 'Næste')
    const skip = button(host, 'Spring over').props.onClick
    skip(); skip(); host.render()
    assert.equal(host.tree, null); assert.equal(storage.writes.length, 1)
    assert.equal(createHost(Introduction, p).tree, null)
    assert.ok(createHost(Introduction, { ...p, athleteId: 'synthetic-b' }).tree)
  }
})

test('empty/invalid names are neutral; names remain text and are never stored', () => {
  for (const firstName of [null, undefined, '', '  ', {}, 42]) {
    const host = createHost(Introduction, props({ firstName }))
    assert.equal(textContent(find(host, 'h2')), 'Velkommen')
  }
  const storage = memoryStorage(), host = createHost(Introduction, props({ storage, firstName: '<img> Testefternavn' }))
  assert.equal(textContent(find(host, 'h2')), 'Velkommen, <img>')
  assert.equal(find(host, 'img'), undefined)
  click(host, 'Spring over')
  assert.equal(JSON.stringify(storage.writes).includes('<img>'), false)
  assert.equal(welcomeTitle('  Testfornavn\n Testefternavn '), 'Velkommen, Testfornavn')
})

test('missing/denied storage stays usable; failed completion is explicit and returns focus', () => {
  for (const storage of [null, { getItem() { throw Error('synthetic denied') }, setItem() { throw Error('synthetic quota') } },
    { getItem() { return null }, setItem() { throw Error('synthetic quota') } }]) {
    let focus = 0
    const host = createHost(Introduction, props({ storage, headingRef: { current: { focus() { focus++ } } } }))
    click(host, 'Næste'); click(host, 'Næste'); click(host, 'Næste'); click(host, 'Kom i gang')
    assert.match(textContent(host.tree), /kunne ikke gemmes.*vises igen/)
    assert.equal(find(host, 'p').props.role, 'status')
    click(host, 'Luk'); assert.equal(host.tree, null)
    assert.equal(focus, 1)
  }
})

test('OFF and invalid identities do not read storage, names or the default storage getter', () => {
  const forbidden = () => assert.fail('inert access')
  for (const enabled of [false, undefined, null, 0, 1, 'true'])
    assert.equal(createHost(Introduction, { enabled, get athleteId() { forbidden() }, get storage() { forbidden() } }).tree, null)
  for (const athleteId of [null, undefined, '', ' ', 0, {}, false, '\ud800', 'x'.repeat(201)])
    assert.equal(createHost(Introduction, props({ athleteId, storage: { getItem: forbidden, setItem: forbidden } })).tree, null)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('synthetic denial') } })
    assert.equal(createHost(Introduction, props({ enabled: false, storage: undefined })).tree, null)
    const host = createHost(Introduction, props({ storage: undefined }))
    assert.match(textContent(host.tree), /tidligere valg kunne ikke læses/)
    click(host, 'Spring over'); assert.match(textContent(host.tree), /vises igen/)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('athlete/adapter changes and unmount invalidate retained callbacks; unfinished visits restart', () => {
  const storage = memoryStorage(), p = props({ storage }), host = createHost(Introduction, p)
  click(host, 'Næste')
  const oldSkip = button(host, 'Spring over').props.onClick
  host.render({ ...p, athleteId: 'synthetic-b' })
  assert.match(textContent(host.tree), /Trin 1 af 4/)
  oldSkip(); assert.equal(storage.writes.length, 0)
  const otherSkip = button(host, 'Spring over').props.onClick
  host.render({ ...host.props, storage: memoryStorage() })
  otherSkip(); assert.equal(storage.writes.length, 0)
  const afterUnmount = button(host, 'Spring over').props.onClick
  host.unmount(); afterUnmount(); assert.equal(host.props.storage.writes.length, 0)
  assert.match(textContent(createHost(Introduction, p).tree), /Trin 1 af 4/)
})

test('existing scoped marker is respected, global marker is ignored, corrupt markers show the guide', () => {
  const key = firstVisitKey('synthetic-a')
  assert.equal(createHost(Introduction, props({ storage: memoryStorage({ [key]: '1' }) })).tree, null)
  for (const value of [null, '', '0', 'true', '{broken'])
    assert.ok(createHost(Introduction, props({ storage: memoryStorage({ [key]: value, 'entropi2:onboarding:v1': '1' }) })).tree)
  for (const key of [null, 'other', 'entropi2:onboarding:v1', 'entropi2:onboarding:v1:athlete:%ED%A0%80']) {
    const forbidden = { getItem() { assert.fail('unscoped read') }, setItem() { assert.fail('unscoped write') } }
    assert.deepEqual(readFirstVisit(key, forbidden), { done: true, unavailable: false })
    assert.equal(rememberFirstVisit(key, forbidden), false)
  }
})

test('home passes only the existing first-name projection; the old DOM API remains compatible', () => {
  const source = readFileSync(new URL('../home/AthleteHome.mjs', import.meta.url), 'utf8')
  assert.match(source, /import HomeOnboarding from '\.\.\/onboarding\/AthleteIntroduction\.mjs'/)
  assert.match(source, /h\(HomeOnboarding, \{ enabled, athleteId: athlete\?\.id, firstName: name, storage: props.storage, headingRef,/)
  assert.match(source, /const name = firstName\(athlete\?\.name\)/)
})

test('daily guidance names only available Home actions or an explicitly available Kost tab', () => {
  for (const [extra, expected, absent] of [
    [{ canLogReadiness: true, canLogWeight: true }, /Dagsform på Hjem.*Vægt i dag på Hjem/, /Under Kost|træningsvisningen/],
    [{ canLogReadiness: true, canLogWeight: false }, /Dagsform på Hjem/, /Vægt i dag|under Kost/],
    [{ canLogReadiness: false, canLogWeight: true }, /Vægt i dag på Hjem/, /Dagsform på Hjem|under Kost/],
    [{ canLogReadiness: false, canLogWeight: false }, /Din coach på Hjem/, /Dagsform på Hjem|Vægt i dag|under Kost/],
    [{ canLogReadiness: false, canLogWeight: false, visKost: true }, /vægt under Kost/, /Dagsform på Hjem|Vægt i dag/],
  ]) {
    const p = props(extra), host = createHost(Introduction, p)
    click(host, 'Næste'); click(host, 'Næste'); click(host, 'Næste')
    assert.match(textContent(host.tree), expected); assert.doesNotMatch(textContent(host.tree), absent)
    click(host, 'Spring over'); assert.deepEqual(p.storage.writes, [[firstVisitKey(p.athleteId), '1']])
    host.unmount()
  }
})

test('retained error-dismiss handler cannot dismiss a replacement adapter introduction', () => {
  const host = createHost(Introduction, props({ storage: null }))
  click(host, 'Spring over')
  const dismiss = button(host, 'Luk').props.onClick
  host.render({ ...host.props, storage: memoryStorage() })
  dismiss(); host.render()
  assert.match(textContent(host.tree), /Trin 1 af 4/)
  assert.deepEqual(host.props.storage.writes, [])
  host.unmount(); dismiss()
})
