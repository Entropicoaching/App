import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'
const now = new Date('2026-11-03T12:00:00Z')
const athlete = { id: 'synthetic-athlete' }
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02',
  sessions: [0, 1].map(i => ({ id: `s${i}`, title: `Syntetisk pas ${i}`, weekday: i,
    exercises: [{ id: `e${i}`, name: 'Syntetisk øvelse', sets: 1 }] })) }
const log = (i, extra = {}) => ({ athlete_id: athlete.id, exercise_id: `e${i}`, set_number: 1,
  logged_at: '2026-11-03T10:00:00Z', ...extra })
const props = extra => ({ enabled: true, athlete, allWeeks: [week], currentWeek: week,
  exerciseLogs: [log(0), log(1, { skipped: true })], now, ...extra })

const render = extra => renderToStaticMarkup(createElement(AthleteHome, props(extra)))

test('one legacy line, today and film before the closed native week disclosure', () => {
  const html = render()
  assert.equal((html.match(/data-week-sessions/g) || []).length, 1)
  assert.match(html, /data-week-sessions=""[^>]*>Ugen: 2 af 2 pas/)
  assert.ok(html.indexOf('Dit næste pas') < html.indexOf('data-film-set'))
  assert.ok(html.indexOf('data-film-set') < html.indexOf('data-home-week-plan'))
  assert.doesNotMatch(html, /Fra din coach/)
  const withCoach = render({ messages: [{ sender_role: 'coach', content: 'Syntetisk coachbesked' }] })
  assert.ok(withCoach.indexOf('data-home-week-plan') < withCoach.indexOf('Fra din coach'))
  assert.match(withCoach, /Syntetisk coachbesked/)
  const disclosure = html.match(/<details[^>]*data-home-week-plan=""[^>]*>(.*?)<\/details>/s)
  assert.ok(disclosure)
  assert.doesNotMatch(disclosure[0], /<details[^>]*\bopen(?:=|\s|>)/)
  assert.match(disclosure[1], /<summary[^>]*>Se ugens plan<\/summary>/)
  assert.match(disclosure[1], /data-entropi2-week-plan/)
  assert.match(disclosure[1], /Syntetisk pas 1/)
  assert.match(disclosure[1], /1 sæt sprunget over/)
})

test('unrelated undated or Tuesday plan retains the weekly sentence and disclosure', () => {
  for (const start_date of [undefined, '2026-11-10']) {
    const html = render({ allWeeks: [week, { ...week, id: 'other', start_date }] })
    assert.match(html, /Ugen: 2 af 2 pas/)
    assert.match(html, /Se ugens plan/)
  }
})

test('holiday and missing or failed week hide the weekly sentence and disclosure', () => {
  for (const extra of [
    { onHoliday: true }, { programError: true }, { loading: true },
    { allWeeks: [] , currentWeek: undefined }, { allWeeks: {} },
    { allWeeks: [{ ...week, start_date: null }] }, { exerciseLogs: undefined },
  ]) {
    const html = render(extra)
    assert.doesNotMatch(html, /data-week-sessions|data-home-week-plan|Se ugens plan/)
    if (extra.onHoliday) assert.match(html, /Din træning venter, når du er tilbage./)
  }
})

test('loaded empty plan stays honest and OFF performs no storage access', () => {
  const empty = { ...week, sessions: [] }
  const html = render({ allWeeks: [empty], currentWeek: empty })
  assert.match(html, /Ingen pas planlagt i denne uge./)
  assert.doesNotMatch(html, /data-home-week-plan|Se ugens plan/)
  assert.doesNotMatch(html, /0 af 0|Ugens plan er ikke tilgængelig/)
  const forbidden = () => assert.fail('OFF side effect')
  assert.equal(render({ enabled: false, storage: { getItem: forbidden, setItem: forbidden } }), '')
})

test('Tuesday and Sunday weeks render a single count and their actual dated plan', () => {
  for (const start_date of ['2026-11-03', '2026-11-01', '2026-10-20', '2026-10-25']) {
    const selected = { ...week, start_date }
    const now = new Date(start_date.startsWith('2026-10') ? '2026-10-25T12:00:00Z' : '2026-11-04T12:00:00Z')
    const html = render({ allWeeks: [selected, { ...week, id: 'undated', start_date: null }],
      currentWeek: selected, exerciseLogs: [], now })
    assert.equal((html.match(/data-week-sessions/g) || []).length, 1)
    assert.match(html, /Ugen: 0 af 2 pas/)
    assert.match(html, /Se ugens plan/)
    assert.ok(html.includes(`dateTime="${start_date}"`) || html.includes(`datetime="${start_date}"`))
    assert.doesNotMatch(render({ allWeeks: [selected], currentWeek: selected, now, onHoliday: true }),
      /data-week-sessions|data-home-week-plan/)
  }
})
