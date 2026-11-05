import { antalOrd } from '../entropi2/antalOrd.mjs'
import { createElement as h, useState, useEffect } from 'react'
import { sessionLadder } from '../opvarmStige.mjs'
import { WARMUP_BASE } from './mobilityCatalog.mjs'

// Local style values from athleteShared.js; keep the closed trin1 fixture import graph unchanged.
const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300 },
  logo: { fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' },
  card: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.25rem', marginBottom: '1.5rem' },
  cardLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' },
  btnPrimary: { background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
}

const mobility = {
  Squat: ['Squat', ['sq-mob-2', 'sq-mob-3']],
  Bænkpres: ['Bænkpres', ['bp-mob-1', 'bp-mob-2']],
  Dødløft: ['Dødløft — Konventionel', ['dk-mob-1', 'dk-mob-3']],
  'Sumo dødløft': ['Dødløft — Sumo', ['ds-mob-1', 'ds-mob-2']],
}
const button = { ...s.btnPrimary, minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left', margin: '4px 8px 4px 0' }
const format = value => String(value).replace('.', ',')
export function timerSeconds(deadline, now = Date.now()) {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000))
}
function Ladder({ plan }) {
  const [checked, setChecked] = useState({})
  const [deadline, setDeadline] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [mobilitySkipped, setMobilitySkipped] = useState(false)
  const [timerKind, setTimerKind] = useState('pause')
  useEffect(() => {
    if (deadline === null) return
    const tick = () => { const next = timerSeconds(deadline); setSeconds(next); if (!next) setDeadline(null) }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])
  const start = (duration, kind = 'pause') => { setTimerKind(kind); setSeconds(duration); setDeadline(Date.now() + duration * 1000) }
  const skipMobility = () => {
    setMobilitySkipped(true)
    if (timerKind === 'mobility') { setDeadline(null); setSeconds(0) }
  }
  const [key, ids] = mobility[plan.lift]
  const catalog = WARMUP_BASE[key].flatMap(slot => slot.options)
  return h('section', { 'aria-label': 'Opvarmningsstige', style: { ...s.card, color: s.wrap.color, fontFamily: s.wrap.fontFamily, fontWeight: s.wrap.fontWeight, textAlign: 'left', lineHeight: 1.5, overflowWrap: 'anywhere', minWidth: 0 } },
    h('h3', { style: { ...s.logo, fontWeight: 400 } }, `Opvarmningsstige · ${plan.lift}`),
    h('p', null, `Planlagt topsæt: ${format(plan.plannedWeight)} kg. 20 kg stang; pladerne vises pr. side.`),
    !mobilitySkipped && h('section', { 'aria-label': 'Mobilitet før opvarmningsstigen' },
      h('h4', { style: s.cardLabel }, 'Før første trin: 2 minutters mobilitet'),
      h('ol', null, ...ids.map(id => {
        const ex = catalog.find(item => item.id === id)
        return h('li', { key: id }, h('strong', null, `${ex.name} · ${ex.label}`), h('p', null, ex.desc))
      })),
      h('button', { type: 'button', style: button, onClick: () => start(120, 'mobility') }, 'Start 2 minutters mobilitet'),
      h('button', { type: 'button', style: button, onClick: skipMobility }, 'Spring mobilitet over')),
    h('ol', null, ...plan.steps.map((step, index) => h('li', { key: step.weight, style: { padding: '8px 0' } },
      h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, cursor: 'pointer' } }, h('input', { type: 'checkbox', style: { accentColor: '#c8923a', width: 20, height: 20, flexShrink: 0, margin: 0 }, checked: !!checked[index], onChange: event => setChecked(previous => ({ ...previous, [index]: event.target.checked })) }),
        ` ${format(step.weight)} kg × ${step.reps} reps`),
      h('div', null, step.plates.length ? `Pr. side: ${step.plates.map(plate => `${plate.count} × ${format(plate.kg)} kg`).join(' + ')}` : 'Tom stang · ingen plader'),
      h('div', null, `I alt pr. side: ${format(step.plates.reduce((kg, plate) => kg + plate.kg * plate.count, 0))} kg · antal skiver: ${step.plates.reduce((count, plate) => count + plate.count, 0)}`)))),
    h('p', null, 'Valgfri pause mellem trinnene'),
    h('button', { type: 'button', style: button, onClick: () => start(60) }, 'Start 60 sekunders pause'),
    h('button', { type: 'button', style: button, onClick: () => { setDeadline(null); setSeconds(0) } }, 'Stop timer'),
    h('p', { role: 'timer', 'aria-label': 'Tid tilbage' }, `${seconds} ${antalOrd(seconds, 'sekund', 'sekunder')}`))
}
export default function OpvarmStige({ enabled = false, exercises, scope }) {
  if (enabled !== true) return null
  const plan = sessionLadder(exercises)
  return plan ? h(Ladder, { key: JSON.stringify([scope, plan]), plan }) : null
}
