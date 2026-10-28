import test from 'node:test'
import assert from 'node:assert/strict'
import { VIDEO_QUEUE_WAIT_ENABLED, sortVideoQueueByWait, videoQueueAge, videoQueueLiftDetail } from './videoQueueWait.mjs'
import { app, nodes, text } from './vcQueueHarness.mjs'

const now = Date.parse('2026-10-28T12:00:00Z')
const athlete = { id: 'synthetic-a', name: 'Test Atlet' }
const clip = (id, created_at, extra = {}) => ({ key: id, kind: 'video', athlete,
  video: { id, created_at, ...extra }, title: id, detail: 'Syntetisk video', label: 'Video' })
const message = { key: 'message', kind: 'message', athlete, title: 'Test Besked', detail: 'Bevar besked', label: 'Besked' }
const props = items => ({ athletes: [athlete], hiddenAthleteIds: new Set(), coachPriorityItems: items,
  latestByTrack: {}, unreadByTrack: {}, inboxRefreshStatus: { kind: 'success' },
  videoQueueFilters: { athleteId: '', lift: '' }, setVideoQueueFilters() {},
  openCoachPriorityItem() {}, refreshCoachInbox() {} })
const panel = tree => nodes(tree).find(n => n.type === 'section' && n.props['aria-label'] === 'Videokø')
const ages = tree => nodes(tree).filter(n => n.props?.['data-video-wait'])
const videoButtons = tree => nodes(panel(tree)).filter(n => n.type === 'button' && text(n).includes('Syntetisk video'))

test('ventetid: ældst først, præcis tid og stabile ties uden mutation', () => {
  const older = clip('old', '2026-10-26T11:00:00Z')
  const same = clip('same', '2026-10-26T11:00:00Z')
  const newer = clip('new', '2026-10-26T12:00:00Z')
  const input = Object.freeze([newer, older, message, same])
  assert.deepEqual(sortVideoQueueByWait(input), [older, same, newer])
  assert.deepEqual(input, [newer, older, message, same])
  assert.equal(videoQueueAge(older, now), '2 dage')
  assert.equal(videoQueueAge(newer, now), '2 dage')
})

test('alder bruger fulde 24 timer, ikke lokal kalender eller afrunding', () => {
  for (const [delta, expected] of [[0, 'Under 1 dag'], [86399999, 'Under 1 dag'],
    [86400000, '1 dag'], [172800000, '2 dage'], [-86400000, 'Under 1 dag']]) {
    assert.equal(videoQueueAge(clip('x', new Date(now - delta).toISOString()), now), expected)
  }
})

test('modprøve: tidszoner, ugyldige tider og fallback bruger samme grundlag', () => {
  const a = clip('a', '2026-10-26T13:00:00+01:00')
  const b = clip('b', 'bad', { analyzed_at: '2026-10-26T12:00:00Z' })
  const c = clip('c', null); c.createdAt = '2026-10-27T12:00:00Z'
  const unknown = clip('unknown', 'bad')
  assert.deepEqual(sortVideoQueueByWait([unknown, c, a, b]), [a, b, c, unknown])
  assert.equal(videoQueueAge(a, now), videoQueueAge(b, now))
  assert.equal(videoQueueAge(unknown, now), 'Alder ukendt')
  assert.equal(videoQueueAge(clip('missing', null), now), 'Alder ukendt')
  const creation = clip('creation', '2026-10-20T12:00:00Z', { analyzed_at: '2026-10-27T12:00:00Z' })
  assert.equal(videoQueueAge(creation, now), '8 dage')
})

test('løftdata: kendte kontraktfelter, delvise data og ingen opdigtede nuller', () => {
  assert.equal(videoQueueLiftDetail({ lift: 'bench', load_kg: '82.5', reps_count: 4 }), 'Bænkpres · 82,5 kg · 4 gentagelser')
  assert.equal(videoQueueLiftDetail({ lift: 'deadlift', load_kg: 0 }), 'Dødløft · 0 kg')
  assert.equal(videoQueueLiftDetail({ lift: 'custom', reps_count: 3 }), 'custom · 3 gentagelser')
  for (const value of [null, '', ' ', false, -1, Infinity, 'bad']) {
    assert.equal(videoQueueLiftDetail({ load_kg: value, reps_count: value }), 'Løftdata ikke angivet')
  }
  assert.equal(videoQueueLiftDetail({ reps_count: 2.5 }), 'Løftdata ikke angivet')
})

test('DOM: default OFF og kun boolesk true aktiverer ventetidskø', async () => {
  assert.equal(VIDEO_QUEUE_WAIT_ENABLED, false)
  for (const flag of [undefined, false, 'true', 1]) {
    const host = await app(undefined, flag)
    const p = props([clip('new', '2026-10-27T12:00:00Z'), message, clip('old', '2026-10-20T12:00:00Z')])
    const tree = host.render(p)
    assert.equal(panel(tree), undefined)
    assert.equal(ages(tree).length, 0)
    assert.match(text(tree), /Bevar besked/)
    assert.ok(text(tree).indexOf('new') < text(tree).indexOf('old'))
  }
})

test('DOM: ventetid alene viser alle synlige videoer, metadata og original handler', async () => {
  const host = await app(false, true)
  const older = clip('old', '2026-10-20T12:00:00Z', { lift: 'squat', load_kg: 100, reps_count: 5 })
  const newer = clip('new', '2026-10-27T12:00:00Z')
  const hidden = { ...clip('hidden', '2020-01-01T00:00:00Z'), athlete: { id: 'hidden', name: 'Test Skjult' } }
  const p = props([newer, message, older, hidden])
  p.hiddenAthleteIds.add('hidden')
  p.videoQueueFilters = { athleteId: 'stale', lift: 'bench' }
  const opened = []; p.openCoachPriorityItem = (...args) => opened.push(args)
  const tree = host.render(p)
  assert.equal(nodes(panel(tree)).filter(n => n.type === 'select').length, 0)
  assert.deepEqual(ages(panel(tree)).map(n => n.props['data-video-wait']), ['old', 'new'])
  assert.match(text(panel(tree)), /Squat · 100 kg · 5 gentagelser/)
  assert.match(text(panel(tree)), /Løftdata ikke angivet/)
  assert.equal(ages(tree).length, 2)
  assert.match(text(tree), /Bevar besked/)
  videoButtons(tree)[0].props.onClick()
  assert.deepEqual(opened, [[older, 'inbox']])
})

test('DOM: begge flag kombinerer filtre med ventetid, nulstil bevarer sortering', async () => {
  const host = await app(true, true)
  const p = props([clip('new', '2026-10-27T12:00:00Z', { lift: 'bench' }),
    clip('old', '2026-10-20T12:00:00Z', { lift: 'squat' })])
  p.setVideoQueueFilters = value => { p.videoQueueFilters = value }
  let tree = host.render(p)
  const selects = nodes(panel(tree)).filter(n => n.type === 'select')
  selects[1].props.onChange({ target: { value: 'bench' } })
  tree = host.render(p)
  assert.deepEqual(ages(tree).map(n => n.props['data-video-wait']), ['new'])
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Nulstil filtre').props.onClick()
  tree = host.render(p)
  assert.deepEqual(ages(tree).map(n => n.props['data-video-wait']), ['old', 'new'])
})

test('DOM: filterflag alene beholder inputrækkefølge uden alder', async () => {
  const host = await app(true, false)
  const tree = host.render(props([clip('new', '2026-10-27T12:00:00Z'), clip('old', '2026-10-20T12:00:00Z')]))
  assert.equal(ages(tree).length, 0)
  assert.ok(text(panel(tree)).indexOf('new') < text(panel(tree)).indexOf('old'))
})

test('DOM modprøve: ukendt tid og løftdata kan stadig åbnes; fejl og opdatering bevares', async () => {
  const host = await app(false, true)
  const unknown = clip('unknown', 'bad')
  const p = props([unknown]); let opened, refreshed = 0
  p.openCoachPriorityItem = item => { opened = item }
  p.refreshCoachInbox = () => refreshed++
  p.videoReviewQueueError = 'Syntetisk fejl'
  let tree = host.render(p)
  assert.match(text(panel(tree)), /Alder ukendt · Løftdata ikke angivet/)
  assert.match(text(panel(tree)), /Listen kan være forældet/)
  videoButtons(tree)[0].props.onClick(); assert.equal(opened, unknown)
  nodes(tree).find(n => n.type === 'button' && text(n).includes('Opdater')).props.onClick()
  assert.equal(refreshed, 1)
  p.coachPriorityItems = []
  tree = host.render(p)
  assert.match(text(panel(tree)), /Ingen videoer i den hentede kø/)
  assert.ok(!text(tree).includes('Coach Briefing er ryddet'))
})
