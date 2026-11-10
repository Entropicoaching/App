import * as React from 'react'
import { readWaterGoal, saveWaterGoal, waterGoalLimits, waterGoalValue, waterProgress } from './waterGoalModel.mjs'

const h = React.createElement
const { useEffect, useMemo, useState } = React
const control = { minHeight: 44, minWidth: 44, font: 'inherit', maxWidth: '100%', boxSizing: 'border-box', background: '#1c1c18', color: '#edeae2', border: '1px solid #414139', borderRadius: 8, padding: '8px 14px' }
const ml = value => new Intl.NumberFormat('da-DK').format(Math.round(value))

// Et glas, der fyldes op mod målet. Kun visning; tallet står også som tekst.
export function WaterGlass({ fraction, reached }) {
  const height = 112, top = 8, fill = Math.round(height * Math.max(0, Math.min(1, fraction)))
  return h('svg', { width: 72, height: 132, viewBox: '0 0 72 132', role: 'img',
    'aria-label': reached ? 'Glasset er fyldt: mål nået' : `Glasset er fyldt ${Math.round(fraction * 100)} procent`,
    'data-water-fill': String(Math.round(fraction * 100)), style: { flex: '0 0 auto' } },
  h('defs', null, h('clipPath', { id: 'e2-water-glass' }, h('path', { d: 'M8 8 L64 8 L58 124 L14 124 Z' }))),
  h('rect', { x: 0, y: top + height - fill, width: 72, height: fill, fill: reached ? '#5fb38a' : '#4a90c8', clipPath: 'url(#e2-water-glass)' }),
  h('path', { d: 'M8 8 L64 8 L58 124 L14 124 Z', fill: 'none', stroke: '#edeae2', strokeWidth: 3, strokeLinejoin: 'round' }))
}

// Væskemål øverst i væskekortet. add(ml) er væskeloggens egen tilføjelse.
export default function WaterGoal({ athleteId, storage, totalMl, add, canAdd, serverGoal, onGoalSaved }) {
  const device = useMemo(() => {
    try { return storage === undefined ? globalThis.localStorage : storage } catch { return null }
  }, [storage])
  const [goal, setGoal] = useState(() => readWaterGoal(device, athleteId))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')
  // U7: med tabellen er målet i databasen det gældende; telefonen får en kopi til brug uden net.
  useEffect(() => {
    if (serverGoal == null) return
    setGoal(current => current === serverGoal ? current : (saveWaterGoal(device, athleteId, String(serverGoal)), serverGoal))
  }, [serverGoal, device, athleteId])
  const p = waterProgress(totalMl, goal)
  const save = event => {
    event.preventDefault()
    if (waterGoalValue(draft) === null) { setMessage(`Skriv et mål mellem ${ml(waterGoalLimits.min)} og ${ml(waterGoalLimits.max)} ml.`); return }
    const saved = saveWaterGoal(device, athleteId, draft)
    if (saved === null) { setMessage('Målet kunne ikke gemmes på denne enhed. Prøv igen.'); return }
    setGoal(saved); setEditing(false); setDraft(''); setMessage('')
    onGoalSaved?.(saved)
  }
  const form = h('form', { onSubmit: save, style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' } },
    h('label', { style: { display: 'block' } }, 'Dagens væskemål (ml)',
      h('input', { type: 'text', inputMode: 'numeric', value: draft, 'aria-label': 'Dagens væskemål i milliliter',
        placeholder: goal ? String(goal) : 'fx aftalt med din coach', style: { ...control, display: 'block', width: '12rem' },
        onChange: event => { setDraft(event.currentTarget.value); setMessage('') } })),
    h('button', { type: 'submit', style: control }, 'Gem mål'),
    goal && h('button', { type: 'button', style: control, onClick: () => { setEditing(false); setDraft(''); setMessage('') } }, 'Annuller'))
  return h('section', { 'aria-label': 'Væskemål', 'data-water-goal': goal ? String(goal) : '',
    style: { padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' } },
  h(WaterGlass, { fraction: p.fraction, reached: p.reached }),
  h('div', { style: { flex: '1 1 12rem', minWidth: 0 } },
    h('h2', { style: { color: '#edeae2', margin: '0 0 4px' } }, 'Dit væskemål'),
    !goal && !editing && h('div', null,
      h('p', null, `Du har drukket ${ml(p.total)} ml. Sæt et dagligt mål, så fyldes glasset op.`),
      h('p', null, 'Aftal tallet med din coach. Når kostbilaget er klar, står anbefalingen her.')),
    goal && h('p', { role: 'status', 'aria-live': 'polite', style: { fontSize: '1.15em', margin: '4px 0' } },
      p.reached ? `Mål nået (${ml(goal)} ml).` : `${ml(p.total)} af ${ml(goal)} ml. ${ml(p.missing)} ml tilbage.`),
    (!goal || editing) && form,
    message && h('p', { role: 'alert' }, message),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 } },
      ...[250, 500].map(amount => h('button', { key: amount, type: 'button', style: control, disabled: !canAdd,
        'aria-label': `Drukket ${amount} ml vand`, onClick: () => add?.(String(amount)) }, `+ ${amount} ml`)),
      goal && !editing && h('button', { type: 'button', style: control, onClick: () => { setEditing(true); setDraft(String(goal)) } }, 'Ret mål'))))
}
