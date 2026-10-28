import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './staevneHomeLoader.mjs'
import { createElement, text, nodes } from './staevneHomeDom.mjs'
const hooks = install()
const { staevneHome, renderStaevneHome } = await import('./staevneHome.mjs')
const args = { enabled: true, now: new Date('2026-10-27T12:00Z'), athlete: { competition_date: '2026-11-26' } }
test('counter: labels remain literal, including markup and long text', () => {
  const block_name = '<img onerror="send()">' + 'Lang blok '.repeat(80)
  const tree = renderStaevneHome(createElement, { ...args, currentWeek: { block_name } })
  assert.ok(text(tree).includes(block_name.trim()))
  assert.equal(nodes(tree, n => n.type === 'img' || n.props.dangerouslySetInnerHTML).length, 0)
  assert.equal(tree.props.style.overflowWrap, 'anywhere')
})
test('counter: no training interpretation or athlete writes', () => {
  const athlete = Object.freeze({ competition_date: '2026-11-26' })
  const currentWeek = Object.freeze({ block_name: 'Coachens egen tekst', get sessions() { assert.fail('training read') } })
  assert.equal(staevneHome({ ...args, athlete, currentWeek }).focus, 'Ugens fokus: Coachens egen tekst')
})
test('counter: leap day valid only in leap years', () => {
  const now = new Date('2028-02-28T12:00Z')
  assert.equal(staevneHome({ ...args, now, athlete: { competition_date: '2028-02-29' } }).days, 1)
  assert.equal(staevneHome({ ...args, now, athlete: { competition_date: '2029-02-29' } }), null)
})
test('counter: moving clock past midnight updates model and removes passed meet', () => {
  const athlete = { competition_date: '2026-10-28' }
  for (const [instant, expected] of [['2026-10-27T22:59:59Z', 1], ['2026-10-27T23:00Z', 0], ['2026-10-28T23:00Z', null]]) {
    assert.equal(staevneHome({ ...args, athlete, now: new Date(instant) })?.days ?? null, expected)
  }
})
test('counter: holiday Home retains access', async () => {
  const Home = (await import('./HjemTab.jsx')).default
  const tree = Home({ ...args, tab: 'hjem', staevneHjem: true, onHoliday: true })
  assert.equal(nodes(tree, n => 'data-staevne-home' in n.props).length, 1)
})
test.after(() => hooks.deregister())
