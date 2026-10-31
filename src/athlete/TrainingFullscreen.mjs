import { createElement as h, useState, useEffect, useRef, useId } from 'react'
import { findDagensPas, nextSetInSession, sessionSetTotal, sessionLoggedCount } from '../nextSet.js'
import { fixedRepsEntry } from '../fixedRepsEntry.js'
import { bindTrainingDialog, remainingTrainingRest, watchTrainingRest } from './trainingFullscreenDom.mjs'
import { createTrainingApproval } from './trainingFullscreenModel.mjs'

const button = { minHeight: 44, minWidth: 44, padding: '12px 16px', font: 'inherit', borderRadius: 8,
  border: '1px solid #777', background: '#20252a', color: '#fff', cursor: 'pointer' }
const field = { ...button, width: '100%', boxSizing: 'border-box' }
const present = value => value === null || value === undefined || value === '' ? 'Ikke angivet' : String(value)

// Resolve only through the current program snapshot, never a retained session object.
function activeTrainingWeek({ allWeeks, currentWeek }) {
  return currentWeek?.id == null ? null : allWeeks?.find(w => w.id === currentWeek.id) || null
}
function selectedTrainingSession(props, selected) {
  const week = activeTrainingWeek(props)
  if (!week || selected?.weekId !== week.id) return null
  // Both snapshots must still contain the session during program refreshes.
  if (!props.currentWeek.sessions?.some(s => s.id === selected.sessionId)) return null
  return week.sessions?.find(s => s.id === selected.sessionId) || null
}

export default function TrainingFullscreen(props) {
  const { allWeeks, exerciseLogs = [], logInputs = {}, setLogInputs, restPause } = props
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [revision, redraw] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const trigger = useRef(null), dialog = useRef(null), handle = useRef(null), close = useRef(null)
  const latest = useRef(props)
  latest.current = props
  const approval = useRef(null)
  if (!approval.current) approval.current = createTrainingApproval(() => latest.current, message => {
    if (message !== undefined) setError(message)
    redraw(n => n + 1)
  })
  useEffect(() => { approval.current.reconcile() }, [exerciseLogs, revision])
  const id = useId()
  const pas = findDagensPas(allWeeks, activeTrainingWeek(props), exerciseLogs)
  // Keep completed logs on normal reopen, but only within this still-current week.
  const session = selectedTrainingSession(props, selected)
  useEffect(() => {
    if (selected && !session) { setOpen(false); setSelected(null) }
  }, [selected, session])
  const next = session ? nextSetInSession(session, exerciseLogs) : null
  const ex = next?.exercise
  const key = next ? `${ex.id}_${next.setNumber}` : null
  const input = key ? logInputs[key] || {} : {}
  const reps = input.reps ?? (ex ? fixedRepsEntry(ex.reps) : null) ?? ''
  const weight = input.weight ?? ex?.recommended_weight ?? ''
  const values = { ...input, weight, reps }
  const update = (name, value) => setLogInputs(previous => ({ ...previous,
    [key]: { ...(previous[key] || {}), [name]: value } }))
  useEffect(() => {
    if (!open || !session) return
    return bindTrainingDialog({ dialog: dialog.current, handle: handle.current, close: close.current,
      trigger: trigger.current, dismiss: () => setOpen(false) })
  }, [open, !!session])
  useEffect(() => {
    if (!open || !session) return
    return watchTrainingRest(restPause, setSeconds)
  }, [open, !!session, restPause])
  // Pending async writes belong to the existing handler, never to the dialog timer.
  const start = () => {
    const current = latest.current
    const week = activeTrainingWeek(current)
    const retained = selectedTrainingSession(current, selected)
    const today = findDagensPas(current.allWeeks, week, current.exerciseLogs)
    const chosen = retained || (today?.status === 'open' && today.next ? today.session : null)
    if (!chosen || !current.currentWeek?.sessions?.some(s => s.id === chosen.id)) return
    setSelected({ weekId: week.id, sessionId: chosen.id })
    setError('')
    setOpen(true)
  }
  const approve = () => {
    // A retained event may run after props changed. Resolve again before onLogSet.
    const valid = selectedTrainingSession(latest.current, selected)
    if (!valid) return false
    return approval.current.approve(valid, next, values)
  }
  const label = session ? 'Åbn dagens pas' : 'Start dagens pas'
  const unavailable = !session && (!pas?.next || pas.status !== 'open')
  return h('section', { 'aria-label': 'Dagens pas i fuld skærm', style: { marginBottom: 16 } },
    h('button', { ref: trigger, type: 'button', style: { ...button, width: '100%' },
      disabled: unavailable, 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': id, onClick: start }, label),
    unavailable && h('p', { role: 'status' }, pas?.status === 'done' ? 'Ugens pas er klaret.' : 'Intet pas i dag.'),
    open && session && h('dialog', { ref: dialog, id, 'aria-labelledby': `${id}-title`,
      style: { position: 'fixed', inset: 0, margin: 0, width: '100vw', height: '100dvh', maxWidth: 'none',
        maxHeight: 'none', boxSizing: 'border-box', border: 0, padding: 16, background: '#111519',
        color: '#edeae2', display: 'flex', flexDirection: 'column', gap: 16 } },
      h('header', { style: { flexShrink: 0 } },
        h('div', { ref: handle, 'aria-hidden': 'true', style: { minHeight: 44, touchAction: 'none', textAlign: 'center' } }, '•••'),
        h('button', { ref: close, type: 'button', 'aria-label': 'Luk dagens pas', style: button }, '×'),
        h('h1', { id: `${id}-title`, style: { fontSize: 24, overflowWrap: 'anywhere' } }, session?.title || 'Dagens pas'),
        h('p', { role: 'status', 'aria-live': 'polite' }, `${sessionLoggedCount(session, exerciseLogs)} af ${sessionSetTotal(session)} sæt klaret`)),
      h('main', { style: { overflowY: 'auto', minHeight: 0, flex: 1, overflowWrap: 'anywhere' } },
        next ? h('div', { key },
          h('h2', null, ex.name), h('p', null, `Sæt ${next.setNumber} af ${next.totalSets}`),
          h('p', null, `Plan: ${present(ex.reps)} reps. Intensitet: ${present(ex.intensity)}`),
          ex.note && h('p', { style: { whiteSpace: 'pre-wrap' } }, 'Coachkommentar: ', ex.note),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 } },
            ...[['weight', 'Vægt i kg', weight, 'decimal'], ['reps', 'Reps', reps, 'numeric'], ['rpe', 'RPE', input.rpe ?? '', 'decimal']].map(([name, text, value, inputMode]) =>
              h('label', { key: name }, text, h('input', { type: 'text', inputMode, style: field, value,
                onChange: event => update(name, event.target.value) })))),
          h('p', null, 'RPE er valgfri. Skriv 0 kg ved en øvelse uden ekstra vægt.'),
          h('button', { type: 'button', style: { ...button, width: '100%' }, disabled: approval.current.pending.has(key),
            onClick: approve }, 'Godkendt'),
          h('p', { role: 'timer', 'aria-label': 'Pause mellem sæt' },
            `Pause: ${remainingTrainingRest(restPause) > 0 ? seconds : 0} sekunder`),
          h('p', null, 'Næste sæt vises, når dette sæt er godkendt.'))
          : h('h2', { role: 'status' }, sessionSetTotal(session) > 0 ? 'Passet er færdigt.' : 'Intet pas i dag.'),
        error && h('p', { role: 'alert' }, error),
        h('h2', null, 'Klarede sæt'),
        ...(session?.exercises || []).flatMap(exercise => exerciseLogs
          .filter(log => log.exercise_id === exercise.id)
          .sort((a, b) => a.set_number - b.set_number)
          .map(log => h('p', { key: `${exercise.id}_${log.set_number}` },
            `${exercise.name}, sæt ${log.set_number}: ${log.skipped ? 'Sprunget over' : `${present(log.weight)} kg, ${present(log.reps_completed)} reps, RPE ${present(log.rpe_actual)}`}`))))))
}
