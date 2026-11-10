// U3b: grafer, ét fokuspunkt pr. kort og ingen dobbelt e1RM. Fejler på 8046ea12, fordi charts.mjs mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { addCalendarDays } from '../../calendarDate.js'
import { Bars, Dots, ShareBar, Sparkline } from './charts.mjs'
import { athleteFocus } from './athleteWeekModel.mjs'
import { AthleteWeekCardView } from './AthleteWeekCard.mjs'
import { coachWeekFocus } from './weekByWeek.mjs'
import { TeamPatternsBody, teamFocus } from '../coach/TeamPatternsView.mjs'
import DevelopmentView from '../analysis/DevelopmentView.mjs'

test('graferne har faste mål, og et hul er aldrig en søjle på 0', () => {
  const bars = render(h(Bars, { values: [150, null, 170], target: 160, label: 'Protein' }))
  assert.match(bars, /width="120"/)
  assert.equal((bars.match(/<rect/g) ?? []).length, 3)
  assert.match(bars, /height="2"[^>]*fill="#59564c"/)
  assert.equal(render(h(Bars, { values: [null, null], label: 'x' })), '')
  const line = render(h(Sparkline, { values: [80, 81, null, 82, 83], label: 'Vægt' }))
  assert.equal((line.match(/<polyline/g) ?? []).length, 2)
  assert.equal(render(h(Sparkline, { values: [80, null], label: 'x' })), '')
  assert.equal((render(h(Dots, { done: 2, total: 3, label: 'Pas' })).match(/fill="#d8b16b"/g) ?? []).length, 2)
  assert.match(render(h(ShareBar, { share: 0.5, label: 'Andel' })), /width:50%/)
})

test('atletens fokus: manglende pas går forud, derefter logning, protein, vægt og hold kursen', () => {
  const training = { key: 'training', done: 2, planned: 3 }
  const nutrition = { key: 'nutrition', proteinAverage: 120, proteinTarget: 160 }
  const weight = { key: 'weight', kg: 0.3, onTrack: false }
  assert.equal(athleteFocus([training, nutrition, weight]).key, 'training')
  assert.match(athleteFocus([training]).text, /manglede 1 pas/)
  assert.equal(athleteFocus([{ ...training, done: 3 }], { nutritionDays: 2 }).key, 'logging')
  const protein = athleteFocus([{ ...training, done: 3 }, nutrition, weight])
  assert.equal(protein.key, 'protein')
  assert.equal(protein.value, '+40 g protein')
  const w = athleteFocus([{ ...training, done: 3 }, { ...nutrition, proteinAverage: 158 }, weight])
  assert.equal(w.key, 'weight')
  assert.match(w.text, /Tal med din coach/)
  assert.doesNotMatch(w.text, /kcal/)
  assert.equal(athleteFocus([{ ...training, done: 3 }]).key, 'steady')
})

test('ugekortet viser fokus og grafer og har ingen egen e1RM-sektion', () => {
  const model = { label: 'Min uge · 2. til 8. nov.', showCard: true, sentence: null,
    focus: { key: 'protein', value: '+40 g protein', text: 'om dagen.' },
    lines: [{ key: 'training', label: 'Træning', text: '1 af 2 pas · 1,5 t', done: 1, planned: 2 },
      { key: 'nutrition', label: 'Kost', text: '5 af 7 dage', days: 5, proteinAverage: 120, proteinTarget: 160, series: [120, 130, null, 110, 140, 100, null] }],
    strength: { lifts: [{ key: 'squat', label: 'Squat', text: 'e1RM 170 kg · står stille' }], message: null } }
  const html = render(h(AthleteWeekCardView, { model }))
  assert.match(html, /data-u3-focus="protein"/)
  assert.match(html, /data-u3-chart="dots"[\s\S]*data-u3-chart="bars"/)
  assert.doesNotMatch(html, /data-u3-strength|Udvikling|e1RM/)
})

test('"Din udvikling" får kurve og retning pr. løft kun med U3-tendenser', () => {
  const fremgangLogs = Array.from({ length: 8 }, (_, i) => ({ exercise_id: `s-${i}`, athlete_id: 'synthetic-a',
    logged_at: `${addCalendarDays('2026-09-15', i * 7)}T10:00:00Z`, weight: 150 + i * 2.5, reps_completed: 3,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }))
  const props = { entropi2: true, now: '2026-11-10T12:00:00Z', athlete: { id: 'synthetic-a' }, fremgangLogs }
  const plain = render(h(DevelopmentView, props))
  assert.match(plain, /data-development-latest/)
  assert.doesNotMatch(plain, /data-u3-trend|data-u3-chart/)
  const withTrend = render(h(DevelopmentView, { ...props, u3Trends: [{ label: 'Squat', tail: 'står stille', plateau: true, drop: false }] }))
  assert.match(withTrend, /data-u3-trend="Squat"[^>]*>står stille</)
  assert.match(withTrend, /data-u3-chart="line"/)
  // Forklaringen er én kort linje med U3-tendenser og uændret uden.
  assert.match(plain, /ikke en testet rekord/)
  assert.doesNotMatch(withTrend, /ikke en testet rekord|Denne uge er ufuldstændig/)
})

test('coachens fokus i "Uge for uge" følger kost, protein, e1RM og readiness', () => {
  const weeks = [1, 2, 3, 4].map(n => ({ label: `uge ${n}` }))
  const base = [{ key: 'kostdage', values: [7, 7, 7, 7] }, { key: 'protein', values: [160, 160, 160, 160], target: 160 },
    { key: 'squat', lift: 'Squat', values: [160, 165, 170, 175] }, { key: 'readiness', values: [75, 75, 75, 75] }]
  const set = (key, values) => base.map(s => s.key === key ? { ...s, values } : s)
  assert.equal(coachWeekFocus(set('kostdage', [7, 7, 7, 2]), weeks).key, 'kostdage')
  assert.equal(coachWeekFocus(set('protein', [160, 160, 160, 120]), weeks).key, 'protein')
  assert.equal(coachWeekFocus(set('squat', [170, 168, 169, 170]), weeks).value, 'Squat står stille')
  assert.equal(coachWeekFocus(set('readiness', [76, 75, 77, 65]), weeks).key, 'readiness')
  const steady = coachWeekFocus(base, weeks)
  assert.equal(steady.key, 'steady')
  for (const f of [steady, coachWeekFocus(set('squat', [170, 168, 169, 170]), weeks)]) assert.doesNotMatch(f.text + f.value, /[↑↓→]|fordi|skyldes|derfor/)
})

test('"Holdet samlet" står i et kort, og "under 5" får hverken bjælke eller fokus', () => {
  const result = { g1: { text: '6 af 6 logger kost mindst 4 af 7 dage', n: 6, total: 6 },
    g2: { text: 'under 5 af 6 rammer protein, median 85 % af målet', n: 2, total: 6 },
    g3: [{ key: 'squat', name: 'Squat', text: '5 af 9 står stille eller falder', n: 5, total: 9 }] }
  const html = render(h(TeamPatternsBody, { result }))
  assert.match(html, /data-u3-team="true" style="padding:16px/)
  assert.equal((html.match(/data-u3-chart="share"/g) ?? []).length, 2)
  assert.doesNotMatch(html, /Protein: under 5[^"]*" data-u3-chart/)
  const focus = teamFocus(result)
  assert.equal(focus.key, 'loft')
  assert.doesNotMatch(focus.value, /^[1-4] af/)
  assert.equal(teamFocus({ g1: result.g1, g2: null, g3: [] }).key, 'steady')
})
