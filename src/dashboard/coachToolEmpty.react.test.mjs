// Real React SSR. Only the calendar's JSX syntax and extensionless style import
// are adapted; components, models and React itself are imported unchanged.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx } from './coachCalendarJsx.mjs'
import Notes from './CoachNotesPage.mjs'
import Overview from './ProgramOverblikView.mjs'
import AthleteCard from '../entropi2/coach/atletkort/AthleteCard.mjs'

const calendarURL = new URL('./CoachCalendarEvents.jsx', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    return next(context.parentURL === calendarURL && specifier === '../dashboardShared'
      ? '../dashboardShared.js' : specifier, context)
  },
  load(url, context, next) {
    if (url !== calendarURL) return next(url, context)
    return { format: 'module', shortCircuit: true, source:
      "import { createElement } from 'react'; const __h = (type, props, ignored, ...children) => createElement(type, props, ...children);\n"
      + jsx(readFileSync(new URL(url), 'utf8')) }
  },
})
const { default: CalendarEvents } = await import('./CoachCalendarEvents.jsx')
const athlete = { id: 'synthetic-tool', name: 'Syntetisk atlet' }, today = '2026-11-05'
const render = (Component, props) => renderToStaticMarkup(h(Component, props))
const receipt = extra => ({ athleteId: athlete.id, day: today, state: 'ready', complete: true, ...extra })

test('real React: undated notes retain their text without an invented date or fixed explanation', () => {
  const html = render(Notes, { athlete: { ...athlete, notes: 'Syntetisk gammel note' } })
  assert.match(html, /Syntetisk gammel note/)
  assert.doesNotMatch(html, /<time|Dato ukendt|Tidligere noter uden dato/)
  assert.match(html, /Ny note|Gem note/)
})

test('real React: an empty event section disappears and a valid date remains actionable', () => {
  for (const athletes of [[], [athlete], [{ ...athlete, competition_date: '2026-02-30' }]]) {
    assert.equal(render(CalendarEvents, { athletes }), '')
  }
  const html = render(CalendarEvents, { athletes: [{ ...athlete, competition_date: '2026-11-08' }], openProfile() {} })
  assert.match(html, /Stævnedatoer|Syntetisk atlet/)
  assert.match(html, /datetime="2026-11-08"/i)
  assert.match(html, /<button type="button"/)
})

test('real React: full sparse card hides unknown fields, keeps known zero and announces read errors', () => {
  const facts = { athlete, today }
  const sparse = render(AthleteCard, { enabled: true, facts })
  assert.match(sparse, /Syntetisk atlet/)
  assert.doesNotMatch(sparse, /ukendt|<dl|<dt|data-signal/)
  facts.session = receipt({ lastDay: null })
  facts.weight = receipt({ from: '2026-10-23', through: today, points: [] })
  const empty = render(AthleteCard, { enabled: true, facts })
  assert.match(empty, /Ingen registrerede pas/)
  assert.match(empty, /Vægttrend: for få vejninger/)
  assert.doesNotMatch(empty, /ukendt/)
  facts.nutrition = receipt({ from: '2026-10-30', through: today, loggedDays: 0 })
  facts.messages = receipt({ count: 0 })
  facts.session = receipt({ state: 'error' })
  const html = render(AthleteCard, { enabled: true, facts })
  assert.match(html, /Kost logget 0\/7 dage/)
  assert.match(html, /0 ulæste beskeder/)
  assert.match(html, /role="alert"[^>]*>Kunne ikke indlæses/)
  assert.doesNotMatch(html, /ukendt/)
})

test('real React: overview keeps default ready, explicit loading and error states, the end date and folded method', () => {
  const props = { athletes: [athlete], today, calendarWeeks: {
    [athlete.id]: [{ start_date: '2026-11-02', exercise_count: 1 }] }, openProfile() {} }
  for (const loading of [true, 'false']) {
    const html = render(Overview, { ...props, loading })
    assert.match(html, /Henter atleter/)
    assert.doesNotMatch(html, /Ingen atleter|Planlagt til/)
  }
  const html = render(Overview, props)
  assert.equal(html, render(Overview, { ...props, loading: undefined }))
  assert.equal(html, render(Overview, { ...props, loading: false }))
  assert.match(html, /Planlagt til 08\.11\.2026/)
  assert.doesNotMatch(html, /Programuge|ukendt|<details open/)
  assert.match(html, /<details><summary[^>]*>Om datoerne<\/summary>/)
  const error = render(Overview, { ...props, loading: true, loadError: true })
  assert.match(error, /role="alert"/)
  assert.doesNotMatch(error, /Henter atleter|Ingen atleter|Planlagt til/)
})
