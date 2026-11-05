// Synthetic data and syntax-only bridge for the actual calendar and real helpers.
// The mandatory .react test resolves React/ReactDOM normally; no package fallback.
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './coachCalendarJsx.mjs'

export function installCalendarClarityLoader(realReact = false) {
  const root = new URL('./', import.meta.url)
  const files = new Set(['KalenderView.jsx', 'CoachCalendarEvents.jsx'].map(name => new URL(name, root).href))
  const extensionless = new Set(['../dashboardShared', '../planOverview', './coachKonstanter'])
  const runtime = realReact ? 'react' : new URL('./coachCalendarDom.mjs', root).href
  return registerHooks({
    resolve(specifier, context, next) {
      if (files.has(context.parentURL) && extensionless.has(specifier)) return next(specifier + '.js', context)
      return next(specifier, context)
    },
    load(url, context, next) {
      if (!files.has(url)) return next(url, context)
      return { format: 'module', shortCircuit: true, source:
        `import { createElement, Fragment } from '${runtime}'; const __h = (type, props, ignored, ...children) => createElement(type ?? Fragment, props, ...children);\n`
        + jsx(readFileSync(new URL(url), 'utf8')) }
    },
  })
}

export const longBlock = 'Syntetisk grundstyrke med teknik og en meget lang blokbetegnelse '.repeat(3).trim()
export const athlete = { id: 'synthetic-a', name: 'Syntetisk atlet med langt navn' }
export const weeks = [1, 2].map(week_number => ({ week_number, block_name: longBlock,
  start_date: week_number === 1 ? '2026-11-02' : '2026-11-09', exercise_count: 1 }))
const noop = () => {}
export function calendarFixture(extra = {}) {
  return { entropi2: true, loading: false, loadError: false, calendarStatus: 'ready', calendarReady: true,
    athletes: [athlete], hiddenAthleteIds: new Set(), calendarWeeks: { [athlete.id]: weeks },
    athleteCurrentWeek: {}, athleteLastLogs: {}, snoozedAthletes: {}, blockPlan: [], blockSequenceRows: noop,
    openProfile: noop, openPlanReview: noop, snoozeAthlete: noop, askConfirm: noop, createCalendarWeek: noop,
    setTimelineEdit: noop, setBlockStartDate: noop, setHoverCell: noop, openCalBlockBuilder: noop, showFlash: noop,
    ...extra }
}
