import * as React from 'react'
import { KostplanAtletView } from './KostplanAtlet.mjs'
import UpcomingPlan from './UpcomingPlan.mjs'
import WaterDayLog from './WaterDayLog.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'

const { useState, useSyncExternalStore } = React

const idle = Object.freeze({ phase: 'idle' })
const snapshot = () => idle
const subscribe = () => () => {}
const control = { minHeight: 44, minWidth: 44, font: 'inherit', whiteSpace: 'normal' }

export default function KostDayFrame({ controller, tracker, athleteId, date, client, currentDay }) {
  const [selection, setSelection] = useState(null)
  const dates = upcomingDates(date)
  const selected = selection && selection.athleteId === athleteId && selection.today === date && selection.client === client
    && dates.includes(selection.date) ? selection.date : date
  const preview = selected !== date
  const waterGate = React.useRef(null)
  const selectDate = event => {
    const next = event.currentTarget.value
    if (dates.includes(next) && next !== selected) {
      // Retire retained intake callbacks before React commits the preview.
      waterGate.current = null
      setSelection({ athleteId, today: date, client, date: next })
    }
  }
  const s = useSyncExternalStore(controller?.subscribe || subscribe, controller?.snapshot || snapshot, controller?.snapshot || snapshot)
  const loading = ['idle', 'loading'].includes(s.phase)
  const failed = s.phase === 'load-error'
  const empty = s.phase === 'ready' && s.mode === 'tracker'
  const plan = s.mode === 'plan'
  const status = loading ? 'Henter din kostplan…'
    : failed ? 'Kostplanen kunne ikke hentes. Det er endnu ikke afklaret, om du har en aktiv plan.'
      : empty ? 'Du har ingen aktiv kostplan fra din coach for denne dag.'
        : plan ? 'Din godkendte kostplan vises nedenfor.' : 'Kostplanens status er ikke afklaret.'
  return React.createElement('div', null,
    dates.length > 1 && React.createElement('label', { style: { display: 'block', padding: 16 } }, 'Vælg plandato',
      React.createElement('select', { value: selected, 'aria-label': 'Vælg plandato', style: { minHeight: 44, font: 'inherit', maxWidth: '100%' },
        onChange: selectDate }, ...dates.map((day, index) => React.createElement('option', { key: day, value: day },
        `${index === 0 ? 'I dag' : index === 1 ? 'I morgen' : 'Om ' + index + ' dage'} · ${new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'))}`)))),
    preview && React.createElement(UpcomingPlan, { athleteId, today: date, date: selected, client }),
    // This subtree keeps its identity while browsing. No load, date change or
    // disposal reaches today's diary, drafts, receipts or nested week planner.
    React.createElement('div', { hidden: preview, inert: preview ? true : undefined },
    React.createElement('section', { 'aria-label': 'Kostplan fra din coach', 'aria-busy': loading,
      style: { padding: 16, overflowWrap: 'anywhere' } },
      React.createElement('h2', null, 'Kostplan fra din coach'),
      React.createElement('p', { role: failed ? 'alert' : 'status', 'aria-live': 'polite' }, status),
      empty && React.createElement('p', null, 'Bed din coach om at tildele en kostplan, hvis du ønsker en. Skriv under Beskeder, når du er færdig med din kostlog.'),
      !plan && React.createElement('p', null, 'Du kan stadig logge mad og bruge din lokale Ugeplan og indkøbsliste nedenfor.'),
      (empty || failed || (plan && s.phase === 'ready')) && typeof controller?.load === 'function' && React.createElement('button', {
        type: 'button', style: control, onClick: controller.load }, 'Hent kostplan igen')),
    plan && React.createElement(KostplanAtletView, { enabled: true, snapshot: s,
      onRetry: controller.load, onEaten: controller.markEaten, onEdit: controller.toggleEdit,
      onGrams: controller.setGrams, onConfirmNotLogged: controller.confirmNotLogged,
      tracker: React.createElement('p', null, 'Åbn Kostlog og vejning nedenfor for at kontrollere måltidet.') }),
    // Keep both the React host and all imperative/nested React content in place
    // across status transitions. The diary is usable before a plan is assigned.
    React.createElement(WaterDayLog, { enabled: !preview, athleteId, date, client, currentDay, gateRef: waterGate }),
    React.createElement('details', { key: 'tracker', open: true },
      React.createElement('summary', { style: { minHeight: 44, padding: 12, cursor: 'pointer' } }, 'Kostlog og vejning'), tracker)))
}
