import { createElement as h, useState, useEffect } from 'react'
import { sessionLadder } from '../opvarmStige.mjs'
import { WARMUP_BASE } from './mobilityCatalog.mjs'

const mobility = {
  Squat: ['Squat', ['sq-mob-2', 'sq-mob-3']],
  Bænkpres: ['Bænkpres', ['bp-mob-1', 'bp-mob-2']],
  Dødløft: ['Dødløft — Konventionel', ['dk-mob-1', 'dk-mob-3']],
  'Sumo dødløft': ['Dødløft — Sumo', ['ds-mob-1', 'ds-mob-2']],
}
const button = { minHeight: 44, padding: 10, font: 'inherit', cursor: 'pointer' }
const format = value => String(value).replace('.', ',')
export function timerSeconds(deadline, now = Date.now()) {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000))
}
function Ladder({ plan }) {
  const [checked, setChecked] = useState({})
  const [deadline, setDeadline] = useState(null)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (deadline === null) return
    const tick = () => { const next = timerSeconds(deadline); setSeconds(next); if (!next) setDeadline(null) }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])
  const start = duration => { setSeconds(duration); setDeadline(Date.now() + duration * 1000) }
  const [key, ids] = mobility[plan.lift]
  const catalog = WARMUP_BASE[key].flatMap(slot => slot.options)
  return h('section', { 'aria-label': 'Opvarmningsstige', style: { padding: 12, border: '1px solid #736043', color: '#edeae2', overflowWrap: 'anywhere', marginBottom: 16 } },
    h('h3', null, `Opvarmningsstige · ${plan.lift}`),
    h('p', null, `Planlagt topsæt: ${format(plan.plannedWeight)} kg. 20 kg stang; pladerne vises pr. side.`),
    h('h4', null, 'Før første trin: 2 minutters mobilitet'),
    h('ol', null, ...ids.map(id => {
      const ex = catalog.find(item => item.id === id)
      return h('li', { key: id }, h('strong', null, `${ex.name} · 60 sekunder`), h('p', null, ex.desc))
    })),
    h('button', { type: 'button', style: button, onClick: () => start(120) }, 'Start 2 minutters mobilitet'),
    h('ol', null, ...plan.steps.map((step, index) => h('li', { key: step.weight, style: { padding: '8px 0' } },
      h('label', null, h('input', { type: 'checkbox', checked: !!checked[index], onChange: event => setChecked(previous => ({ ...previous, [index]: event.target.checked })) }),
        ` ${format(step.weight)} kg × ${step.reps} reps`),
      h('div', null, step.plates.length ? `Pr. side: ${step.plates.map(plate => `${plate.count} × ${format(plate.kg)} kg`).join(' + ')}` : 'Tom stang · ingen plader')))),
    h('p', null, 'Valgfri pause mellem trinnene'),
    h('button', { type: 'button', style: button, onClick: () => start(60) }, 'Start 60 sekunders pause'),
    h('button', { type: 'button', style: button, onClick: () => { setDeadline(null); setSeconds(0) } }, 'Stop timer'),
    h('p', { role: 'timer', 'aria-label': 'Tid tilbage' }, `${seconds} sekunder`))
}
export default function OpvarmStige({ enabled = false, exercises, scope }) {
  if (enabled !== true) return null
  const plan = sessionLadder(exercises)
  return plan ? h(Ladder, { key: JSON.stringify([scope, plan]), plan }) : null
}
