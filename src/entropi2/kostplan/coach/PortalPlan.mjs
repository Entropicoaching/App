import * as React from 'react'
import { openPortalPlan } from './portalModel.mjs'
import { coachPlanView, recipeChoice } from './view.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { identifier, day, number, catalogFoods } from './model.mjs'
import { recipeItems, portalNutritionReport } from './connections.mjs'
import { nutritionReportView } from '../rapport/reportView.mjs'
import KostJustering from '../justering/KostJustering.mjs'
import { evaluateAdjustment } from '../justering/model.mjs'

const h = React.createElement
const control = { minHeight: 44, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', font: 'inherit' }
const meals = ['Morgenmad', 'Frokost', 'Aftensmad']
const foods = catalogFoods(FOODS)

// Mounted only in the enabled coach tab. The keyed parent resets all local UI
// immediately on coach, athlete or date changes; opening does not write anything.
export default function PortalPlan(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, today, session } = props
  if (!identifier(athlete?.id) || !identifier(session?.user?.id) || !day(today)) return null
  return h(ScopedPortalPlan, { key: JSON.stringify([session.user.id, athlete.id, today]),
    coachId: session.user.id, athlete, date: today, nutritionRead: props.nutritionRead })
}

function ScopedPortalPlan(props) {
  const [opened, setOpened] = React.useState(false)
  return h('details', { style: { marginTop: 16, textAlign: 'left', overflowWrap: 'anywhere' },
    onToggle: event => { if (event.currentTarget.open) setOpened(true) } },
    h('summary', { style: { minHeight: 44, padding: '12px 0', cursor: 'pointer' } }, 'Kostplan'),
    opened && h(PlanEditor, props),
    opened && h(PortalNutritionReport, { ...props, enabled: true }))
}

export function PortalNutritionReport(props = {}) {
  if (props.enabled !== true) return null
  const report = portalNutritionReport({ enabled: true, coachId: props.coachId,
    athleteId: props.athlete?.id, date: props.date, receipt: props.nutritionRead })
  if (!report) return null
  return h('details', null,
    h('summary', { style: { minHeight: 44, padding: '12px 0', cursor: 'pointer' } }, 'Kostrapport'),
    nutritionReportView(h, { enabled: true, ...report }))
}

function PlanEditor(props) {
  const [opened, setOpened] = React.useState(() => openPortalPlan({ enabled: true, ...props }))
  const [rows, setRows] = React.useState(() => meals.map(() => [{ foodId: '', grams: '' }]))
  const [error, setError] = React.useState('')
  const snapshot = React.useSyncExternalStore(opened.controller.subscribe, opened.controller.snapshot, opened.controller.snapshot)
  const change = (mi, ii, key, value) => setRows(old => old.map((meal, m) => m !== mi ? meal
    : meal.map((item, i) => i !== ii ? item : { ...item, [key]: value })))
  const start = event => {
    event.preventDefault()
    const template = rows.map((items, index) => ({ id: `meal-${index}`, name: meals[index], items }))
    if (template.some(meal => !meal.items.length || meal.items.some(item => !FOODS.some(food => food.id === item.foodId)
      || !(number(item.grams, 10000) > 0)) || new Set(meal.items.map(item => item.foodId)).size !== meal.items.length)) {
      setError('Vælg fødevarer og gram over 0 i hvert måltid. Brug hver fødevare én gang pr. måltid.'); return
    }
    const next = openPortalPlan({ enabled: true, ...props, template })
    // Preserve explicit target edits made in the existing coach view.
    for (const [field, value] of Object.entries(snapshot.form)) next.controller.set(field, value)
    if (!next.controller.generate()) { setError(next.controller.snapshot().error); return }
    setError(''); setOpened(next)
  }
  return h('div', null,
    opened.loadError && h('p', { role: 'alert' }, opened.loadError),
    coachPlanView(h, snapshot, opened.controller),
    !snapshot.meals.length && h('form', { onSubmit: start },
      h('h3', null, 'Vælg måltider til forslaget'),
      h('p', null, 'Brug appens fødevareliste. Mængderne skaleres efter energi; gennemgå makroerne. Kilder og rå/kogt tilstand er ikke alle verificeret.'),
      ...rows.map((items, mi) => h('fieldset', { key: mi, style: { minWidth: 0, marginBottom: 12 } },
        h('legend', null, meals[mi]),
        recipeChoice(h, { foods, name: `template-recipe-${mi}`, mealName: meals[mi],
          onChoose: recipeId => {
            const selected = recipeItems(recipeId, foods)
            if (!selected) { setError('Opskriften kunne ikke åbnes. Vælg fødevarer manuelt.'); return }
            setRows(old => old.map((meal, m) => m === mi ? selected : meal)); setError('')
          } }),
        ...items.map((item, ii) => h('div', { key: ii, style: { marginBottom: 12 } },
          h('label', null, `Fødevare ${ii + 1}`, h('select', { style: control, value: item.foodId,
            name: `template-food-${mi}-${ii}`, onChange: e => change(mi, ii, 'foodId', e.currentTarget.value) },
            h('option', { value: '' }, 'Vælg fødevare'),
            ...FOODS.map(food => h('option', { key: food.id, value: food.id }, food.name)))),
          h('label', null, 'Gram', h('input', { style: control, type: 'text', inputMode: 'decimal', value: item.grams,
            name: `template-grams-${mi}-${ii}`, onChange: e => change(mi, ii, 'grams', e.currentTarget.value) })),
          items.length > 1 && h('button', { type: 'button', style: control,
            onClick: () => setRows(old => old.map((meal, m) => m !== mi ? meal : meal.filter((_, i) => i !== ii))) }, 'Fjern fødevare'))),
        items.length < 12 && h('button', { type: 'button', style: control,
          onClick: () => setRows(old => old.map((meal, m) => m !== mi ? meal : [...meal, { foodId: '', grams: '' }])) }, 'Tilføj fødevare'))),
      error && h('p', { role: 'alert' }, error),
      h('button', { type: 'submit', style: control }, 'Brug måltider og generér dagsplan')),
    // Only a confirmed saved plan warrants a weekly state. A device draft is
    // not an active, versioned energy basis, so it cannot produce a proposal.
    snapshot.saved && h(KostJustering, { enabled: true, snapshot: evaluateAdjustment({ enabled: true, plan: null }) }))
}
