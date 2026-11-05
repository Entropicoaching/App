// Real React SSR of the actual calendar; only JSX syntax and three extensionless imports are adapted.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx } from './coachCalendarJsx.mjs'
const root = new URL('./', import.meta.url)
const jsxFiles = new Set(['KalenderView.jsx', 'CoachCalendarEvents.jsx'].map(name => new URL(name, root).href))
const imports = new Set(['../dashboardShared', '../planOverview', './coachKonstanter'])
registerHooks({
  resolve(specifier, context, next) {
    if (jsxFiles.has(context.parentURL) && imports.has(specifier)) return next(specifier + '.js', context)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!jsxFiles.has(url)) return next(url, context)
    return { format: 'module', shortCircuit: true, source:
      "import { createElement, Fragment } from 'react'; const __h = (type, props, ignored, ...children) => createElement(type ?? Fragment, props, ...children);\n"
      + jsx(readFileSync(new URL(url), 'utf8')) }
  },
})
const { default: Calendar } = await import('./KalenderView.jsx')
const base = { athletes: [{ id: 'synthetic-a', name: 'Syntetisk atlet' }], hiddenAthleteIds: new Set(),
  athleteCurrentWeek: {}, athleteLastLogs: {}, snoozedAthletes: {}, blockPlan: [], blockSequenceRows: [],
  calendarWeeks: { 'synthetic-a': [{ week_number: 1, start_date: '2026-11-02', exercise_count: 1 }] } }
const render = extra => renderToStaticMarkup(h(Calendar, { ...base, ...extra }))

test('real React: day line, highlighted week and Danish date render at desktop and mobile widths', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T23:05:00Z') })
  try {
    for (const isMobile of [false, true]) {
      const html = render({ isMobile })
      assert.match(html, /data-calendar-today="2026-11-05"/)
      assert.match(html, /data-calendar-current-week="2026-11-02"/)
      assert.match(html, /torsdag 5. november/)
      assert.equal((html.match(/aria-current="date"/g) || []).length, 1)
      assert.match(html, /Syntetisk atlet/)
    }
  } finally { mock.timers.reset() }
})

test('real React: empty calendar, invalid date error and tasks-only state stay honest', () => {
  assert.match(render({ athletes: [] }), /Ingen atleter med datoer endnu/)
  const modern = render({ entropi2: true, loading: false, calendarStatus: 'ready', calendarReady: true, athletes: [] })
  assert.match(modern, /Ingen synlige atleter/)
  assert.doesNotMatch(modern, /Ingen atleter med datoer|data-calendar-board/)
  const error = render({ calendarWeeks: { 'synthetic-a': [{ week_number: 1, start_date: '2026-02-30' }] } })
  assert.match(error, /role="alert"/)
  assert.match(error, /Startdato kunne ikke vises/)
  assert.doesNotMatch(error, /data-calendar-today/)
  assert.doesNotMatch(render({ tasksOnly: true }), /data-calendar-today|Kalenderens tidslinje/)
})
