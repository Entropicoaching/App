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


test('real React gives the existing latest estimate priority over comparison and dated evidence', () => {
  const rendered = html()
  const latest = rendered.match(/<div data-development-latest="true"[\s\S]*?<\/time>\.<\/p><\/div>/)?.[0]
  assert.ok(latest)
  assert.match(latest, /Seneste e1RM/)
  assert.match(latest, /<strong[^>]*font-size:32px[^>]*>137,5<\/strong>/)
  assert.match(latest, /Registreret <time date[Tt]ime="2026-11-04">04\.11\.2026<\/time>/)
  assert.match(rendered, /<p data-history-summary="true"[^>]*font-size:16px[^>]*font-weight:600/)
  assert.match(rendered, /steget 27,5 kg/)
  assert.match(rendered, /Squat: tal og datagrundlag/)
  for (const extra of [{ fremgangLogs: [] }, { fremgangLogs: undefined },
    { fremgangLoading: true }, { fremgangError: true }])
    assert.doesNotMatch(html(extra), /data-development-latest|data-history-summary/)
})

test('real React folds three complete lift graphs while dated estimates and old-data warnings stay visible', () => {
  const names = ['Squat', 'Bænkpres', 'Dødløft']
  const rendered = html({ now: '2026-11-20T12:00:00Z',
    fremgangLogs: names.flatMap((name, lift) => props().fremgangLogs.map(row => ({ ...row,
      exercise_id: `${lift}-${row.exercise_id}`, exercises: { ...row.exercises, name } }))) })
  const charts = [...rendered.matchAll(/<details data-development-chart="([^"]+)"[^>]*>[\s\S]*?<\/details>/g)]
  assert.deepEqual(charts.map(match => match[1]), names)
  for (const [chart] of charts) {
    assert.doesNotMatch(chart.slice(0, chart.indexOf('>')), /\bopen=/)
    assert.match(chart, /<summary[^>]*>Se udviklingen over 26 uger<\/summary>/)
    assert.equal((chart.match(/<span\b/g) ?? []).length, 28) // 26 positions and two date labels
  }
  const outsideCharts = charts.reduce((markup, [chart]) => markup.replace(chart, ''), rendered)
  assert.equal((outsideCharts.match(/Seneste e1RM · skøn/g) ?? []).length, 3)
  assert.equal((outsideCharts.match(/Registreret <time date[Tt]ime="2026-11-04"/g) ?? []).length, 3)
  assert.equal((outsideCharts.match(/mere end 14 dage gammelt/g) ?? []).length, 3)
  assert.equal((outsideCharts.match(/data-history-summary=/g) ?? []).length, 3)
})
