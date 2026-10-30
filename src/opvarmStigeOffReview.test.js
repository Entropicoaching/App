import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { draw, handlers } from './rebaseHarness.mjs'
import { nodes, normalized } from './coachRyd2Harness.mjs'
const baseline = JSON.parse(readFileSync(new URL('./rebaseProgramOverblikBase.json', import.meta.url), 'utf8'))
const plain = tree => JSON.parse(JSON.stringify(normalized(tree)))

test('R2 counterprobe: Dashboard calendar follows real current day outside the snapshot fixture', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-30T12:00:00Z') })
  for (const day of ['2026-10-30', '2027-01-01', '2032-02-29']) {
    t.mock.timers.setTime(Date.parse(day + 'T12:00:00Z'))
    for (const width of [375, 1280]) {
      const calendar = nodes(draw('', width, 'calendar').tree).find(node => node.type === 'KalenderView')
      assert.equal(calendar.props.planStartDate, day)
      assert.equal(calendar.props.openProfile, handlers.openProfile)
    }
  }
})

test('R2 counterprobe: all twelve immutable OFF trees survive warmup OFF query variants', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-29T12:00:00Z') })
  assert.equal(baseline.cases.length, 12)
  for (const entry of baseline.cases) for (const value of ['0', 'true', '1&opvarmStige=0']) {
    const search = entry.search + (entry.search ? '&' : '?') + 'opvarmStige=' + value
    assert.deepEqual(plain(draw(search, entry.width, entry.view ?? undefined).tree), entry.tree)
  }
})

test('R2 counterprobe: Copenhagen midnight retains the actual calendar date', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-29T22:59:59Z') })
  const date = () => nodes(draw('', 375, 'calendar').tree).find(node => node.type === 'KalenderView').props.planStartDate
  assert.equal(date(), '2026-10-29')
  t.mock.timers.tick(1000)
  assert.equal(date(), '2026-10-30')
})
