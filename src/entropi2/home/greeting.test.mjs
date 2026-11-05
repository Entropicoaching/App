import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from './AthleteHome.mjs'

const now = new Date('2026-11-03T12:00:00Z')
const athlete = Object.freeze({ id: 'synthetic-athlete', name: 'Testfornavn Testefternavn' })
const week = { id: 'synthetic-week', athlete_id: athlete.id, start_date: '2026-11-02',
  sessions: [{ id: 'synthetic-session', weekday: 1,
    exercises: [{ id: 'synthetic-exercise', sets: 1 }] }] }
const props = extra => ({ enabled: true, athlete, now, allWeeks: [week], currentWeek: week,
  exerciseLogs: [], ...extra })
const done = { exerciseLogs: [{ athlete_id: athlete.id, exercise_id: 'synthetic-exercise',
  set_number: 1, logged_at: '2026-11-03T10:00:00Z' }] }
const render = extra => renderToStaticMarkup(createElement(AthleteHome, props(extra)))
const heading = html => html.match(/<h1\b[^>]*>(.*?)<\/h1>/s)?.[1]

test('both home greetings use only the first word without mutating the athlete', () => {
  for (const [name, expected] of [
    ['Testfornavn Testefternavn', 'Testfornavn'],
    ['  Testfornavn   Testmellem Testefternavn  ', 'Testfornavn'],
    ['\tTestfornavn\nTestefternavn', 'Testfornavn'],
    ['Testfornavn\u00a0Testefternavn', 'Testfornavn'],
    ['Test-fornavn Testefternavn', 'Test-fornavn'],
    ['Æøåtest Testefternavn', 'Æøåtest'],
    ['Testfornavn', 'Testfornavn'],
  ]) {
    const input = Object.freeze({ ...athlete, name })
    assert.equal(heading(render({ athlete: input })), `Klar til dit pas, ${expected}?`)
    assert.equal(heading(render({ ...done, athlete: input })), `Godt arbejde i dag, ${expected}`)
    assert.equal(input.name, name)
  }
})

test('empty, missing and invalid names render both greetings without a name', () => {
  for (const name of [undefined, null, '', ' \t\n\u00a0 ', 42, {}, []]) {
    assert.equal(heading(render({ athlete: { ...athlete, name } })), 'Klar til dit pas?')
    assert.equal(heading(render({ ...done, athlete: { ...athlete, name } })), 'Godt arbejde i dag')
  }
  assert.equal(heading(render({ athlete: undefined })), 'Klar til dit pas?')
})

test('empty and failed program data retain the first-name greeting and honest status', () => {
  const empty = render({ allWeeks: [], currentWeek: undefined })
  assert.equal(heading(empty), 'Dit overblik, Testfornavn')
  assert.match(empty, /Intet program endnu/)
  const failed = render({ programError: true })
  assert.equal(heading(failed), 'Dit overblik, Testfornavn')
  assert.match(failed, /Programmet kunne ikke hentes/)
  assert.doesNotMatch(failed, /Testefternavn|Start dagens pas/)
})

test('name stays React text, including markup-looking input', () => {
  const html = render({ athlete: { ...athlete, name: '<script>synthetic</script> Testefternavn' } })
  assert.equal(heading(html), 'Klar til dit pas, &lt;script&gt;synthetic&lt;/script&gt;?')
  assert.doesNotMatch(html, /<script>|Testefternavn/)
})

test('OFF neither reads the name nor touches storage', () => {
  const forbidden = () => assert.fail('OFF side effect')
  for (const enabled of [false, undefined, null, 1, 'true']) {
    assert.equal(render({ enabled, athlete: { get name() { forbidden() } },
      storage: { getItem: forbidden, setItem: forbidden } }), '')
  }
})
