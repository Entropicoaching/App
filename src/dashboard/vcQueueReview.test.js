import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text } from './vcQueueHarness.mjs'

const athlete = { id: 'synthetic-athlete', name: 'Test Atlet' }
const makeVideo = (id, lift) => ({ key: id, kind: 'video', athlete,
  video: { id, athlete_id: athlete.id, lift }, title: id, detail: 'Syntetisk klip', label: 'Video' })
const base = items => { const p = ({ athletes: [athlete], hiddenAthleteIds: new Set(), coachPriorityItems: items,
  latestByTrack: {}, unreadByTrack: {}, inboxRefreshStatus: { kind: 'success' },
  refreshCoachInbox() {}, openCoachPriorityItem() {}, videoQueueFilters: { athleteId: '', lift: '' } })
  p.setVideoQueueFilters = value => { p.videoQueueFilters = value }; return p }
const panel = tree => nodes(tree).find(n => n.type === 'section')
const controls = tree => nodes(tree).filter(n => n.type === 'select')

test('review: valgt atlet skjules under opdatering uden at vise en anden atlets videoer', async () => {
  const host = await app(true)
  const first = makeVideo('one', 'squat')
  const second = { ...makeVideo('two', 'bench'), athlete: { id: 'other', name: 'Test Anden' } }
  const p = base([first, second])
  let tree = host.render(p)
  controls(tree)[0].props.onChange({ target: { value: athlete.id } })
  p.hiddenAthleteIds = new Set([athlete.id])
  tree = host.render(p)
  assert.match(text(panel(tree)), /Viser 0 af 1 videoer/)
  assert.ok(!text(panel(tree)).includes('Syntetisk klip'))
  assert.equal(controls(tree)[0].props.value, athlete.id)
})

test('review: sidste match forsvinder, nulstilling og ukendt løft virker med samme mount', async () => {
  const host = await app(true)
  const p = base([makeVideo('one', 'squat'), makeVideo('two', 'custom_lift')])
  let tree = host.render(p)
  controls(tree)[1].props.onChange({ target: { value: 'squat' } })
  p.coachPriorityItems = [p.coachPriorityItems[1]]
  tree = host.render(p)
  assert.match(text(panel(tree)), /Viser 0 af 1 videoer/)
  assert.match(text(panel(tree)), /Valgt løft har ingen videoer/)
  const reset = nodes(tree).find(n => n.type === 'button' && text(n) === 'Nulstil filtre')
  reset.props.onClick()
  tree = host.render(p)
  assert.match(text(panel(tree)), /Viser 1 af 1 videoer/)
  assert.ok(nodes(tree).some(n => n.type === 'option' && text(n) === 'custom_lift'))
  controls(tree)[1].props.onChange({ target: { value: 'custom_lift' } })
  // Dashboard ejer valget, saa en ny indbakke efter profilbesoeg genbruger det.
  const remounted = await app(true)
  tree = remounted.render(p)
  assert.equal(controls(tree)[1].props.value, 'custom_lift')
  assert.match(text(panel(tree)), /Viser 1 af 1 videoer/)
  p.coachPriorityItems = []
  tree = host.render(p)
  assert.match(text(tree), /Ingen videoer i den hentede kø/)
  assert.match(text(tree), /Coach Briefing er ryddet/)
})

test('review: samtidige ON og OFF-modulgrafer påvirker ikke hinanden eller andre opgavetyper', async () => {
  const on = await app(true)
  const off = await app()
  const automation = { key: 'alert', kind: 'automation', alert: { id: 'synthetic-alert' }, title: 'Test Automation', label: 'Fejl' }
  const p = base([makeVideo('one', 'bench'), automation])
  p.handleAutomationAlert = () => {}
  const a = on.render(p), b = off.render(p)
  assert.ok(panel(a))
  assert.equal(panel(b), undefined)
  assert.match(text(a), /Test Automation/)
  assert.match(text(b), /Test Automation/)
  assert.equal(nodes(a).filter(n => n.props?.['data-automation-alert']).length, 1)
  assert.equal(nodes(b).filter(n => n.props?.['data-automation-alert']).length, 1)
})
