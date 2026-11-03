import test from 'node:test'
import assert from 'node:assert/strict'
import { weightSummary } from './startModel.mjs'
import { mountNutritionScreen } from './index.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-03', athlete = { id: 'synthetic-trend' }
const day = offset => new Date(Date.parse(date + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
const row = (offset, weight, extra = {}) => ({ athlete_id: athlete.id, logged_at: day(offset), weight, ...extra })
const weeks = (current = 80, previous = 81) => [0, -1, -6].map(d => row(d, current))
  .concat([-7, -8, -13].map(d => row(d, previous)))
const summary = rows => weightSummary(rows, athlete.id, date)

test('TREND: inclusive -6/-7 and -13/-14 boundaries with one latest valid row per day', () => {
  const rows = [...weeks(), row(-14, 999), row(1, 999), row(-7, 999, { athlete_id: 'synthetic-other' }),
    row(-7, 83, { created_at: '2026-11-03T08:00:00Z' }), row(-7, 99, { created_at: '2026-11-03T07:00:00Z' }),
    row(-7, 0, { created_at: '2026-11-03T09:00:00Z' }), row(-7, -1), row(-7, NaN), row(-8, Infinity),
    row(-8, 'bad'), row(-8, 999, { logged_at: '2026-02-30' }), null]
  const before = structuredClone(rows), s = summary(rows)
  assert.equal(s.days, 3); assert.equal(s.average, 80)
  assert.equal(s.previousDays, 3); assert.equal(s.previousAverage, (83 + 81 + 81) / 3)
  assert.equal(s.comparison, '1,7 kg lavere end ugen før')
  assert.deepEqual(s.latest, { weight: 80, date }); assert.deepEqual(rows, before)
  assert.deepEqual(summary([...rows].reverse()), s)
})

test('TREND: fewer than three distinct valid days in either week suppresses comparison', () => {
  for (const rows of [weeks().slice(0, 5), weeks().slice(1), weeks().slice(0, 3), [], null,
    [row(0, 80), row(0, 81), row(-6, 80), ...weeks().slice(3)],
    [row(-7, 80), row(-7, 81), row(-13, 80), ...weeks().slice(0, 3)]]) {
    assert.equal(summary(rows).comparison, null)
  }
})

test('TREND: neutral decimal comparison at and around 0.05 kg in both directions', () => {
  for (const [current, previous, expected] of [
    [80, 80, 'samme som ugen før'], [80.049, 80, 'samme som ugen før'], [80, 80.049, 'samme som ugen før'],
    [80.05, 80, '0,1 kg højere end ugen før'], [80, 80.05, '0,1 kg lavere end ugen før'],
    [80.051, 80, '0,1 kg højere end ugen før'], [80, 80.051, '0,1 kg lavere end ugen før'],
    [80.3, 80, '0,3 kg højere end ugen før'], [80, 80.4, '0,4 kg lavere end ugen før'],
    [81.05, 80, '1,1 kg højere end ugen før']]) {
    assert.equal(summary(weeks(current, previous)).comparison, expected, `${current} / ${previous}`)
  }
  assert.equal(summary(weeks(Number.MAX_VALUE, Number.MAX_VALUE)).comparison, null)
  assert.doesNotMatch(summary(weeks(Number.MAX_VALUE / 2, 1)).comparison, /Infinity|NaN/)
})

test('TREND: calendar arithmetic crosses month, year and leap day', () => {
  for (const screen of ['2026-01-03', '2024-03-02']) {
    const rows = [0, -6, -1, -7, -8, -13].map(d => ({ athlete_id: athlete.id, weight: d >= -6 ? 80 : 81,
      logged_at: new Date(Date.parse(screen + 'T00:00:00Z') + d * 86400000).toISOString().slice(0, 10) }))
    assert.equal(weightSummary(rows, athlete.id, screen).comparison, '1 kg lavere end ugen før')
  }
})

test('TREND: actual synthetic DOM adds plain comparison after unchanged average, refresh hides it, no weight read', async () => {
  const host = syntheticHost(), tables = []
  const client = { from(table) {
    tables.push(table)
    const query = { select() { return query }, eq() { return query }, gte() { return query }, lte() { return query },
      async order() { return { data: [], error: null } } }
    return query
  } }
  const cleanup = mountNutritionScreen(host, { entropi2: true, athlete, date, client, weightLogs: weeks() })
  await flush()
  const section = find(host, 'h2', 'Din vægt').parentElement, paragraphs = section.querySelectorAll('p')
  assert.equal(paragraphs[0].textContent, `Seneste vægt: 80 kg · ${date}`)
  assert.equal(paragraphs[1].textContent, 'Ugegennemsnit: 80 kg · 3 vejedage (seneste 7 dage)')
  assert.equal(paragraphs[2].textContent, '1 kg lavere end ugen før'); assert.equal(paragraphs[2].className, 'muted')
  assert.deepEqual(tables, ['meal_logs'])
  for (const [current, previous, expected] of [[80.3, 80, '0,3 kg højere end ugen før'], [80, 80, 'samme som ugen før']]) {
    cleanup.updateWeight({ weightLogs: weeks(current, previous) }); assert.match(host.textContent, new RegExp(expected))
  }
  for (const rows of [weeks().slice(0, 3), weeks().slice(1), []]) {
    cleanup.updateWeight({ weightLogs: rows }); assert.doesNotMatch(host.textContent, /ugen før/)
  }
  cleanup(); assert.equal(host.textContent, '')
})
