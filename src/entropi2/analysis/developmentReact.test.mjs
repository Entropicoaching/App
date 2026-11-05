import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Analysis from './Analysis.mjs'
import { addCalendarDays } from '../../calendarDate.js'

const props = extra => ({ entropi2: true, now: '2026-11-04T12:00:00Z',
  athlete: { id: 'synthetic-a', competition_date: '2026-11-18' },
  fremgangLogs: Array.from({ length: 26 }, (_, i) => ({ exercise_id: `synthetic-${i}`,
    logged_at: addCalendarDays('2026-05-13', i * 7), weight: 100 + i, reps_completed: 3,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } })), ...extra })
const html = extra => renderToStaticMarkup(h(Analysis, props(extra)))

test('real React displays development before the closed weekly report with forecast and evidence', () => {
  const rendered = html()
  assert.ok(rendered.indexOf('Din udvikling') < rendered.indexOf('Din ugerapport'))
  assert.match(rendered, /26 uger/); assert.match(rendered, /steget 27,5 kg/)
  assert.match(rendered, /Prognose til næste stævne/); assert.match(rendered, /modelmargin/)
  assert.match(rendered, /<details data-analysis-secondary="true"/)
  const secondary = rendered.indexOf('data-analysis-secondary')
  assert.ok(secondary > 0)
  assert.doesNotMatch(rendered.slice(0, secondary), /<details[^>]* open/)
  assert.doesNotMatch(rendered, /De seneste 4 uger/)
})

test('real React renders empty, missing, loading, error and OFF honestly', () => {
  assert.match(html({ fremgangLogs: [] }), /Din udvikling kommer frem/)
  for (const extra of [{ fremgangLogs: undefined }, { fremgangLoading: true }, { fremgangError: true }]) {
    const rendered = html(extra)
    assert.match(rendered, /ikke klar endnu|Henter din udvikling|Din udvikling kunne ikke hentes/)
    assert.doesNotMatch(rendered, /steget 27,5 kg|modelmargin/)
  }
  assert.equal(html({ entropi2: false }), '')
})

test('real React shows only the trained deadlift style throughout development and forecast', () => {
  for (const name of ['Dødløft', 'Sumo dødløft']) {
    const logs = props().fremgangLogs.map(r => ({ ...r,
      exercises: { ...r.exercises, name } }))
    const rendered = html({ fremgangLogs: logs })
    const primary = rendered.slice(0, rendered.indexOf('data-analysis-secondary'))
    assert.match(primary, new RegExp(`${name}: skøn`))
    assert.equal((primary.match(/: e1RM over 26 uger/g) ?? []).length, 1)
    if (name === 'Dødløft') assert.doesNotMatch(primary, /Sumo dødløft/)
    else assert.doesNotMatch(primary, /Dødløft/)
  }
})
