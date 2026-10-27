import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text } from './vcQueueHarness.mjs'
import { filterVideoQueue, videoQueueItems, videoQueueOptions, VIDEO_QUEUE_FILTER_ENABLED } from './videoQueueFilter.mjs'

const athletes = [{ id: 'a', name: 'Test Anna' }, { id: 'b', name: 'Test Bo' }, { id: 'h', name: 'Test Skjult' }]
const video = (id, athlete, lift) => ({ key: id, kind: 'video', athlete, video: { id, athlete_id: athlete.id, lift }, title: id, detail: id, color: '#67dff5', label: 'Video' })
const videos = [video('a-squat', athletes[0], 'squat'), video('b-bench', athletes[1], 'bench'), video('a-bench', athletes[0], 'bench'), video('hidden', athletes[2], 'deadlift')]
const message = { key: 'message', kind: 'message', athlete: athletes[1], title: 'Besked', detail: 'Bevar beskeden', label: 'Besked' }
function props(items = [...videos, message]) {
  const p = { athletes, hiddenAthleteIds: new Set(['h']), coachPriorityItems: items,
    latestByTrack: {}, unreadByTrack: {}, inboxRefreshStatus: { kind: 'success' },
    openCoachPriorityItem() {}, refreshCoachInbox() {}, videoQueueFilters: { athleteId: '', lift: '' } }
  p.setVideoQueueFilters = value => { p.videoQueueFilters = value }
  return p
}
const section = tree => nodes(tree).find(node => node.type === 'section' && node.props['aria-label'] === 'Videokø')
const selects = tree => nodes(section(tree)).filter(node => node.type === 'select')
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label)

test('default OFF og kun eksplicit true viser videofilter', async () => {
  assert.equal(VIDEO_QUEUE_FILTER_ENABLED, false)
  for (const flag of [undefined, false, 'true', 1]) {
    const view = await app(flag)
    const tree = view.render(props())
    assert.equal(section(tree), undefined)
    assert.equal(nodes(tree).filter(node => node.type === 'select').length, 0)
    assert.ok(text(tree).includes('a-squat'))
  }
})

test('DOM: atlet og løft kombineres, handler modtager samme video, nulstil bevarer rækkefølge', async () => {
  const view = await app(true)
  const p = props()
  const opened = []
  p.openCoachPriorityItem = (...args) => opened.push(args)
  let tree = view.render(p)
  assert.equal(nodes(section(tree)).filter(n => n.type === 'option').some(n => text(n) === 'Test Skjult'), false)
  selects(tree)[0].props.onChange({ target: { value: 'a' } })
  tree = view.render(p)
  selects(tree)[1].props.onChange({ target: { value: 'bench' } })
  tree = view.render(p)
  assert.match(text(section(tree)), /Viser 1 af 3 videoer/)
  assert.ok(!text(section(tree)).includes('a-squat'))
  button(section(tree), 'a-bench Video a-bench →').props.onClick()
  assert.deepEqual(opened, [[videos[2], 'inbox']])
  assert.ok(text(tree).includes('Bevar beskeden'))
  button(tree, 'Nulstil filtre').props.onClick()
  tree = view.render(p)
  assert.match(text(section(tree)), /Viser 3 af 3 videoer/)
  const videoButtons = nodes(section(tree)).filter(n => n.type === 'button' && n.props.onClick && text(n).includes('Video'))
  assert.deepEqual(videoButtons.map(n => text(n).split(' ')[0]), ['a-squat', 'b-bench', 'a-bench'])
})

test('DOM: tom kombination, fjernet atlet og fejl giver ikke falsk ryddet indbakke', async () => {
  const view = await app(true)
  const p = props(videos.slice(0, 3))
  let refreshed = 0
  p.refreshCoachInbox = () => refreshed++
  let tree = view.render(p)
  selects(tree)[0].props.onChange({ target: { value: 'b' } })
  tree = view.render(p)
  selects(tree)[1].props.onChange({ target: { value: 'squat' } })
  tree = view.render(p)
  assert.match(text(tree), /Ingen videoer matcher filtrene/)
  assert.ok(!text(tree).includes('Coach Briefing er ryddet'))
  p.coachPriorityItems = [videos[0]]
  p.videoReviewQueueError = 'Synthetic read failure'
  tree = view.render(p)
  assert.equal(selects(tree)[0].props.value, 'b')
  assert.match(text(tree), /Valgt atlet har ingen videoer/)
  assert.match(text(tree), /Listen kan være forældet/)
  button(section(tree), 'Prøv igen').props.onClick()
  assert.equal(refreshed, 1)
  p.inboxRefreshing = true
  tree = view.render(p)
  assert.equal(button(section(tree), 'Prøv igen').props.disabled, true)
})

test('modprøve: rene filtre muterer ikke, ukendt eller manglende løft og ens navne', () => {
  const sameName = video('duplicate', { id: 'other', name: 'Test Anna' }, 'custom')
  const missing = video('missing', athletes[0], undefined)
  const items = Object.freeze([...videos, message, sameName, missing, null])
  const queue = videoQueueItems(items, new Set(['h']))
  assert.deepEqual(filterVideoQueue(queue, 'a', 'bench'), [videos[2]])
  assert.deepEqual(filterVideoQueue(queue, 'other', 'custom'), [sameName])
  assert.ok(filterVideoQueue(queue).includes(missing))
  assert.deepEqual(videoQueueOptions(queue).lifts, ['bench', 'custom', 'squat'])
  assert.equal(videoQueueOptions(queue).athletes.length, 3)
  assert.equal(items.length, 8)
})
