import * as React from 'react'
import { KostplanAtletView } from './KostplanAtlet.mjs'
import UpcomingPlan from './UpcomingPlan.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'

const { createElement: h, useState, useSyncExternalStore } = React

const idle = Object.freeze({ phase: 'idle' })
const snapshot = () => idle
const subscribe = () => () => {}
const control = { minHeight: 44, minWidth: 44, font: 'inherit', whiteSpace: 'normal' }

export default function KostDayFrame({ controller, tracker, athleteId, date, client }) {
  const [selection, setSelection] = useState(null)
  const dates = upcomingDates(date)
  const selected = selection && selection.athleteId === athleteId && selection.today === date && selection.client === client
    && dates.includes(selection.date) ? selection.date : date
  const preview = selected !== date
  const s = useSyncExternalStore(controller?.subscribe || subscribe, controller?.snapshot || snapshot, controller?.snapshot || snapshot)
  const loading = ['idle', 'loading'].includes(s.phase)
  const failed = s.phase === 'load-error'
  const empty = s.phase === 'ready' && s.mode === 'tracker'
  const plan = s.mode === 'plan'
  const status = loading ? 'Henter din kostplan…'
    : failed ? 'Kostplanen kunne ikke hentes. Det er endnu ikke afklaret, om du har en aktiv plan.'
      : empty ? 'Du har ingen aktiv kostplan fra din coach for denne dag.'
        : plan ? 'Din godkendte kostplan vises nedenfor.' : 'Kostplanens status er ikke afklaret.'
  return h('div', null,
    dates.length > 1 && h('label', { style: { display: 'block', padding: 16 } }, 'Vælg plandato',
      h('select', { value: selected, 'aria-label': 'Vælg plandato', style: { minHeight: 44, font: 'inherit', maxWidth: '100%' },
        onChange: event => {
          const next = event.currentTarget.value
          if (dates.includes(next)) setSelection({ athleteId, today: date, client, date: next })
        } }, ...dates.map((day, index) => h('option', { key: day, value: day },
        `${index === 0 ? 'I dag' : index === 1 ? 'I morgen' : 'Om ' + index + ' dage'} · ${new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'))}`)))),
    preview && h(UpcomingPlan, { athleteId, today: date, date: selected, client }),
    // This subtree keeps its identity while browsing. No load, date change or
    // disposal reaches today's diary, drafts, receipts or nested week planner.
    h('div', { hidden: preview, inert: preview ? true : undefined },
    h('section', { 'aria-label': 'Kostplan fra din coach', 'aria-busy': loading,
      style: { padding: 16, overflowWrap: 'anywhere' } },
      h('h2', null, 'Kostplan fra din coach'),
      h('p', { role: failed ? 'alert' : 'status', 'aria-live': 'polite' }, status),
      empty && h('p', null, 'Bed din coach om at tildele en kostplan, hvis du ønsker en. Skriv under Beskeder, når du er færdig med din kostlog.'),
      !plan && h('p', null, 'Du kan stadig logge mad og bruge din lokale Ugeplan og indkøbsliste nedenfor.'),
      (empty || failed || (plan && s.phase === 'ready')) && typeof controller?.load === 'function' && h('button', {
        type: 'button', style: control, onClick: controller.load }, 'Hent kostplan igen')),
    plan && h(KostplanAtletView, { enabled: true, snapshot: s,
      onRetry: controller.load, onEaten: controller.markEaten, onEdit: controller.toggleEdit,
      onGrams: controller.setGrams, onConfirmNotLogged: controller.confirmNotLogged,
      tracker: h('p', null, 'Åbn Kostlog og vejning nedenfor for at kontrollere måltidet.') }),
    // Keep both the React host and all imperative/nested React content in place
    // across status transitions. The diary is usable before a plan is assigned.
    h('details', { key: 'tracker', open: true },
      h('summary', { style: { minHeight: 44, padding: 12, cursor: 'pointer' } }, 'Kostlog og vejning'), tracker)))
}
