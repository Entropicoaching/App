import { createElement as h, useEffect, useId, useSyncExternalStore } from 'react'

const control = { minHeight: 48, minWidth: 44, padding: 12, font: 'inherit', border: '1px solid #929083',
  borderRadius: 8, background: '#262621', color: '#edeae2', boxSizing: 'border-box', maxWidth: '100%' }
const actions = { display: 'flex', flexWrap: 'wrap', gap: 8 }
const labels = [['energy', 'Energi', '1 = meget lav · 5 = meget høj'],
  ['motivation', 'Motivation', '1 = meget lav · 5 = meget høj'],
  ['stress', 'Stress', '1 = meget lidt · 5 = meget høj'],
  ['soreness_level', 'Ømhed', '1 = meget lidt · 5 = meget høj']]
const source = value => value === 'yesterday' ? 'Forslag fra i går — kontrollér før du gemmer.'
  : value === 'today' ? 'Dagens registrering. Du kan rette den.' : ''

// OFF does not inspect the controller. No app entry point imports this island.
export default function HurtigTracking(props = {}) {
  if (props.enabled !== true) return null
  if (!props.controller) return h('p', { role: 'alert' }, 'Hurtig log er ikke klar.')
  return h(QuickForm, { key: props.controller.snapshot().athleteId + ':' + props.controller.snapshot().date,
    controller: props.controller, onRetry: props.onRetry })
}

function QuickForm({ controller, onRetry }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  const id = useId()
  // Navigating away cancels a grace-period save. An already started write cannot
  // be cancelled here. The host must dispose its controller on scope replacement.
  useEffect(() => () => { controller.cancelPending() }, [controller])
  const heading = h('h2', { id: `${id}-heading` }, 'Hurtig log')
  if (state.phase === 'loading') return h('section', { 'aria-labelledby': `${id}-heading`, 'aria-busy': true },
    heading, h('p', { role: 'status' }, 'Henter dine registreringer…'))
  if (state.phase === 'error') return h('section', { 'aria-labelledby': `${id}-heading` }, heading,
    h('p', { role: 'alert' }, 'Registreringerne kunne ikke læses sikkert. Prøv igen.'),
    typeof onRetry === 'function' && h('button', { type: 'button', style: control, onClick: onRetry }, 'Prøv igen'))
  const field = (name, title, hint, input) => h('div', { key: name, style: { display: 'grid', gap: 6, marginBlock: 12 } },
    h('label', { htmlFor: `${id}-${name}` }, title), h('small', { id: `${id}-${name}-hint` }, hint), input)
  const inputProps = (kind, name) => ({ id: `${id}-${name}`, name, disabled: state.busy,
    style: { ...control, width: '100%' }, 'aria-describedby': `${id}-${name}-hint`,
    value: kind === 'weight' ? state.draft.weight : state.draft.readiness[name],
    onChange: event => controller.setField(kind, name, event.target.value) })
  const submit = kind => event => { event.preventDefault(); controller.save(kind) }
  const saveButton = (kind, text) => h('button', { type: 'submit', style: control,
    disabled: state.busy || !state.available[kind] }, text)
  const meals = list => list.map(meal => h('button', { key: meal.key, type: 'button', style: control,
    disabled: state.busy, 'aria-pressed': state.selectedMeal === meal.key,
    onClick: () => controller.selectMeal(meal.key) }, `${meal.value.meal} · ${meal.value.kcal} kcal · ${meal.value.protein} g protein`))
  const selectedOutsideTop = state.meals.slice(3).find(meal => meal.key === state.selectedMeal)
  return h('section', { className: 'e2-track-hurtig', 'aria-labelledby': `${id}-heading`,
    style: { maxWidth: 480, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 16,
      background: '#1c1c18', color: '#edeae2', lineHeight: 1.5, overflowWrap: 'anywhere' } },
    h('style', null, '.e2-track-hurtig :is(button,input,select,summary):focus-visible{outline:2px solid #edeae2;outline-offset:3px}.e2-track-hurtig button[aria-pressed="true"]{border:2px solid #edeae2}.e2-track-hurtig button:disabled{opacity:.65}'),
    heading, h('time', { dateTime: state.date }, state.date),
    h('p', null, 'Gem kun det, du vil registrere. Dagsform, vægt og måltid gemmes hver for sig.'),
    state.canRepeat && h('button', { type: 'button', style: control, disabled: state.busy,
      onClick: () => controller.sameAsYesterday() }, 'Samme som i går'),
    !state.canRepeat && h('p', null, 'Ingen registreringer fra i går at foreslå.'),
    h('div', { style: { position: 'sticky', top: 8, zIndex: 1, background: '#1c1c18', padding: state.message ? 8 : 0 } },
      h('p', { role: state.phase === 'save-error' ? 'alert' : 'status', 'aria-live': 'polite' }, state.message),
      state.phase === 'pending' && h('button', { type: 'button', style: control, onClick: () => controller.undo() }, 'Fortryd')),
    h('form', { onSubmit: submit('readiness') }, h('h3', null, 'Dagsform'), h('p', null, source(state.readinessSource)),
      labels.map(([name, title, hint]) => field(name, title, hint, h('select', inputProps('readiness', name),
        h('option', { value: '' }, 'Vælg'), ...[1, 2, 3, 4, 5].map(n => h('option', { key: n, value: String(n) }, n))))),
      h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer', paddingBlock: 10 } }, 'Søvn (valgfrit)'),
        field('sleep_hours', 'Søvn i timer', 'Valgfrit · 0–24 timer.', h('input', { ...inputProps('readiness', 'sleep_hours'), type: 'text', inputMode: 'decimal' }))),
      saveButton('readiness', 'Gem dagsform')),
    h('form', { onSubmit: submit('weight') }, h('h3', null, 'Vægt'), h('p', null, source(state.weightSource)),
      field('weight', 'Vægt i kg', 'Valgfrit at registrere · over 0 kg.', h('input', { ...inputProps('weight', 'weight'), type: 'text', inputMode: 'decimal' })),
      saveButton('weight', 'Gem vægt')),
    h('form', { onSubmit: submit('meal') }, h('h3', null, 'Måltid'),
      state.meals.length ? h('div', null,
        h('p', null, 'Mest brugte måltider i den indlæste historik'),
        h('div', { style: actions, role: 'group', 'aria-label': 'Mest brugte måltider' }, meals(state.meals.slice(0, 3))),
        state.meals.length > 3 && h('details', null,
          h('summary', { style: { minHeight: 44, paddingBlock: 10, cursor: 'pointer' } }, 'Flere måltider'),
          h('div', { style: actions }, meals(state.meals.slice(3)))),
        selectedOutsideTop && h('p', null, `Valgt: ${selectedOutsideTop.value.meal} · ${selectedOutsideTop.value.kcal} kcal · ${selectedOutsideTop.value.protein} g protein`),
        saveButton('meal', 'Gem måltid')) : h('p', null, 'Ingen tidligere måltider at vælge. Brug kostloggen til et nyt måltid.'),
      state.ignoredMeals > 0 && h('p', null, 'Nogle historiske rækker kunne ikke bruges som måltidsforslag.'),
      state.preferenceMessage && h('p', { role: 'status' }, state.preferenceMessage)),
    Object.values(state.available).some(value => !value) && h('p', null, 'En eller flere gemmeveje er ikke tilsluttet her.'))
}
