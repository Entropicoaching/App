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
  for (const leaf of [WeeklyReport, MineData, IntensityView]) assert.equal(all.filter(n => n.type === leaf).length, 1)
  const rendered = html(props())
  assert.match(rendered, /1 registrerede, gennemførte pas/)
  assert.match(rendered, /1 registrerede dage af 28/)
  assert.match(rendered, /1 dage med registreret kropsvægt/)
  assert.match(rendered, /1 sæt uden gyldig måling/)
  assert.doesNotMatch(rendered, /Rekorder i perioden/)
  assert.equal((rendered.match(/data-analysis-records=/g) ?? []).length, 1)
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
  assert.equal(tree.props.children[2].props['data-analysis-secondary'], true)
  assert.equal(tree.props.children[2].props.open, undefined)
  for (const key of ['data-analysis-mine-data', 'data-analysis-more', 'data-analysis-intensity']) {
    const { node } = find(tree, key)
    assert.equal(node.type, 'details'); assert.equal(node.props.open, undefined)
    assert.ok(node.props.children[0].props.style.minHeight >= 44)
  }
  assert.equal((html(props()).match(/<figure/g) ?? []).length, 2)
})

test('real React renders empty, missing, loading and error sources honestly', () => {
  assert.match(html(props({ exerciseLogs: [], historicalMealLogs: [], weightLogs: [] })), /0 registrerede, gennemførte pas/)
  assert.match(html(props({ fremgangLogs: undefined })), /Sætdata er ikke klar/)
  assert.match(html(props({ fremgangLoading: true })), /Henter intensitetsdata/)
  assert.match(html(props({ fremgangError: true })), /Intensitetsdata kunne ikke hentes/)
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
