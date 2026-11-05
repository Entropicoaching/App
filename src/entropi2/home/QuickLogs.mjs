import { createElement as h, useEffect, useId, useRef, useState } from 'react'
import { calendarDay } from '../../calendarDate.js'
import { homeStyles as s } from './homeStyles.mjs'
import { homeReadinessSuggestion, quickLogStatus, confirmedReadinessEnergy } from './quickLogModel.mjs'
import { createQuickController } from '../tracking/hurtig/controller.mjs'
import { readinessValue, weightValue } from '../tracking/hurtig/model.mjs'

const fields = [['energy', 'Energi', 'Lav', 'Høj'], ['motivation', 'Motivation', 'Lav', 'Høj'],
  ['stress', 'Stress', 'Lav', 'Høj'], ['soreness_level', 'Ømhed', 'Ingen', 'Meget']]
const parentKey = key => ({ sleep_hours: 'sleep', soreness_level: 'soreness' })[key] ?? key
const inputStyle = { ...s.secondary, boxSizing: 'border-box', padding: 12, background: '#171814', color: '#edeae2' }
const scoreButton = (label, value, selected, onClick) => h('button', { key: value, type: 'button',
  'aria-label': `${label} ${value}`, 'aria-pressed': selected,
  style: { ...s.secondary, marginTop: 0, minWidth: 44, padding: 0, boxSizing: 'border-box',
    borderWidth: 2, borderColor: selected ? '#b8b4a8' : '#414139',
    background: selected ? '#414139' : 'transparent' }, onClick },
String(value), selected && h('span', { 'aria-hidden': true }, ' ✓'))
const clock = () => new Date()
const parentReadiness = props => Object.fromEntries(['sleep_hours', ...fields.map(([key]) => key)]
  .map(key => [key, props.readinessInput?.[parentKey(key)] ?? '']))
const matches = (record, payload) => record && Object.keys(payload).every(key => record[key] === payload[key])
const statusFor = props => {
  if (props.enabled !== true) return null
  const data = props.trackingData
  const row = data?.status === 'ready' && data.complete === true && data.athleteId === props.athlete?.id &&
    data.today === props.today && Array.isArray(data.readinessRows)
    ? data.readinessRows.find(row => row.athlete_id === props.athlete.id && row.logged_date === props.today) : null
  const scoped = { ...props, readinessLog: props.readinessLog ?? row }
  return { ...quickLogStatus(scoped), energy: confirmedReadinessEnergy(scoped) }
}

// Controller owns the five-second grace period; the existing host owns drafts
// and writes. Never call a closed-over handler after a parent draft changes.
export default function QuickLogs(props) {
  const [open, setOpen] = useState(null)
  const [quick, setQuick] = useState(false)
  const [attempt, setAttempt] = useState(null)
  const [savedWeightDay, setSavedWeightDay] = useState(null)
  const [, setVersion] = useState(0)
  const latest = useRef(props), active = useRef(false), control = useRef(null), unsubscribe = useRef(null)
  const confirmation = useRef(null), opener = useRef(null), heading = useRef(null)
  const readinessOpener = useRef(null)
  const relaunch = useRef(null)
  const id = useId()
  latest.current = props
  const enabled = props.enabled
  const athlete = enabled === true ? props.athlete : undefined
  const today = enabled === true ? props.today : undefined
  const readOnly = enabled === true && props.sessionReadOnly
  const trackingData = enabled === true && !readOnly ? props.trackingData : undefined
  const readinessLog = enabled === true && !readOnly ? props.readinessLog : undefined
  const weightInput = enabled === true && !readOnly ? props.weightInput : undefined
  const reset = () => {
    unsubscribe.current?.(); unsubscribe.current = null
    control.current?.dispose(); control.current = null
    confirmation.current?.resolve(false); confirmation.current = null
  }
  useEffect(() => {
    if (enabled !== true || !athlete?.id || readOnly) return
    active.current = true
    return () => { active.current = false; reset() }
  }, [enabled, athlete?.id, today, readOnly])
  // The full heading mounts when the fast form expands, even if open is unchanged.
  // Score edits leave both dependencies unchanged and keep focus on the button.
  useEffect(() => { if (open && !quick) heading.current?.focus() }, [open, quick])
  useEffect(() => {
    if (control.current?.snapshot().phase === 'loading' && trackingData?.status !== 'loading') relaunch.current?.()
  }, [trackingData])
  // The handlers return undefined. Resolve only after React has committed their
  // dated record/input-clear AND this attempt's finished marker together.
  useEffect(() => {
    const pending = confirmation.current
    if (!pending || !attempt?.finished) return
    const p = latest.current
    const ok = pending.kind === 'readiness' ? matches(p.readinessLog, pending.payload)
      : p.weightInput === ''
    if (ok && pending.kind === 'weight') setSavedWeightDay(today)
    confirmation.current = null; pending.resolve(Boolean(ok))
  }, [attempt, readinessLog, weightInput, today])
  if (readOnly) return null
  const status = statusFor(props)
  if (!status) return null
  const readinessReceipt = status.energy == null ? 'Logget i dag' : `Energi ${status.energy}/5 · logget i dag`
  const state = control.current?.snapshot()
  const renderedController = control.current
  const busy = Boolean(state?.busy || props.savingReadiness || props.savingWeight)
  const weightDone = status.weight || savedWeightDay === today
  const done = open === 'readiness' ? status.readiness : weightDone
  const current = () => active.current && latest.current.enabled === true && !latest.current.sessionReadOnly &&
    latest.current.athlete?.id === athlete.id && latest.current.today === today &&
    calendarDay((latest.current.getNow ?? clock)()) === today
  const available = kind => !latest.current.sessionReadOnly && (kind === 'readiness'
    ? typeof latest.current.saveReadiness === 'function' && typeof latest.current.setReadinessInput === 'function'
    : typeof latest.current.logWeight === 'function' && typeof latest.current.setWeightInput === 'function')
  const mirror = (kind, draft) => {
    if (!current() || !available(kind)) return
    if (kind === 'weight') latest.current.setWeightInput(draft.weight)
    else latest.current.setReadinessInput(input => ({ ...input,
      ...Object.fromEntries(Object.entries(draft.readiness).map(([key, value]) => [parentKey(key), value])) }))
  }
  const confirmedSave = kind => async payload => {
    const p = latest.current
    const owner = control.current
    if (!current() || p.savingReadiness || p.savingWeight || statusFor(p)?.[kind]) return false
    try {
      if (kind === 'weight' ? weightValue(p.weightInput) !== payload.weight
        : !matches(payload, readinessValue(parentReadiness(p)))) return false
    } catch { return false }
    await (kind === 'readiness' ? p.saveReadiness() : p.logWeight())
    if (!current() || control.current !== owner) return false
    const result = new Promise(resolve => { confirmation.current = { kind, payload, resolve } })
    setAttempt({ finished: true, weightReturned: kind === 'weight' })
    return result
  }
  const launch = (kind, energy) => event => {
    if (!current() || control.current?.snapshot().busy || props.savingReadiness || props.savingWeight || !available(kind)) return
    const suggestion = energy === undefined ? null : homeReadinessSuggestion(latest.current)
    if (energy !== undefined && (!suggestion || statusFor(latest.current)?.readiness)) return
    reset(); setAttempt(null)
    // Fast-form buttons disappear on expansion; return to the stable row button.
    opener.current = kind === 'readiness' ? readinessOpener.current : event.currentTarget
    const p = latest.current
    const history = p.trackingData
    const scoped = history?.athleteId === athlete.id && history?.today === today
    const readinessRows = scoped && history.status === 'ready' && history.complete === true ? history.readinessRows : []
    const own = row => row?.athlete_id === athlete.id && !row._optimistic
    const rows = readinessRows.filter(own).filter(row => row.logged_date !== today)
    if (own(p.readinessLog) && p.readinessLog.logged_date === today) rows.push(p.readinessLog)
    else rows.push(...readinessRows.filter(row => row.logged_date === today))
    const data = kind === 'readiness' && history && (!scoped || history.status !== 'ready' || history.complete !== true)
      ? { status: history.status === 'error' ? 'error' : 'loading' }
      : { status: 'ready', complete: true, readinessRows: kind === 'readiness' ? rows : [],
        weightRows: kind === 'weight' && Array.isArray(p.weightLogs) ? p.weightLogs.filter(own) : [], mealRows: [] }
    const controller = createQuickController({ enabled: true, athleteId: athlete.id, date: today, data,
      clock: p.quickClock, currentDay: () => current() ? today : null,
      save: { [kind]: confirmedSave(kind) } })
    control.current = controller
    if (controller.snapshot().phase === 'ready') {
      if (suggestion) {
        for (const [key, value] of Object.entries({ ...suggestion, energy })) controller.setField('readiness', key, value)
      } else if (kind === 'weight' && String(p.weightInput ?? '').trim()) controller.setField('weight', 'weight', String(p.weightInput))
      if (!suggestion && kind === 'readiness' && Object.values(parentReadiness(p)).some(value => value !== '' && value != null))
        for (const [key, value] of Object.entries(parentReadiness(p))) controller.setField('readiness', key, String(value))
      mirror(kind, controller.snapshot().draft)
    }
    unsubscribe.current = controller.subscribe(() => setVersion(n => n + 1))
    setQuick(Boolean(suggestion))
    setOpen(kind)
  }
  relaunch.current = () => launch('readiness')({ currentTarget: opener.current })
  const close = () => {
    if (!active.current || latest.current.enabled !== true || latest.current.athlete?.id !== athlete.id ||
      control.current !== renderedController ||
      control.current?.snapshot().busy || latest.current.savingReadiness || latest.current.savingWeight) return
    reset(); setOpen(null); setQuick(false); setAttempt(null); opener.current?.focus()
  }
  const edit = (kind, key, value) => {
    if (current() && available(kind) && control.current === renderedController &&
      control.current?.setField(kind, key, value)) mirror(kind, control.current.snapshot().draft)
  }
  const rowButton = (kind, label, logged) => props.sessionReadOnly || !available(kind) ? null : h('button', { type: 'button',
    ref: kind === 'readiness' ? readinessOpener : undefined,
    style: { ...s.secondary, marginTop: 0, whiteSpace: 'nowrap', minWidth: 0 },
    'aria-label': logged ? `${label} · ${kind === 'readiness' && open !== kind && status.energy != null ? readinessReceipt : 'Logget i dag'}` : label,
    'aria-expanded': open === kind || kind === 'readiness' && fast,
    'aria-controls': open || fast ? `${id}-panel` : undefined,
    title: logged ? 'Logget i dag' : undefined, disabled: busy, onClick: launch(kind) },
  label, logged && h('span', { 'aria-hidden': true }, ' ✓'),
  kind === 'readiness' && logged && open !== kind && status.energy != null &&
    h('span', { 'aria-hidden': true, style: { display: 'block', whiteSpace: 'normal' } }, readinessReceipt))
  // Read-only previews expose no write buttons, including disconnected controls.
  if (props.sessionReadOnly || !available('readiness') && !available('weight')) return null
  const draft = state?.draft
  const readinessInput = draft?.readiness ?? {}
  const repeat = state?.canRepeat && (open === 'weight' ? state.weightSource !== undefined : state.readinessSource !== undefined)
  const saved = state?.phase === 'saved'
  const suggestion = !open && available('readiness') ? homeReadinessSuggestion(props) : null
  const fast = Boolean(suggestion || open === 'readiness' && quick)
  const fastInput = open ? readinessInput : suggestion
  const selectEnergy = (value, event) => {
    if (!current() || control.current !== renderedController || busy) return
    if (open) edit('readiness', 'energy', String(value))
    else launch('readiness', String(value))(event)
  }
  return h('div', { 'data-home-quick-logs': '', style: { marginBottom: 20 } },
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }, 'aria-label': 'Log i dag' },
      rowButton('readiness', 'Dagsform', status.readiness), rowButton('weight', 'Vægt i dag', weightDone)),
    fast && h('section', { id: `${id}-panel`, 'data-home-readiness-fast': '', 'aria-label': 'Dagsform',
      style: { ...s.card, marginTop: 12, marginBottom: 0 } },
      status.readiness || saved ? h('p', { role: 'status', style: s.text }, readinessReceipt) :
        h('form', { 'aria-busy': busy, onSubmit: event => {
          event.preventDefault()
          if (current() && available('readiness') && control.current === renderedController && open === 'readiness')
            control.current?.save('readiness')
        } },
        h('fieldset', { disabled: busy, style: { border: 0, margin: 0, padding: 0 } },
          h('legend', { style: s.text }, 'Energi i dag · 1 lav, 5 høj'),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 } },
            ...[1, 2, 3, 4, 5].map(value => scoreButton('Energi', value,
              Number(fastInput?.energy) === value, event => selectEnergy(value, event))))),
        h('p', { style: s.text }, `Motivation ${fastInput?.motivation} · Stress ${fastInput?.stress} · Ømhed ${fastInput?.soreness_level} · samme som i går (forslag).`),
        h('button', { type: 'button', style: s.secondary, disabled: busy, onClick: event => {
          if (!current() || control.current !== renderedController || busy) return
          if (open) setQuick(false)
          else launch('readiness')(event)
        } }, 'Ret øvrige svar'),
        state?.message && h('p', { role: state.phase === 'save-error' ? 'alert' : 'status', style: s.text },
          state.phase === 'save-error' && props.readinessError || state.message),
        state?.phase === 'pending' && h('button', { type: 'button', style: s.secondary,
          onClick: () => { if (current() && control.current === renderedController) control.current?.undo() } }, 'Fortryd'),
        h('button', { type: 'submit', style: s.primary, disabled: busy || !fastInput?.energy },
          busy ? state?.phase === 'pending' ? 'Gemmer om 5 sekunder…' : 'Gemmer…' : 'Gem dagsform'))),
    open && !fast && h('section', { id: `${id}-panel`, style: { ...s.card, marginTop: 12, marginBottom: 0 },
      'aria-labelledby': `${id}-heading`, onKeyDown: event => { if (event.key === 'Escape') close() } },
    h('h2', { id: `${id}-heading`, ref: heading, tabIndex: -1, style: s.heading }, open === 'readiness' ? 'Dagsform' : 'Vægt i dag'),
    done || saved ? h('p', { role: 'status', style: s.text }, open === 'readiness' ? readinessReceipt : 'Logget i dag') : !draft ? h('div', null,
      h('p', { role: state?.phase === 'error' ? 'alert' : 'status', style: s.text }, state?.phase === 'error'
        ? 'Dagsformen kunne ikke hentes sikkert. Prøv igen.' : 'Henter dine registreringer…'),
      state?.phase === 'error' && h('button', { type: 'button', style: s.secondary,
        onClick: () => { close(); props.onRetry?.() } }, 'Prøv igen')) :
      h('form', { onSubmit: event => { event.preventDefault(); if (current() && available(open) &&
        control.current === renderedController) control.current?.save(open) }, 'aria-busy': busy },
        h('p', { style: s.text }, (open === 'weight' ? state.weightSource : state.readinessSource) === 'yesterday'
          ? 'Forslag fra i går · kontrollér før du gemmer.' : 'Gem kun det, du vil registrere.'),
        repeat && h('button', { type: 'button', disabled: busy, style: s.secondary,
          onClick: () => { if (current() && available(open) && control.current === renderedController &&
            control.current.sameAsYesterday()) mirror(open, control.current.snapshot().draft) } }, 'Samme som i går'),
        open === 'weight' ? h('label', { style: s.text }, 'Vægt (kg)', h('input', {
          type: 'text', inputMode: 'decimal', value: draft.weight, disabled: busy, style: inputStyle,
          onChange: event => edit('weight', 'weight', event.target.value) })) :
          h('div', null,
            h('label', { style: s.text }, 'Søvn (timer, valgfrit)', h('input', {
              type: 'text', inputMode: 'decimal', value: readinessInput.sleep_hours ?? '', disabled: busy, style: inputStyle,
              onChange: event => edit('readiness', 'sleep_hours', event.target.value) })),
            ...fields.map(([key, label, low, high]) => h('fieldset', { key, disabled: busy, style: { border: 0, margin: '12px 0', padding: 0 } },
              h('legend', { style: s.text }, `${label} · 1 ${low.toLowerCase()}, 5 ${high.toLowerCase()}`),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 } },
                ...[1, 2, 3, 4, 5].map(value => scoreButton(label, value,
                  Number(readinessInput[key]) === value, () => edit('readiness', key, String(value)))))))),
        !(state.phase === 'save-error' && attempt?.weightReturned) &&
          h('p', { role: state.phase === 'save-error' ? 'alert' : 'status', 'aria-live': 'polite', style: s.text },
            (state.phase === 'save-error' && open === 'readiness' && props.readinessError) || state.message || ''),
        state.phase === 'pending' && h('button', { type: 'button', style: s.secondary,
          onClick: () => { if (current() && control.current === renderedController) control.current?.undo() } }, 'Fortryd'),
        h('button', { type: 'submit', disabled: busy, style: s.primary }, busy ? state.phase === 'pending' ? 'Gemmer om 5 sekunder…' : 'Gemmer…' : 'Gem')),
    h('button', { type: 'button', style: s.secondary, disabled: busy, onClick: close }, 'Luk')))
}
