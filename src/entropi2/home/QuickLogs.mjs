import { createElement as h, useEffect, useId, useRef, useState } from 'react'
import { calendarDay } from '../../calendarDate.js'
import { homeStyles as s } from './homeStyles.mjs'
import { quickLogError, quickLogStatus } from './quickLogModel.mjs'

const fields = [['energy', 'Energi', 'Lav', 'Høj'], ['motivation', 'Motivation', 'Lav', 'Høj'],
  ['stress', 'Stress', 'Lav', 'Høj'], ['soreness', 'Ømhed', 'Ingen', 'Meget']]
const inputStyle = { ...s.secondary, boxSizing: 'border-box', padding: 12, background: '#171814', color: '#edeae2' }
const clock = () => new Date()

// The parent owns drafts and the existing save functions. No new persistence path.
// Weight's existing handler clears its input ONLY after a confirmed write;
// readiness's handler supplies the confirmed dated record. Promise resolution
// alone is never treated as a successful save (both handlers return undefined).
export default function QuickLogs(props) {
  const [open, setOpen] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [error, setError] = useState(null)
  const [savedWeightDay, setSavedWeightDay] = useState(null)
  const latest = useRef(props), active = useRef(false), pending = useRef(false), choice = useRef(null)
  const opener = useRef(null), heading = useRef(null)
  const id = useId()
  latest.current = props
  const { enabled, athlete, today } = props
  const weightInput = enabled === true && athlete?.id ? props.weightInput ?? '' : ''
  useEffect(() => {
    if (enabled !== true || !athlete?.id) return
    active.current = true
    // Athlete loading already fetches weight logs; reuse the parent's records.
    return () => { active.current = false }
  }, [enabled, athlete?.id])
  useEffect(() => { if (open) heading.current?.focus() }, [open])
  useEffect(() => {
    if (attempt?.kind === 'weight' && attempt.finished && weightInput === '') setSavedWeightDay(attempt.day)
  }, [attempt, weightInput])
  const status = quickLogStatus(props)
  if (!status) return null
  const { readinessInput = {}, savingReadiness, savingWeight } = props
  const busy = pending.current || savingReadiness || savingWeight
  const weightDone = status.weight || savedWeightDay === today ||
    (attempt?.kind === 'weight' && attempt.finished && attempt.day === today && weightInput === '')
  const done = open === 'readiness' ? status.readiness : weightDone
  const current = () => active.current && latest.current.enabled === true &&
    latest.current.athlete?.id === athlete.id && latest.current.today === today &&
    calendarDay((latest.current.getNow ?? clock)()) === today
  const available = kind => kind === 'readiness'
    ? typeof props.saveReadiness === 'function' && typeof props.setReadinessInput === 'function'
    : typeof props.logWeight === 'function' && typeof props.setWeightInput === 'function'
  const close = () => {
    if (active.current && latest.current.enabled === true && latest.current.athlete?.id === athlete.id && !busy && !pending.current) {
      choice.current = null; setOpen(null); setError(null); opener.current?.focus()
    }
  }
  const launch = kind => event => {
    if (!current() || pending.current || !available(kind)) return
    opener.current = event.currentTarget
    choice.current = kind
    setAttempt(null); setError(null); setOpen(kind)
  }
  const submit = async event => {
    event.preventDefault()
    if (!active.current || choice.current !== open) return
    if (!current()) { setError('En ny dag er startet. Åbn formularen igen fra Hjem.'); return }
    const confirmed = quickLogStatus(latest.current)
    if (pending.current || busy || done || confirmed?.[open] || !available(open)) return
    const validation = quickLogError(open, latest.current)
    if (validation) { setError(validation); return }
    pending.current = true
    setError(null); setAttempt({ kind: open, day: today, finished: false })
    try {
      await (open === 'readiness' ? latest.current.saveReadiness() : latest.current.logWeight())
      if (current()) setAttempt({ kind: open, day: today, finished: true })
    } catch {
      if (current()) { setAttempt(null); setError('Kunne ikke gemme. Tjek din forbindelse og prøv igen.') }
    } finally { pending.current = false }
  }
  const failure = error || (!done && open === 'readiness' && props.readinessError) ||
    // logWeight reports resolved write failures through the app's existing flash.
    (!done && open === 'readiness' && attempt?.finished && 'Kunne ikke gemme. Tjek din forbindelse og prøv igen.')
  const rowButton = (kind, label, logged) => h('button', { type: 'button',
    style: { ...s.secondary, marginTop: 0, whiteSpace: 'nowrap', minWidth: 0 },
    'aria-label': logged ? `${label} · Logget i dag` : label,
    'aria-expanded': open === kind, 'aria-controls': open ? `${id}-panel` : undefined,
    title: logged ? 'Logget i dag' : undefined, disabled: busy || !available(kind), onClick: launch(kind) },
  label, logged && h('span', { 'aria-hidden': true }, ' ✓'))
  return h('div', { 'data-home-quick-logs': '', style: { marginBottom: 20 } },
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }, 'aria-label': 'Log i dag' },
      rowButton('readiness', 'Dagsform', status.readiness), rowButton('weight', 'Vægt i dag', weightDone)),
    open && h('section', { id: `${id}-panel`, style: { ...s.card, marginTop: 12, marginBottom: 0 },
      'aria-labelledby': `${id}-heading`, onKeyDown: event => { if (event.key === 'Escape') close() } },
    h('h2', { id: `${id}-heading`, ref: heading, tabIndex: -1, style: s.heading }, open === 'readiness' ? 'Dagsform' : 'Vægt i dag'),
    done ? h('p', { role: 'status', style: s.text }, 'Logget i dag') :
      h('form', { onSubmit: submit, 'aria-busy': Boolean(busy) },
        open === 'weight' ? h('label', { style: s.text }, 'Vægt (kg)', h('input', {
          type: 'text', inputMode: 'decimal', value: weightInput, disabled: busy, style: inputStyle,
          onChange: event => { if (current() && choice.current === 'weight' && !pending.current) latest.current.setWeightInput(event.target.value) } })) :
          h('div', null,
            h('label', { style: s.text }, 'Søvn (timer, valgfrit)', h('input', {
              type: 'text', inputMode: 'decimal', value: readinessInput.sleep ?? '', disabled: busy, style: inputStyle,
              onChange: event => { if (current() && choice.current === 'readiness' && !pending.current) latest.current.setReadinessInput(input => ({ ...input, sleep: event.target.value })) } })),
            ...fields.map(([key, label, low, high]) => h('fieldset', { key, disabled: busy, style: { border: 0, margin: '12px 0', padding: 0 } },
              h('legend', { style: s.text }, `${label} · 1 ${low.toLowerCase()}, 5 ${high.toLowerCase()}`),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 } },
                ...[1, 2, 3, 4, 5].map(value => h('button', { key: value, type: 'button',
                  'aria-pressed': Number(readinessInput[key]) === value, 'aria-label': `${label} ${value}`,
                  style: { ...s.secondary, minWidth: 44, marginTop: 0, padding: 0,
                    background: Number(readinessInput[key]) === value ? '#414139' : 'transparent' },
                  onClick: () => { if (current() && choice.current === 'readiness' && !pending.current) latest.current.setReadinessInput(input => ({ ...input, [key]: value })) } }, String(value))))))),
        failure && h('p', { role: 'alert', style: s.text }, failure),
        h('button', { type: 'submit', disabled: busy, style: s.primary }, busy ? 'Gemmer…' : 'Gem')),
    h('button', { type: 'button', style: s.secondary, disabled: busy, onClick: close }, 'Luk')),
    !open && error && h('p', { role: 'alert', style: s.text }, error))
}
