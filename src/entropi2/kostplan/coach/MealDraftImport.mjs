import * as React from 'react'
import { MEAL_DRAFT_MAX_LENGTH } from './mealDraft.mjs'
import { button, control, primaryButton } from './formStyles.mjs'
import { emptyMealForm, addFormMeal, addFormLine, loadMealForm, serializeMealForm, lineCount } from './mealDraftForm.mjs'

const fieldset = { minWidth: 0, marginBottom: 12 }
const rowStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))', gap: 12 }

export default function MealDraftImport({ controller, snapshot, coachId }) {
  const scope = JSON.stringify([coachId, snapshot?.athleteId, snapshot?.date])
  const [binding, setBinding] = React.useState({ controller, scope, epoch: 0 })
  // A changed controller must discard its draft even within the same owner/date.
  // Keyed remount also retires every callback issued by that editor instance.
  if (binding.controller !== controller || binding.scope !== scope) {
    setBinding({ controller, scope, epoch: binding.epoch + 1 })
    return null
  }
  if (!snapshot || !controller) return null
  return React.createElement(MealFormSession, { key: binding.epoch, controller, snapshot, coachId })
}

function MealFormSession({ controller, snapshot, coachId }) {
  const [draft, setDraft] = React.useState(emptyMealForm)
  const [source, setSource] = React.useState('')
  const [jsonError, setJsonError] = React.useState('')
  const [errors, setErrors] = React.useState([])
  const [status, setStatus] = React.useState('Formularkladde: endnu ikke anvendt.')
  const [appliedVersion, setAppliedVersion] = React.useState(null)
  const [replace, setReplace] = React.useState(false)
  const currentDraft = React.useRef(draft)
  const currentSource = React.useRef('')
  const active = React.useRef(false)
  const errorFocus = React.useRef(null)
  const jsonFocus = React.useRef(null)
  const errorId = 'meal-form-errors-' + encodeURIComponent(JSON.stringify([coachId, snapshot.athleteId, snapshot.date]))
  const jsonErrorId = errorId + '-json'
  React.useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  React.useEffect(() => { if (errors.length) errorFocus.current?.focus() }, [errors])
  React.useEffect(() => { if (jsonError) jsonFocus.current?.focus() }, [jsonError])
  const locked = Boolean(snapshot.busy || snapshot.activationPending)
  // Consult the actual controller again at event time. Disabled DOM is only UI;
  // retained callbacks must also reject busy/reserved or superseded versions.
  const live = () => {
    if (!active.current) return null
    const now = controller.snapshot()
    return now && now.localDraftOnly && now.athleteId === snapshot.athleteId && now.date === snapshot.date
      && now.version === snapshot.version && !now.busy && !now.activationPending ? now : null
  }
  const update = next => {
    if (!live() || currentDraft.current !== draft) return
    currentDraft.current = next; setDraft(next); setReplace(false); setAppliedVersion(null)
    setStatus('Formularkladde ændret · ikke anvendt. Planens måltider er bevaret.')
  }
  const changeMeal = (id, key, value) => update({ ...draft, meals: draft.meals.map(m => m.id !== id ? m : { ...m, [key]: value }) })
  const changeLine = (id, key, field, value) => update({ ...draft, meals: draft.meals.map(m => m.id !== id ? m : { ...m,
    items: m.items.map(item => item.key !== key ? item : { ...item, [field]: value }) }) })
  const apply = event => {
    event.preventDefault()
    const now = live()
    if (!now || currentDraft.current !== draft) return
    const result = serializeMealForm(draft, { coachId, athleteId: now.athleteId, date: now.date }, now.foods)
    if (result.errors.length) { setErrors(result.errors); return }
    const accepted = controller.importMealDraft(result.source, now.version)
    setErrors(accepted ? [] : [controller.snapshot().error ?? 'Kladden kan ikke anvendes nu. Kontrollér den aktuelle plan og aktivering.'])
    if (accepted) { setAppliedVersion(controller.snapshot().version); setStatus('Måltidskladden er anvendt på skærmen. Gennemgå planen og vælg Gem som kladde; Aktivér for atleten er et særskilt valg.') }
  }
  const count = lineCount(draft)
  return React.createElement('details', null,
    React.createElement('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Indlæs måltidskladde'),
    React.createElement('h3', null, 'Byg måltidskladde'),
    React.createElement('p', null, `Valgt plan: ${snapshot.athleteName} · ${snapshot.date}. Planens ${snapshot.meals.length} måltider vises i planoversigten.`),
    React.createElement('p', null, 'Skriv måltidsnavn, eventuelt tidspunkt, og vælg fødevarer og gram. Fx 125,5 gram. Formularen gemmer ikke. Anvend måltidskladde erstatter først derefter måltiderne i planoversigten.'),
    React.createElement('p', { role: 'status', 'aria-live': 'polite' }, appliedVersion !== null && appliedVersion !== snapshot.version
      ? 'Planoversigten er ændret siden formularen blev anvendt. Formularens felter er bevaret; gennemgå dem før en eventuel ny anvendelse.' : status),
    locked && React.createElement('p', { role: 'status' }, 'Kladden er låst, mens gemning eller en uafklaret aktivering behandles. Planens oprindelige indhold er bevaret.'),
    React.createElement('button', { type: 'button', style: button, disabled: locked || !snapshot.meals.length,
      onClick: () => { if (live() && currentDraft.current === draft) setReplace(true) } }, 'Hent planens måltider til formular'),
    replace && React.createElement('div', null,
      React.createElement('p', null, 'Dette erstatter alle indtastede formularfelter med planoversigtens aktuelle måltider. Selve planen ændres ikke.'),
      React.createElement('button', { type: 'button', style: button, disabled: locked, onClick: () => {
        const now = live()
        if (!now || currentDraft.current !== draft) return
        update(loadMealForm(now.meals)); setErrors([])
        setStatus('Planens måltider er hentet til formularen. Ændringer her er ikke anvendt eller gemt.')
      } }, 'Erstat formular med planens måltider'),
      React.createElement('button', { type: 'button', style: button, onClick: () => { if (live()) setReplace(false) } }, 'Behold formular')),
    React.createElement('form', { onSubmit: apply, 'aria-describedby': errors.length ? errorId : undefined },
      React.createElement('fieldset', { disabled: locked, style: fieldset },
        React.createElement('legend', null, 'Formularkladde · navngivne måltider'),
        ...draft.meals.map((meal, mi) => React.createElement('fieldset', { key: meal.id, style: fieldset },
          React.createElement('legend', null, `Måltid ${mi + 1}`),
          React.createElement('div', { style: rowStyle },
            React.createElement('label', null, `Navn på måltid ${mi + 1}`, React.createElement('input', { type: 'text', style: control, name: `draft-name-${mi}`, value: meal.name,
              onChange: e => changeMeal(meal.id, 'name', e.currentTarget.value) })),
            React.createElement('label', null, `Tidspunkt for måltid ${mi + 1} (valgfrit, fx 07:30)`, React.createElement('input', { type: 'text', style: control, name: `draft-time-${mi}`, value: meal.time,
              onChange: e => changeMeal(meal.id, 'time', e.currentTarget.value) }))),
          ...meal.items.map((item, ii) => React.createElement('div', { key: item.key, style: { ...rowStyle, marginTop: 12 } },
            React.createElement('label', null, `Fødevare ${ii + 1} i måltid ${mi + 1}`, React.createElement('select', { style: control, name: `draft-food-${mi}-${ii}`, value: item.foodId,
              onChange: e => changeLine(meal.id, item.key, 'foodId', e.currentTarget.value) },
              React.createElement('option', { value: '' }, 'Vælg fødevare'),
              item.foodId && !snapshot.foods.some(f => f.id === item.foodId) && React.createElement('option', { value: item.foodId }, 'Ukendt fødevare – vælg igen'),
              ...snapshot.foods.map(food => React.createElement('option', { key: food.id, value: food.id }, `${food.name} · ${food.nutrition.preparation}`)))),
            React.createElement('label', null, `Gram af fødevare ${ii + 1} i måltid ${mi + 1}`, React.createElement('input', { type: 'text', inputMode: 'decimal', style: control,
              name: `draft-grams-${mi}-${ii}`, value: item.grams, onChange: e => changeLine(meal.id, item.key, 'grams', e.currentTarget.value) })),
            React.createElement('button', { type: 'button', style: button, onClick: () => update({ ...draft, meals: draft.meals.map(m => m.id !== meal.id ? m : { ...m,
              items: m.items.filter(i => i.key !== item.key) }) }) }, `Fjern fødevare ${ii + 1} fra måltid ${mi + 1}`))),
          React.createElement('button', { type: 'button', style: button, disabled: meal.items.length >= 30 || count >= 100,
            onClick: () => update(addFormLine(draft, meal.id)) }, `Tilføj fødevare til måltid ${mi + 1}`),
          React.createElement('button', { type: 'button', style: button, disabled: draft.meals.length <= 1,
            onClick: () => { if (draft.meals.length > 1) update({ ...draft, meals: draft.meals.filter(m => m.id !== meal.id) }) } }, `Fjern måltid ${mi + 1}`))),
        React.createElement('p', null, `${draft.meals.length} af 12 måltider · ${count} af 100 fødevarelinjer · højst 30 linjer pr. måltid.`),
        React.createElement('button', { type: 'button', style: button, disabled: draft.meals.length >= 12 || count >= 100,
          onClick: () => update(addFormMeal(draft)) }, 'Tilføj måltid'),
        React.createElement('button', { type: 'submit', style: { ...primaryButton, width: '100%', marginTop: 12 } }, 'Anvend måltidskladde')),
      errors.length > 0 && React.createElement('div', { ref: errorFocus, id: errorId, tabIndex: -1, role: 'alert' },
        React.createElement('p', null, 'Ret formularen. Alle indtastede felter og planens måltider er bevaret.'),
        React.createElement('ul', null, ...errors.map((error, i) => React.createElement('li', { key: i }, error))))),
    React.createElement('details', null,
      React.createElement('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Avanceret indlæsning'),
      React.createElement('p', null, `Valgt coach: ${coachId} · atlet: ${snapshot.athleteId} · dato: ${snapshot.date}`),
      React.createElement('p', null, 'JSON-format: {"schema":"entropi2:meal-draft:v1","coachId":"…","athleteId":"…","date":"YYYY-MM-DD","meals":[{"id":"morgen","name":"07:00 Morgenmad","items":[{"foodId":"katalog-id","grams":123.5}]}]}. Brug de valgte id’er og dato ovenfor samt katalog-id’er fra listen.'),
      React.createElement('p', null, 'Kun disse felter. 1–12 navngivne måltider, 1–30 fødevarelinjer pr. måltid, højst 100 i alt. Gram skal være JSON-tal over 0 og højst 10.000. Hvert måltids-id og hver fødevare pr. måltid skal være unik. Højst 32.000 tegn. Tidspunkter skrives i måltidsnavnet. Ingen råd eller instruktioner indlæses.'),
      React.createElement('details', null, React.createElement('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Katalog-id’er'), React.createElement('ul', null,
        ...snapshot.foods.map(food => React.createElement('li', { key: food.id }, `${food.name}: ${food.id}`)))),
      React.createElement('form', { 'aria-describedby': jsonError ? jsonErrorId : undefined, onSubmit: event => {
        event.preventDefault()
        if (!live() || currentSource.current !== source) return
        const accepted = controller.importMealDraft(source, snapshot.version)
        setJsonError(accepted ? '' : controller.snapshot().error ?? 'Kladden kan ikke indlæses nu. Kontrollér den aktuelle visning og uafklaret aktivering.')
        if (accepted) { setAppliedVersion(null); setStatus('JSON-kladden er indlæst i planoversigten. Formularens separate felter er bevaret og er ikke anvendt.') }
      } },
      React.createElement('fieldset', { disabled: locked, style: fieldset },
        React.createElement('legend', null, 'Manuel måltidskladde'),
        React.createElement('label', null, 'Måltidskladde som JSON', React.createElement('textarea', { name: 'meal-draft-json', style: control,
          maxLength: MEAL_DRAFT_MAX_LENGTH, rows: 10, value: source,
          onChange: event => {
            if (!live() || currentSource.current !== source) return
            const next = event.currentTarget.value.slice(0, MEAL_DRAFT_MAX_LENGTH + 1)
            currentSource.current = next; setSource(next)
          } })),
        React.createElement('button', { type: 'submit', style: button }, 'Indlæs og validér'))),
      jsonError && React.createElement('p', { ref: jsonFocus, id: jsonErrorId, tabIndex: -1, role: 'alert' }, jsonError),
      React.createElement('p', null, 'Indlæsning bevarer gram præcist og viser kun en manuel kladde på skærmen. Gennemgå derefter måltider og beregnede summer, og brug Gem som kladde. Aktivering kræver det normale særskilte valg.')))
}
