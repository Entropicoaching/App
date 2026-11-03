import { createElement as h, useRef, useState } from 'react'
import { nutritionWeek } from './nutritionWeek.mjs'
import { DEFAULT_ENABLED, kostMaalModel, displayNumber, positive, validTargetDraft, proteinSuggestion } from './model.mjs'

const button = { minHeight: 44, padding: '10px 16px', font: 'inherit', border: '1px solid #777267', borderRadius: 8, color: 'inherit', background: '#282820', cursor: 'pointer' }
const input = { boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 44, padding: 10, font: 'inherit', color: 'inherit', background: '#141410', border: '1px solid #777267', borderRadius: 6 }

// Default OFF: do not read data, call callbacks, or mount the hooked editor.
export default function KostMaal(props = {}) {
  if (props.enabled !== true) return null
  return h(EnabledKostMaal, { ...props, key: props.athlete?.id })
}

function EnabledKostMaal(props) {
  const { enabled = DEFAULT_ENABLED, athlete, weightLogs, today,
    editing, editData = {}, startEdit, setEditData, setEditing, saveEdit, saving = false } = props
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const model = kostMaalModel({ athlete, weightLogs, today })
  const suggestion = proteinSuggestion(model)
  const week = nutritionWeek(props)
  const connected = typeof startEdit === 'function' && typeof setEditData === 'function' &&
    typeof setEditing === 'function' && typeof saveEdit === 'function' && athlete?.id != null
  const locked = saving || busy
  const active = editing === 'setup'
  const field = (key, label) => h('label', { key, style: { display: 'block', flex: '1 1 180px', minWidth: 0 } },
    label, h('input', { name: key, type: 'number', min: 1, max: 2147483647, step: 1,
      inputMode: 'numeric', style: input, value: editData[key] ?? '', disabled: locked || !connected,
      onChange: e => { if (!locked && connected) { setError(''); setEditData(p => ({ ...p, [key]: e.target.value })) } } }))
  const submit = async event => {
    event.preventDefault()
    if (enabled !== true || !connected || !active || locked || pending.current) return
    if (!validTargetDraft(editData)) { setError('Brug hele tal over 0 til målene, eller lad feltet stå tomt.'); return }
    pending.current = true; setBusy(true); setError('')
    try {
      // Deliberately zero arguments: saveEdit owns the existing controlled draft,
      // athlete selection, persistence, feedback and refresh. Void is not success.
      const result = await saveEdit()
      if (result === false) setError('Målene blev ikke gemt. Prøv igen.')
    } catch { setError('Målene blev ikke gemt. Prøv igen.') }
    finally { pending.current = false; setBusy(false) }
  }
  const value = (label, text) => h('div', { key: label }, h('dt', null, label),
    h('dd', { style: { margin: '4px 0 14px' } }, text))
  return h('section', { 'data-entropi2-kost-maal': true, 'aria-label': 'Kostmål og vægtgrundlag',
    style: { boxSizing: 'border-box', width: '100%', minWidth: 0, padding: 16, color: '#edeae2', background: '#1c1c18', borderRadius: 12, lineHeight: 1.5, overflowWrap: 'anywhere' } },
    h('h2', null, 'Kostmål'),
    h('dl', null,
      value('Energi', model.kcal === null ? 'Ingen mål endnu' : `${displayNumber(model.kcal)} kcal`),
      value('Protein', model.protein === null ? 'Ingen mål endnu' : `${displayNumber(model.protein)} g`)),
    week && h('p', null, week.text),
    active ? h('form', { onSubmit: submit, 'aria-busy': Boolean(locked) },
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } }, field('kcal_target', 'Kcal-mål'), field('protein_target', 'Proteinmål (g)')),
      h('p', null, 'Et tomt felt fjerner målet.'),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12 } },
        h('button', { type: 'button', style: button, disabled: locked || !connected,
          onClick: () => { if (!locked && connected) { setError(''); setEditing(null) } } }, 'Annuller'),
        h('button', { type: 'submit', style: button, disabled: locked || !connected }, locked ? 'Gemmer…' : 'Gem')),
      error && h('p', { role: 'alert' }, error)) : h('button', { type: 'button', style: button, disabled: locked || !connected,
        onClick: () => { if (!locked && connected) {
          setError(''); startEdit('setup', {
            kcal_target: positive(athlete.kcal_target) === null ? '' : athlete.kcal_target,
            protein_target: positive(athlete.protein_target) === null ? '' : athlete.protein_target,
          })
        } } }, 'Rediger'),
    !connected && h('p', { role: 'status' }, 'Redigering af mål skal tilsluttes af coachen.'),
    h('h3', null, 'Vægtgrundlag'),
    h('dl', null,
      value('Kropsvægt i profilen', model.bodyweight === null ? 'Ingen kropsvægt angivet' : `${displayNumber(model.bodyweight)} kg`),
      value('Seneste vejning', model.latest ? `${displayNumber(model.latest.weight)} kg · ${model.latest.date}` : 'Ingen vejninger endnu'),
      value('Ugegennemsnit · seneste 7 dage', model.average === null ? 'Ingen vejninger i perioden' : `${displayNumber(model.average)} kg · ${model.days} vejedage`),
      value('Trend · mod de foregående 7 dage', model.trend === null ? 'Flere vejninger nødvendige' :
        Math.abs(model.trend) < 0.05 ? 'Stabil vægt · 0 kg' : `${model.trend > 0 ? '+' : ''}${displayNumber(model.trend)} kg`)),
    suggestion && h('p', null, `Forslag: ${displayNumber(suggestion.min)} til ${displayNumber(suggestion.max)} g protein (1,6 til 2,2 g pr. kg ud fra ${displayNumber(suggestion.weight)} kg)`),
    active && suggestion && h('button', { type: 'button', style: button, disabled: locked || !connected,
      onClick: () => {
        if (!locked && !pending.current && connected && active) {
          setError(''); setEditData(previous => ({ ...previous, protein_target: suggestion.midpoint }))
        }
      } }, 'Brug forslag'),
    model.day && h('p', null, `Grundlag til og med ${model.day}. Trenden er forskellen mellem to ugegennemsnit.`),
    ...model.actions.map(text => h('p', { key: text }, text)))
}
