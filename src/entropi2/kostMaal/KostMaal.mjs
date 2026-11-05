import { antalOrd } from '../antalOrd.mjs'
import { createElement as h, useRef, useState } from 'react'
import { energySuggestion } from './energySuggestion.mjs'
import { nutritionBasis, nutritionWeek, nutritionGoalWeek } from './nutritionWeek.mjs'
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
  const [helpRequested, setHelpRequested] = useState(false)
  const weightReady = props.weightState == null || props.weightState === 'ready'
  const model = kostMaalModel({ athlete, weightLogs: weightReady ? weightLogs : [], today })
  const suggestion = proteinSuggestion(model)
  const basis = nutritionBasis(props)
  const week = nutritionWeek(props, basis)
  const goalWeek = nutritionGoalWeek(props, basis)
  const energy = weightReady ? energySuggestion(model, week, basis) : { kcal: null }
  const showEnergy = basis.state === 'ready' && weightReady && (energy.kcal !== null || helpRequested)
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
    (model.kcal !== null || model.protein !== null) && h('dl', null,
      model.kcal !== null && value('Energi', `${displayNumber(model.kcal)} kcal`),
      model.protein !== null && value('Protein', `${displayNumber(model.protein)} g`)),
    basis.state !== 'ready' && h('p', { role: basis.state === 'error' ? 'alert' : 'status' }, basis.text),
    week && h('p', null, week.text),
    goalWeek && h('p', null, goalWeek.text),
    basis.skipped > 0 && h('p', { role: 'status' }, basis.skipped === 1
      ? '1 ugyldigt måltid er udeladt fra kostgrundlaget.'
      : `${basis.skipped} ugyldige måltider er udeladt fra kostgrundlaget.`),
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
        } } }, model.kcal === null && model.protein === null ? 'Sæt kostmål' : 'Rediger'),
    !connected && h('p', { role: 'status' }, 'Redigering af mål skal tilsluttes af coachen.'),
    h('h3', null, 'Vægtgrundlag'),
    !weightReady && h('p', { role: props.weightState === 'error' ? 'alert' : 'status' },
      props.weightState === 'error' ? 'Vægtgrundlaget kunne ikke hentes.' : 'Indlæser vægtgrundlag…'),
    props.weightState === 'error' && typeof props.retryWeight === 'function' && h('button', {
      type: 'button', style: button, onClick: props.retryWeight }, 'Hent vægt igen'),
    (model.bodyweight !== null || model.latest) && h('dl', null,
      model.bodyweight !== null && value('Kropsvægt i profilen', `${displayNumber(model.bodyweight)} kg`),
      model.latest && value('Seneste vejning', `${displayNumber(model.latest.weight)} kg · ${model.latest.date}`),
      model.average !== null && value('Ugegennemsnit · seneste 7 dage', `${displayNumber(model.average)} kg · ${model.days} ${antalOrd(model.days, 'vejedag', 'vejedage')}`),
      model.trend !== null && value('Trend · mod de foregående 7 dage',
        Math.abs(model.trend) < 0.05 ? 'Stabil vægt · 0 kg' : `${model.trend > 0 ? '+' : ''}${displayNumber(model.trend)} kg`)),
    weightReady && model.day && !model.latest && h('p', null, 'Ingen vejninger endnu.'),
    weightReady && !model.day && h('p', { role: 'status' }, 'Vælg en gyldig dagsdato for vægtgrundlaget.'),
    suggestion && h('p', null, `Forslag: ${displayNumber(suggestion.min)} til ${displayNumber(suggestion.max)} g protein (1,6 til 2,2 g pr. kg ud fra ${displayNumber(suggestion.weight)} kg)`),
    active && suggestion && h('button', { type: 'button', style: button, disabled: locked || !connected,
      onClick: () => {
        if (!locked && !pending.current && connected && active) {
          setError(''); setEditData(previous => ({ ...previous, protein_target: suggestion.midpoint }))
        }
      } }, 'Brug forslag'),
    basis.state === 'ready' && weightReady && !showEnergy && h('button', { type: 'button', style: button,
      onClick: () => setHelpRequested(true) }, 'Hjælp til energimål'),
    showEnergy && h('div', null, h('h3', null, 'Hjælp til energimål'),
      h('p', null, energy.kcal !== null ? energy.text
        : 'Log en gyldig vejning og mindst 4 kostdage med gyldigt indtag i de seneste 7 dage for at få et energiforslag.')),
    energy.kcal !== null && active && h('button', { type: 'button', style: button,
      'aria-label': 'Brug forslag til energimål', disabled: locked || !connected,
      onClick: () => {
        if (!locked && !pending.current && connected && active) {
          setError(''); setEditData(previous => ({ ...previous, kcal_target: energy.kcal }))
        }
      } }, 'Brug forslag'),
    weightReady && model.latest && h('details', null, h('summary', { style: { minHeight: 44 } }, 'Om vægtgrundlaget'),
      h('p', null, `Grundlag til og med ${model.day}. Trenden kræver mindst 2 vejedage i hver af to på hinanden følgende 7-dagesperioder og er forskellen mellem ugegennemsnittene.`)))
}
