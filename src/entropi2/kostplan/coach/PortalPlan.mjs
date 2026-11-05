import { antalOrd } from '../../antalOrd.mjs'
import * as React from 'react'
import PlanActivation from './activation.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { coachPlanView, recipeChoice } from './view.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { identifier, day, number, catalogFoods } from './model.mjs'
import { recipeItems, portalNutritionReport } from './connections.mjs'
import { nutritionReportView } from '../rapport/reportView.mjs'
import KostJustering from '../justering/KostJustering.mjs'
import { portalAdjustment, choosePortalAdjustment } from './adjustment.mjs'
import { control, button, primaryButton, formCss } from './formStyles.mjs'
import { activeReportScope, startActiveReport, activeReportView } from './activeReport.mjs'

const h = React.createElement
const meals = ['Morgenmad', 'Frokost', 'Aftensmad']
const foods = catalogFoods(FOODS)

// Mounted only in the enabled coach tab. The keyed parent resets all local UI
// immediately on coach, athlete or date changes; opening does not write anything.
export default function PortalPlan(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, today, session } = props
  if (!identifier(athlete?.id) || !identifier(session?.user?.id) || !day(today)) return null
  return h(ScopedPortalPlan, { key: JSON.stringify([session.user.id, athlete.id, today]),
    coachId: session.user.id, athlete, date: today, nutritionRead: props.nutritionRead,
    client: props.client, loadClient: props.loadClient })
}

// Mounted directly in Kost & mål, independently of opening the meal editor.
// All state belongs to the current coach/athlete/date and exact evidence snapshot.
export function PortalKostJustering(props = {}) {
  if (props.enabled !== true) return null
  if (props.loading || props.loadError) return null
  const options = { enabled: true, coachId: props.coachId, athleteId: props.athlete?.id,
    date: props.date, receipt: props.nutritionRead }
  const proposal = portalAdjustment(options)
  if (!proposal) return null
  return h(ScopedKostJustering, { key: JSON.stringify(proposal.snapshot), options, proposal })
}

function ScopedKostJustering({ options, proposal }) {
  const [result, setResult] = React.useState(null)
  const [error, setError] = React.useState(false)
  const chosen = React.useRef(false)
  const s = result?.snapshot ?? proposal.snapshot
  const readiness = s.evidence.readiness
  return h('div', null,
    h(KostJustering, { enabled: true, snapshot: s, error,
      onDecision: (decision, shown) => {
        if (chosen.current) return
        chosen.current = true
        try { setResult(choosePortalAdjustment(options, shown, decision)) }
        catch { setError(true) }
      } }),
    !error && h('p', null, `Efterlevelse: ${s.evidence.diet.completeDays} ${antalOrd(s.evidence.diet.completeDays, 'bekræftet kostdag', 'bekræftede kostdage')} i perioden. Dagsform: ${readiness
      ? `energi ${readiness.energy}/5, sult ${readiness.hunger}/5` : 'ikke registreret'}.`),
    !error && h('p', null, 'Valget gælder kun denne åbne visning. Der gemmes eller aktiveres ingen plan.'))
}

function ScopedPortalPlan(props) {
  const [opened, setOpened] = React.useState(false)
  const [refresh, setRefresh] = React.useState(0)
  return h('div', null,
    h(ActiveReport, { ...props, enabled: true, refresh }),
    h('details', { className: 'e2-portal-plan', style: { marginTop: 16, textAlign: 'left', overflowWrap: 'anywhere' },
    onToggle: event => { if (event.currentTarget.open) setOpened(true) } },
    h('summary', { style: { minHeight: 44, padding: '12px 0', cursor: 'pointer' } }, 'Kostplan'),
    h('style', { dangerouslySetInnerHTML: { __html: formCss } }),
    opened && h(PlanEditor, { ...props, onActivated: () => setRefresh(value => value + 1),
      key: JSON.stringify([props.athlete.age, props.athlete.bodyweight, props.athlete.goal]) })))
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
  const gramGenerator = snapshot.gramGenerator
  const change = (mi, ii, key, value) => setRows(old => old.map((meal, m) => m !== mi ? meal
    : meal.map((item, i) => i !== ii ? item : { ...item, [key]: value })))
  const start = event => {
    event.preventDefault()
    const template = rows.map((items, index) => ({ id: `meal-${index}`, name: meals[index],
      items: gramGenerator ? items.filter(item => !(item.foodId === ''
        && (item.minGrams ?? '') === '' && (item.maxGrams ?? '') === '')) : items }))
    if (gramGenerator) {
      setError(''); opened.controller.generate(template); return
    }
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
    h(PlanActivation, { controller: opened.controller, athleteId: props.athlete.id, date: props.date,
      client: props.client, loadClient: props.loadClient }),
    opened.loadError && h('p', { role: 'alert' }, opened.loadError),
    coachPlanView(h, snapshot, { ...opened.controller, activate: async () => {
      const previous = opened.controller.snapshot().publishedVersion
      const activated = await opened.controller.activate()
      if (activated && opened.controller.snapshot().publishedVersion !== previous) props.onActivated()
      return activated
    } }),
    !snapshot.meals.length && h('form', { onSubmit: start },
      h('h3', null, 'Vælg måltider til forslaget'),
      h('p', null, gramGenerator
        ? 'Vælg fødevarer og portionsgrænser, eller lad måltider stå tomme for forslag.'
        : 'Vælg fødevarer og angiv gram i hvert måltid.'),
      ...rows.map((items, mi) => h('fieldset', { key: mi, style: { minWidth: 0, marginBottom: 12 } },
        h('legend', null, meals[mi]),
        !gramGenerator && recipeChoice(h, { foods, name: `template-recipe-${mi}`, mealName: meals[mi],
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
          gramGenerator ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))', gap: 8 } },
            ...[['minGrams', 'Mindst'], ['maxGrams', 'Højst']].map(([key, title]) => h('label', { key }, `${title} gram af fødevare ${ii + 1} i ${meals[mi]}`,
              h('input', { style: control, type: 'text', inputMode: 'numeric', value: item[key] ?? '',
                name: `template-${key}-${mi}-${ii}`, onChange: e => change(mi, ii, key, e.currentTarget.value) }))))
          : h('label', null, 'Gram', h('input', { style: control, type: 'text', inputMode: 'decimal', value: item.grams,
            name: `template-grams-${mi}-${ii}`, onChange: e => change(mi, ii, 'grams', e.currentTarget.value) })),
          items.length > 1 && h('button', { type: 'button', style: { ...button, width: '100%' },
            onClick: () => setRows(old => old.map((meal, m) => m !== mi ? meal : meal.filter((_, i) => i !== ii))) }, 'Fjern fødevare'))),
        items.length < 12 && h('button', { type: 'button', style: { ...button, width: '100%' },
          onClick: () => setRows(old => old.map((meal, m) => m !== mi ? meal : [...meal, { foodId: '', grams: '' }])) }, 'Tilføj fødevare'))),
      error && h('p', { role: 'alert' }, error),
      h('button', { type: 'submit', style: { ...primaryButton, width: '100%' } }, gramGenerator ? 'Generér forslag' : 'Brug måltider og generér dagsplan')))
}

function ActiveReportSession(props) {
  const [result, setResult] = React.useState(null)
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => startActiveReport({ ...props, athleteId: props.athlete.id, receipt: props.nutritionRead },
    value => setResult({ value, receipt: props.nutritionRead, client: props.client, loadClient: props.loadClient, attempt })),
  [props.coachId, props.athlete.id, props.date, props.nutritionRead, props.client, props.loadClient, attempt])
  if (result?.receipt !== props.nutritionRead || result?.client !== props.client
    || result?.loadClient !== props.loadClient || result?.attempt !== attempt) return null
  return activeReportView(h, result.value, () => setAttempt(value => value + 1))
}

export function ActiveReport(props = {}) {
  if (props.enabled !== true) return null
  if (!activeReportScope({ enabled: true, coachId: props.coachId, athleteId: props.athlete?.id,
    date: props.date, receipt: props.nutritionRead })) return null
  return h(ActiveReportSession, { ...props, key: JSON.stringify([props.coachId, props.athlete.id, props.date, props.refresh]) })
}
