import { createElement as h, useState } from 'react'

export const FRIDAY_CHECKS = Object.freeze([
  { id: 'program', label: 'Program, næste uge', screen: 'program', preview: true, hint: 'Åbn Program og vælg næste uge.' },
  { id: 'rest-day', label: 'En dag uden træning', screen: 'hjem', preview: true, hint: 'Se Hjem for en dag uden planlagt træning.' },
  { id: 'mobility', label: 'Mobilitet med valgt fokus', screen: 'mobilisering', preview: true, hint: 'Vælg fokus i Mobilitet.' },
  { id: 'analysis', label: 'Analyse med konklusionen først', screen: 'analyse', hint: 'Se konklusionen øverst i Analyse.' },
  { id: 'coach', label: 'Coachens oprydning', screen: 'list', hint: 'Se coachens forside og navigation.' },
  { id: 'timestamps', label: 'Tidsmarkeringer', screen: 'analyse', hint: 'Åbn en video i Analyse og prøv tidsmarkeringerne.' },
  { id: 'progress', label: 'Fremgang', screen: 'fremgang', preview: true, hint: 'Se atletens fremgang.' },
].map(item => Object.freeze(item)))

const control = { minHeight: 44, padding: '0.65rem', font: 'inherit', color: '#edeae2', background: '#24241e', border: '1px solid #777266', borderRadius: 4, cursor: 'pointer' }
const keyFor = coachId => typeof coachId === 'string' && coachId.trim() ? 'entropi:friday-checklist:v1:' + encodeURIComponent(coachId) : null
const localStore = () => globalThis.localStorage

export function readFridayChecks(coachId, storage) {
  const key = keyFor(coachId)
  if (!key) return { checked: {}, error: 'Log ind som coach for at gemme lokalt.' }
  try {
    const data = JSON.parse((storage || localStore()).getItem(key) || '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid checklist')
    return { checked: Object.fromEntries(FRIDAY_CHECKS.map(({ id }) => [id, data[id] === true])), error: '' }
  } catch {
    return { checked: {}, error: 'Tjeklisten kunne ikke læses lokalt. Dine valg kan ikke bekræftes som gemt.' }
  }
}

export function saveFridayCheck(coachId, checked, id, value, storage) {
  const key = keyFor(coachId)
  if (!key || !FRIDAY_CHECKS.some(item => item.id === id)) return { checked, error: 'Valget kunne ikke gemmes lokalt.' }
  const next = Object.fromEntries(FRIDAY_CHECKS.map(item => [item.id, item.id === id ? value === true : checked[item.id] === true]))
  try {
    (storage || localStore()).setItem(key, JSON.stringify(next))
    return { checked: next, error: '' }
  } catch {
    return { checked, error: 'Valget kunne ikke gemmes lokalt. Prøv igen.' }
  }
}

export function openFridayCheck(id, athleteId, { enabled = false, athletes = [], openProfile, onPreviewAthlete, setView }) {
  if (enabled !== true) return false
  const item = FRIDAY_CHECKS.find(item => item.id === id)
  if (!item) return false
  if (item.screen === 'list') { setView('list'); return true }
  const athlete = athletes.find(athlete => String(athlete.id) === athleteId)
  if (!athlete) return false
  if (item.preview) {
    if (!onPreviewAthlete) return false
    onPreviewAthlete(athlete.id, item.screen)
  } else openProfile(athlete, item.screen)
  return true
}

export function FridayChecklistEntry({ enabled = false, open }) {
  return enabled === true ? h('button', { type: 'button', style: control, onClick: open }, 'Fredagens tjekliste') : null
}

// Mount only inside the coach dashboard. The parent key isolates coach changes.
export function FridayChecklist({ enabled = false, ...props }) {
  return enabled === true ? h(Checklist, props) : null
}
function Checklist({ coachId, athletes = [], openProfile, onPreviewAthlete, setView, storage }) {
  const [saved, setSaved] = useState(() => readFridayChecks(coachId, storage))
  const [athleteId, setAthleteId] = useState('')
  const selected = athletes.some(athlete => String(athlete.id) === athleteId)
  return h('section', { 'aria-label': 'Fredagens tjekliste', style: { padding: '1rem', color: '#edeae2', maxWidth: 680 } },
    h('h1', null, 'Fredagens tjekliste'),
    h('p', null, 'Dine egne testnoter til fredag. Afkrydsning gemmes kun på denne enhed for din coachkonto.'),
    h('label', null, 'Testatlet ', h('select', { value: athleteId, style: { ...control, maxWidth: '100%' }, onChange: event => setAthleteId(event.target.value) },
      h('option', { value: '' }, 'Vælg atlet'),
      ...athletes.map(athlete => h('option', { key: athlete.id, value: String(athlete.id) }, athlete.name)))),
    h('p', null, 'Vælg en testatlet for at åbne atletens skærme. Vælg selv den relevante uge, dag eller video på skærmen.'),
    saved.error && h('p', { role: 'alert' }, saved.error),
    h('ul', { style: { paddingLeft: 20 } }, ...FRIDAY_CHECKS.map(item => h('li', { key: item.id, style: { marginBottom: 16 } },
      h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 } },
        h('input', { type: 'checkbox', checked: saved.checked[item.id] === true, onChange: event => setSaved(previous => saveFridayCheck(coachId, previous.checked, item.id, event.target.checked, storage)) }), item.label),
      h('p', null, item.hint),
      h('button', { type: 'button', role: 'link', style: control,
        disabled: item.screen !== 'list' && (!selected || (item.preview && !onPreviewAthlete)),
        onClick: () => openFridayCheck(item.id, athleteId, { enabled: true, athletes, openProfile, onPreviewAthlete, setView }) }, 'Åbn ' + item.label)))),
    h('button', { type: 'button', style: control, onClick: () => setView('list') }, 'Tilbage til coachens forside'))
}
