import { antalOrd } from '../../antalOrd.mjs'
import * as React from 'react'
import { mountExistingTracker } from './trackerAdapter.mjs'

const { createElement: h, useEffect, useRef, useState, useSyncExternalStore } = React

const control = { minHeight: 44, minWidth: 44, maxWidth: '100%', whiteSpace: 'normal', font: 'inherit' }
const number = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
const metricLabels = [['kcal', 'Energi', 'kcal'], ['protein', 'Protein', 'g'], ['carb', 'Kulhydrat', 'g'], ['fat', 'Fedt', 'g']]
const macros = values => values ? `${number(values.kcal)} kcal · ${number(values.protein)} g protein · ${number(values.carb)} g kulhydrat · ${number(values.fat)} g fedt`
  : 'Næringsdata mangler eller gram er ugyldige.'
const button = (text, onClick, disabled = false, props = {}) => h('button', { type: 'button', style: control, onClick, disabled, ...props }, text)

// Pure controlled React view: the same handlers are exercised in the synthetic
// interaction tests; the normal app test runner also discovers real React tests.
export function KostplanAtletView(props = {}) {
  if (props.enabled !== true) return null
  const { snapshot: s, onRetry, onEaten, onEdit, onGrams, onConfirmNotLogged } = props
  if (!s) return h('p', { role: 'alert' }, 'Dagens kost er ikke tilsluttet.')
  if (s.phase === 'idle' || s.phase === 'loading') return h('p', { role: 'status', 'aria-busy': true }, 'Henter dagens kost…')
  if (s.phase === 'load-error') return h('div', null,
    h('p', { role: 'alert' }, s.message), button('Hent dagen igen', onRetry))
  if (s.mode === 'tracker') return props.tracker || h('p', { role: 'alert' }, 'Kcal-trackeren er ikke tilsluttet.')
  return h('section', { 'aria-label': 'Dagens kostplan', 'aria-busy': s.pending,
    style: { maxWidth: '42rem', width: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere', padding: 16 } },
  h('h1', null, 'Dagens kostplan'),
  h('p', null, 'Aktiv plans indhold · godkendte portioner. Profilens mål ændres ikke.'),
  h('time', { dateTime: s.date }, new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(s.date + 'T00:00:00Z'))),
  h('section', { 'aria-label': 'Dagens status' },
    h('h2', null, 'Dagens status'),
    h('p', null, `${s.eatenCount} af ${s.meals.length} ${antalOrd(s.meals.length, 'måltid', 'måltider')} spist`),
    h('p', { 'aria-live': 'polite' }, `Tilbage i dag: ${s.remaining.kcal === null ? 'kcal ukendt' : `${number(s.remaining.kcal)} kcal`} · ${s.remaining.protein === null ? 'protein ukendt' : `${number(s.remaining.protein)} g protein`}`),
    h('details', null,
    h('summary', { style: { ...control, paddingBlock: 12, cursor: 'pointer' } }, 'Registreret og mål'),
    ...metricLabels.map(([key, label, unit]) => h('p', { key }, `${label}: ${s.totals[key] === null ? 'ukendt' : number(s.totals[key])} ${unit} / ${s.targets[key] === null ? 'mål mangler' : `${number(s.targets[key])} ${unit}`}`)),
    s.targets.kcal > 0 && s.totals.kcal !== null && h('progress', { max: s.targets.kcal, value: Math.min(s.targets.kcal, s.totals.kcal), 'aria-label': 'Registreret energi i forhold til dagens mål', style: { width: '100%' } })),
    h('p', null, 'Status viser kun registrerede måltider. Planlagte måltider tæller først, når de er spist.')),
  s.message && h('p', { role: ['save-error', 'uncertain'].includes(s.phase) ? 'alert' : 'status', 'aria-live': 'polite' }, s.message),
  s.phase === 'uncertain' && button('Hent dagen igen', onRetry),
  !s.canSave && h('p', { role: 'alert' }, 'Registrering af planmåltider er ikke tilsluttet.'),
  s.meals.some(meal => meal.blocked) && h('details', null,
    h('summary', { style: { ...control, paddingBlock: 12, cursor: 'pointer' } }, 'Kontrollér kostloggen'),
    props.tracker || h('p', { role: 'alert' }, 'Åbn den eksisterende kcal-tracker for at kontrollere måltidet.')),
  !s.meals.length && h('p', null, 'Der er ingen måltider i dagens aktive plan. Tal med din coach.'),
  ...s.meals.map(meal => h('section', { key: meal.id, 'aria-label': meal.name,
    style: { border: '1px solid currentColor', borderRadius: 12, padding: 16, marginTop: 16 } },
    h('h2', null, meal.name),
    h('ul', null, ...meal.foods.map(food => h('li', { key: food.id }, `${food.name} · ${typeof food.grams === 'number' ? number(food.grams) : food.grams} g`))),
    h('p', null, macros(meal.values)),
    meal.eaten ? h('p', { role: 'status' }, 'Spist') : h('div', null,
      meal.blocked && h('div', null,
        h('p', { role: 'alert' }, 'Registreringen er uafklaret eller ændret i kostloggen. Kontrollér kostloggen før du prøver igen.'),
        s.canRelease && button('Måltidet står ikke i kostloggen – lås op', () => onConfirmNotLogged?.(meal.id), s.pending,
          { 'aria-label': `${meal.name}: Måltidet står ikke i kostloggen – lås op` })),
      button(s.pending ? 'Gemmer…' : meal.adjusted ? 'Spist med rettede gram' : 'Spist som planlagt', () => onEaten?.(meal.id), !meal.canSave,
        { 'aria-label': `${meal.name}: ${meal.adjusted ? 'Spist med rettede gram' : 'Spist som planlagt'}` }),
      h('details', { open: meal.editing,
        onToggle: event => { if (event.currentTarget.open !== meal.editing) onEdit?.(meal.id) } },
      h('summary', { style: { ...control, paddingBlock: 12, cursor: 'pointer' } }, `Ret gram: ${meal.name}`),
      ...meal.foods.map(food => h('label', { key: food.id, style: { display: 'block', marginBlock: 12 } },
        `${food.name} (g)`,
        h('input', { type: 'text', inputMode: 'decimal', value: food.grams,
          disabled: s.pending || s.phase === 'uncertain' || meal.blocked,
          'aria-label': `${meal.name}: ${food.name} (g)`, style: { ...control, width: '100%', boxSizing: 'border-box' },
          onChange: event => onGrams?.(meal.id, food.id, event.currentTarget.value) }))),
      !meal.values && h('p', { role: 'alert' }, 'Angiv gyldige gram og kendte næringsdata før du markerer måltidet som spist.'))))))
}

function ExistingTracker({ athleteId, date, options }) {
  const root = useRef(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    setError(false)
    // Never mount another athlete or day through this fallback seam.
    if (options?.athlete?.id !== athleteId || options?.date !== date) { setError(true); return }
    try { return mountExistingTracker(root.current, { ...options, enabled: true }) }
    catch { setError(true) }
  }, [athleteId, date, options])
  return h('div', null, error && h('p', { role: 'alert' }, 'Kcal-trackeren kunne ikke åbnes. Åbn kosten igen.'),
    h('div', { ref: root }))
}

function DaySession({ controller, trackerOptions }) {
  const s = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  // Loading is owned by the caller. Rendering and React StrictMode do not write
  // or dispose this externally owned controller.
  return h(KostplanAtletView, { enabled: true, snapshot: s,
    onRetry: controller.load, onEaten: controller.markEaten, onEdit: controller.toggleEdit, onGrams: controller.setGrams,
    onConfirmNotLogged: controller.confirmNotLogged,
    tracker: h(ExistingTracker, { athleteId: s.athleteId, date: s.date, options: trackerOptions }) })
}

export default function KostplanAtlet(props = {}) {
  if (props.enabled !== true) return null
  if (!props.controller) return h('p', { role: 'alert' }, 'Dagens kost er ikke tilsluttet.')
  return h(DaySession, { controller: props.controller, trackerOptions: props.trackerOptions })
}
