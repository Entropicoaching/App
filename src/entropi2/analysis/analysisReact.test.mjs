import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Analysis from './Analysis.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import WeeklyReport from './ugerapport/WeeklyReport.mjs'
import MineData from '../athlete/minedata/MineData.mjs'
import IntensityView from './intensitet/IntensityView.mjs'
import { readOwnTracking } from '../tracking/readOwnTracking.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const props = extra => ({ entropi2: true, now, athlete: { id: 'synthetic-a' },
  currentWeek: { start_date: '2026-11-02', sessions: [{ id: 's', exercises: [{ id: 'e', name: 'Squat', sets: 1 }] }] },
  exerciseLogs: [{ exercise_id: 'e', set_number: 1, logged_at: '2026-11-03T10:00:00Z', weight: 80, reps_completed: 3 }],
  fremgangLogs: [], historicalMealLogs: [{ date: '2026-11-03', kcal: 500 }],
  weightLogs: [{ athlete_id: 'synthetic-a', logged_at: '2026-11-03', weight: 80 }], ...extra })
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]
const html = p => renderToStaticMarkup(h(Analysis, p))

test('real React renders connected data and keeps leaves as component elements', () => {
  const tree = Analysis(props()), all = nodes(tree)
  for (const leaf of [WeeklyReport, MineData]) assert.equal(all.filter(n => n.type === leaf).length, 1)
  const rendered = html(props())
  assert.match(rendered, /1 registreret, gennemført pas/)
  assert.match(rendered, /1 registreret dag af 28/)
  assert.match(rendered, /1 dag med registreret kropsvægt/)
  assert.equal(all.filter(n => n.type === IntensityView).length, 0)
  assert.doesNotMatch(rendered, /1 sæt uden gyldig måling|andel ukendt/)
  assert.doesNotMatch(rendered, /Rekorder i perioden/)
  assert.equal((rendered.match(/data-analysis-records=/g) ?? []).length, 0)
})

test('long-term development has no collapsed ancestor; secondary sections start closed', () => {
  const tree = Analysis(props())
  const find = (node, key, ancestors = []) => {
    if (!node || typeof node !== 'object') return null
    if (node.props?.[key]) return { node, ancestors }
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(child, key, [...ancestors, node]); if (result) return result
    }
    return null
  }
  assert.equal(tree.props.children[1].type, DevelopmentView)
  const secondary = find(tree, 'data-analysis-secondary').node
  assert.equal(secondary.type, 'details')
  assert.equal(secondary.props.open, undefined)
  for (const key of ['data-analysis-mine-data', 'data-analysis-share']) {
    const { node } = find(tree, key)
    assert.equal(node.type, 'details'); assert.equal(node.props.open, undefined)
    assert.ok(node.props.children[0].props.style.minHeight >= 44)
  }
  assert.equal(find(tree, 'data-analysis-more'), null)
  assert.deepEqual(find(tree, 'data-analysis-share').ancestors.filter(n => n.type === 'details'), [secondary])
  assert.equal(find(tree, 'data-analysis-intensity'), null)
  assert.equal((html(props()).match(/<figure/g) ?? []).length, 1)
  const rendered = html(props())
  const share = rendered.indexOf('<details data-analysis-share=')
  assert.ok(share > 0)
  const depth = [...rendered.slice(0, share).matchAll(/<\/?details\b[^>]*>/g)]
    .reduce((count, [tag]) => count + (tag.startsWith('</') ? -1 : 1), 0)
  assert.equal(depth, 1)
  assert.doesNotMatch(rendered, /<summary[^>]*>Flere analyser<\/summary>/)
})

test('real React renders empty, missing, loading and error sources honestly', () => {
  assert.match(html(props({ exerciseLogs: [], historicalMealLogs: [], weightLogs: [] })), /Din udvikling kommer frem/)
  assert.match(html(props({ fremgangLogs: undefined })), /Din udvikling er ikke klar endnu/)
  assert.match(html(props({ fremgangLoading: true })), /Henter din udvikling/)
  assert.match(html(props({ fremgangError: true })), /Din udvikling kunne ikke hentes/)
  assert.match(html(props({ weightError: true, mealError: true, exerciseLogsError: true })), /Dine registreringer kunne ikke hentes/)
  for (const entropi2 of [false, undefined, 1, 'true']) {
    const p = { entropi2, get now() { throw Error('OFF read') }, get athlete() { throw Error('OFF read') } }
    assert.equal(Analysis(p), null)
    assert.equal(renderToStaticMarkup(h(Analysis, { entropi2 })), '')
  }
})

test('host passes existing meal and weight snapshots within the gated analysis block', () => {
  const source = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
  const block = source.match(/\{e2Atlet && tab === 'fremgang' && \([\s\S]*?<Entropi2Analysis[\s\S]*?\/>/)[0]
  for (const name of ['athlete', 'currentWeek', 'exerciseLogs', 'fremgangLogs', 'historicalMealLogs', 'weightLogs'])
    assert.ok(block.includes(`${name}={${name}}`), name)
})


test('real React: Mine tal is closed below strength, displays empty and error truthfully', () => {
  const trackingSnapshot = { athleteId: 'synthetic-a', endDate: '2026-11-03',
    status: 'ready', complete: true, dailyRows: [] }
  const rendered = html(props({ trackingSnapshot }))
  assert.doesNotMatch(rendered, /data-fremgang-mine-tal|Ingen registreringer i perioden/)
  const error = html(props({ trackingSnapshot: { ...trackingSnapshot, status: 'error' }, onRetryTracking() {} }))
  assert.match(error, /role="alert"/); assert.match(error, /Hent igen/)
  const dailyRows = [1, 2, 3].map(i => ({ athlete_id: 'synthetic-a', source: 'athlete_manual',
    logged_date: `2026-11-0${i}`, sleep_hours: 0, energy: 2, stress: 3, soreness: 0 }))
  const withData = html(props({ trackingSnapshot: { ...trackingSnapshot, dailyRows } }))
  assert.ok(withData.indexOf('data-analysis-history') < withData.indexOf('data-fremgang-mine-tal'))
  assert.match(withData, /<details data-fremgang-mine-tal="true"/)
  assert.doesNotMatch(withData, /<details[^>]*data-fremgang-mine-tal[^>]* open=/)
  assert.match(withData, /0,0 timer/); assert.match(withData, /For lidt data: 3 af mindst 4 dage/)
  assert.doesNotMatch(withData, /Styrke · ugeestimater|Vis vægtgrundlag|Vis kostgrundlag|Vis træningsgrundlag/)
})

test('real React: existing readiness reader reaches Mine tal with native scale and one title', async () => {
  const data = [31, 1, 2, 3].map(day => ({ athlete_id: 'synthetic-a',
    logged_date: day === 31 ? '2026-10-31' : `2026-11-0${day}`,
    sleep_hours: 0, energy: 2, stress: 3, soreness_level: 5 }))
  const client = { from(table) {
    const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'lt', 'order'].map(key => [key, () => query]))
    query.limit = () => ({ data: table === 'readiness_logs' ? data : [] })
    return query
  } }
  const trackingSnapshot = await readOwnTracking({ enabled: true, client,
    athleteId: 'synthetic-a', day: '2026-11-04' })
  const rendered = html(props({ trackingSnapshot }))
  const start = rendered.indexOf('<details data-fremgang-mine-tal=')
  const end = rendered.indexOf('<details data-analysis-secondary=')
  const fold = rendered.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(fold, /0,0 timer/); assert.match(fold, /5,0 af 5 \(5 mest\)/)
  assert.match(fold, /oprindelige skala fra 1 til 5/)
  assert.doesNotMatch(fold, /<h2>Mine tal|Vis træningsgrundlag|Vis kostgrundlag|Vis vægtgrundlag/)
})


test('real React: Mine tal follows development with no outer fold and no empty secondary wrapper', () => {
  const trackingSnapshot = { athleteId: 'synthetic-a', endDate: '2026-11-03',
    status: 'ready', complete: true, dailySource: 'readiness_logs',
    dailyRows: [{ athlete_id: 'synthetic-a', source: 'readiness_logs', logged_date: '2026-11-03',
      sleep_hours: 8, energy: 3, stress: 2, soreness_level: 1 }] }
  const rendered = html(props({ trackingSnapshot }))
  const mine = rendered.indexOf('<details data-fremgang-mine-tal=')
  assert.ok(mine > rendered.indexOf('data-development='))
  assert.ok(mine < rendered.indexOf('data-analysis-secondary='))
  const depth = [...rendered.slice(0, mine).matchAll(/<\/?details\b[^>]*>/g)]
    .reduce((count, [tag]) => count + (tag.startsWith('</') ? -1 : 1), 0)
  assert.equal(depth, 0)
  assert.doesNotMatch(rendered.slice(mine, rendered.indexOf('>', mine) + 1), / open=/)
  assert.match(rendered, /data-athlete-sleep="true"/)
  assert.match(rendered, /data-athlete-restitution="true"/)
  const trackingOnly = html(props({ trackingSnapshot, currentWeek: undefined, exerciseLogs: [],
    fremgangLogs: [], historicalMealLogs: [], weightLogs: [] }))
  assert.match(trackingOnly, /data-fremgang-mine-tal/)
  assert.doesNotMatch(trackingOnly, /data-analysis-secondary/)
})


test('real React E2-TILG-TRYK3: both native explanation targets render at least 44px', () => {
  const rendered = html(props({ currentWeek: undefined, exerciseLogs: [], fremgangLogs: [{
    exercise_id: 'synthetic-target', logged_at: '2026-11-03', weight: 100, reps_completed: 3,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } },
  }] }))
  const targets = [...rendered.matchAll(/<details[^>]*><summary([^>]*)>Sådan tælles det<\/summary>/g)]
  assert.equal(targets.length, 2)
  for (const [whole, attributes] of targets) {
    assert.doesNotMatch(whole, /<details[^>]* open=/)
    assert.match(attributes, /min-height:44px/)
    assert.match(attributes, /box-sizing:border-box/)
    assert.match(attributes, /padding-top:12px/)
    assert.match(attributes, /padding-bottom:12px/)
  }
})
