import * as React from 'react'
import { KostplanAtletView } from './KostplanAtlet.mjs'
import UpcomingPlan from './UpcomingPlan.mjs'
import WaterDayLog from './WaterDayLog.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'
import { calendarDay } from '../../../calendarDate.js'

const { useState, useSyncExternalStore } = React

const idle = Object.freeze({ phase: 'idle' })
const snapshot = () => idle
const subscribe = () => () => {}
// The app's global headings and native controls are light-theme; this frame sits
// on the dark athlete page above the styled diary.
const control = { minHeight: 44, minWidth: 44, font: 'inherit', whiteSpace: 'normal', background: '#1c1c18', color: '#edeae2', border: '1px solid #414139', borderRadius: 8, padding: '8px 14px' }
const heading = { color: '#edeae2' }

// A new capability is committed for each visible current-day session. Retained
// callbacks cannot become valid again when returning from a future preview.
function FoodLogEntry({ entry, gateRef, trackerFold }) {
  const capability = React.useMemo(() => ({ entry }), [entry])
  React.useLayoutEffect(() => {
    gateRef.current = capability
    return () => { if (gateRef.current === capability) gateRef.current = null }
  }, [capability, gateRef])
  const [unavailable, setUnavailable] = useState(false)
  return React.createElement('div', { style: { padding: '0 16px 16px' } },
    React.createElement('button', { type: 'button', style: control, onClick: () => {
      if (gateRef.current !== capability) return
      setUnavailable(entry.openFoodLog(trackerFold.current) !== true)
    } }, 'Log mad'),
    unavailable && React.createElement('p', { role: 'status' }, 'Kostloggen er ikke klar til at åbne. Prøv igen, når den er tilgængelig.'))
}

export default function KostDayFrame({ controller, tracker, athleteId, date, client, currentDay, foodEntry }) {
  const [selection, setSelection] = useState(null)
  const dates = upcomingDates(date)
  const selected = selection && selection.athleteId === athleteId && selection.today === date && selection.client === client
    && dates.includes(selection.date) ? selection.date : date
  const preview = selected !== date
  const waterGate = React.useRef(null)
  const foodGate = React.useRef(null)
  const trackerFold = React.useRef(null)
  const selectDate = event => {
    const next = event.currentTarget.value
    if (dates.includes(next) && next !== selected) {
      // Retire retained intake callbacks before React commits the preview.
      waterGate.current = null
      foodGate.current = null
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
  let foodDayAvailable = !preview && foodEntry && date === calendarDay(new Date())
  if (foodDayAvailable && typeof currentDay === 'function') {
    try { foodDayAvailable = currentDay() === date } catch { foodDayAvailable = false }
  }
  return React.createElement('div', { style: { textAlign: 'left' } },
    dates.length > 1 && React.createElement('label', { style: { display: 'block', padding: 16 } }, 'Vælg plandato',
      React.createElement('select', { value: selected, 'aria-label': 'Vælg plandato', style: { ...control, display: 'block', marginTop: 8, maxWidth: '100%' },
        onChange: selectDate }, ...dates.map((day, index) => React.createElement('option', { key: day, value: day },
        `${index === 0 ? 'I dag' : index === 1 ? 'I morgen' : 'Om ' + index + ' dage'} · ${new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'))}`)))),
    ...(foodDayAvailable ? [React.createElement(FoodLogEntry, { key: 'food-entry', entry: foodEntry, gateRef: foodGate, trackerFold })] : []),
    preview && React.createElement(UpcomingPlan, { athleteId, today: date, date: selected, client }),
    // This subtree keeps its identity while browsing. No load, date change or
    // disposal reaches today's diary, drafts, receipts or nested week planner.
    React.createElement('div', { key: 'today', hidden: preview, inert: preview ? true : undefined },
    React.createElement('section', { 'aria-label': 'Kostplan fra din coach', 'aria-busy': loading,
      style: { padding: 16, overflowWrap: 'anywhere' } },
      React.createElement('h2', { style: heading }, 'Kostplan fra din coach'),
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
    React.createElement('details', { key: 'tracker', open: true, ref: trackerFold },
      React.createElement('summary', { style: { minHeight: 44, padding: 12, cursor: 'pointer' } }, 'Kostlog og vejning'), tracker)))
}
