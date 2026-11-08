import { antalOrd } from '../../antalOrd.mjs'
import * as React from 'react'
import PlanActivation from './activation.mjs'
import MealDraftImport from './MealDraftImport.mjs'
import PlanDayOverview from './PlanDayOverview.mjs'
import { openPortalPlan } from './portalModel.mjs'
import { coachPlanView, recipeChoice } from './view.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { loadCoachFoods } from '../foedevarer/frida55Loader.mjs'
import { identifier, day, planDate, number, catalogFoods } from './model.mjs'
import { recipeItems, portalNutritionReport } from './connections.mjs'
import { nutritionReportView } from '../rapport/reportView.mjs'
import KostJustering from '../justering/KostJustering.mjs'
import { portalAdjustment, choosePortalAdjustment } from './adjustment.mjs'
import { control, button, primaryButton, formCss } from './formStyles.mjs'
import { profileCalculation } from './gramPlan.mjs'
import { planContextView } from './planContextView.mjs'
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
    client: props.client, loadClient: props.loadClient, loadReferenceFoods: props.loadReferenceFoods })
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
  const [expanded, setExpanded] = React.useState(false)
  const [referenceRequested, setReferenceRequested] = React.useState(false)
  // The catalogue choice is made before any editor/controller is constructed.
  // A retained launch callback cannot replace an already opened session.
  const chosen = React.useRef(false)
  const current = React.useRef(true)
  const disclosure = React.useRef(null)
  const [refresh, setRefresh] = React.useState(0)
  const [date, setDate] = React.useState(props.date)
  // The disclosure needs no effect before interaction. A host ref retires launch
  // callbacks synchronously at detachment, including StrictMode ref replays.
  return React.createElement('div', { ref: node => { current.current = node !== null } },
    date !== props.date && h('p', null, `Koststatus og registrering nedenfor gælder ${props.date}, ikke den valgte plandato.`),
    h(ActiveReport, { ...props, enabled: true, refresh }),
    opened && React.createElement(PlanDayOverview, { enabled: true, coachId: props.coachId, athleteId: props.athlete.id,
      today: props.date, selectedDate: date, onContinue: () => {
        if (!current.current) return
        chosen.current = true
        // Only this explicit action opens the existing native host. Ordinary
        // manual sessions remain uncontrolled, with their editor kept mounted.
        disclosure.current?.setAttribute('open', '')
        setExpanded(true); setOpened(true)
      } }),
    !opened && React.createElement('button', { type: 'button', style: button, onClick: () => {
      if (!current.current || chosen.current) return
      chosen.current = true
      setReferenceRequested(true); setExpanded(true); setOpened(true)
    } }, 'Åbn kostplan med Frida-fødevarer'),
    React.createElement('details', { ref: disclosure, open: referenceRequested ? expanded : undefined, className: 'e2-portal-plan', style: { marginTop: 16, textAlign: 'left', overflowWrap: 'anywhere' },
    onToggle: event => {
      if (!current.current) return
      const open = event.currentTarget.open
      if (open) chosen.current = true
      setExpanded(open)
      if (open) setOpened(true)
    } },
    h('summary', { style: { minHeight: 44, padding: '12px 0', cursor: 'pointer' } }, 'Kostplan'),
    h('style', { dangerouslySetInnerHTML: { __html: formCss } }),
    opened && h(referenceRequested ? ReferencePlanEditor : PlanEditor, { ...props, active: expanded, date, today: props.date, onDate: setDate, onActivated: () => setRefresh(value => value + 1),
      key: JSON.stringify([date, props.athlete.age, props.athlete.bodyweight, props.athlete.goal,
        profileCalculation(props.athlete, date)]) })))
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

// Resolve the catalogue before constructing the one editor/controller session.
// In particular, arrival must never replace a controller with typed fields or a
// reserved activation. Closing retires pending work; a ready editor is retained.
function ReferencePlanEditor(props) {
  const [reference, setReference] = React.useState(null)
  const [attempt, setAttempt] = React.useState(0)
  const load = props.loadReferenceFoods ?? loadCoachFoods
  // Loading is the absence of a result for this request, not an effect update.
  // A close/reopen, retry or loader change retires the previous error as well.
  const request = React.useMemo(() => ({ active: props.active, load, attempt }), [props.active, load, attempt])
  const failed = reference?.request === request && reference?.state === 'error'
  React.useLayoutEffect(() => {
    if (!request.active || reference?.catalog) return
    let current = true
    Promise.resolve().then(() => {
      if (!current) return null
      return request.load()
    }).then(catalog => {
      if (!current) return
      if (!Array.isArray(catalog) || catalog.length !== FOODS.length + 40
        || !catalogFoods(catalog) || !FOODS.every((food, i) => food === catalog[i])) throw Error('Invalid reference catalogue')
      setReference({ state: 'ready', catalog })
    }).catch(() => {
      if (!current) return
      setReference({ state: 'error', request })
    })
    return () => { current = false }
  }, [request, reference?.catalog])
  return h('div', null,
    !reference?.catalog && !failed && h('p', { role: 'status' }, 'Indlæser referencefødevarer til måltidseditoren…'),
    failed && h('p', { role: 'alert' },
      'Referencefødevarer er ikke tilgængelige. Din gemte kladde er bevaret.',
      !reference.catalog && h('button', { type: 'button', style: button, disabled: !props.active,
        onClick: () => setAttempt(value => value + 1) }, 'Prøv referencefødevarer igen')),
    reference?.catalog && h(PlanEditor, { ...props, catalog: reference.catalog, referenceReady: reference.state === 'ready' }))
}

function PlanEditor(props) {
  const [opened, setOpened] = React.useState(() => openPortalPlan({ enabled: true, ...props }))
  const [rows, setRows] = React.useState(() => meals.map(() => [{ foodId: '', grams: '' }]))
  const [error, setError] = React.useState('')
  const [notes, setNotes] = React.useState({ preferences: '', allergies: '', budget: '' })
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
    next.controller.setAdvice(snapshot.portionGuidance)
    if (!next.controller.generate()) { setError(next.controller.snapshot().error); return }
    setError(''); setOpened(next)
  }
  // Read live state in the handler: an event captured before save/reservation
  // must not switch the scope while that operation is in flight.
  const current = React.useRef(true)
  const liveController = React.useRef(opened.controller)
  React.useLayoutEffect(() => {
    current.current = true; liveController.current = opened.controller
    return () => { current.current = false }
  }, [opened.controller])
  return h('div', null,
    h('label', { style: { display: 'grid', gap: '0.25rem' } }, 'Plandato',
      h('input', { name: 'plan-date', type: 'date', style: control, value: props.date,
        min: '1900-01-07', max: '9999-12-24', disabled: Boolean(snapshot.busy || snapshot.activationPending),
        onChange: event => {
          const live = liveController.current.snapshot(), value = event.currentTarget.value
          if (current.current && !live.busy && !live.activationPending && planDate(value)) props.onDate(value)
        } })),
    h('p', { role: 'status' }, `Kladden og aktiveringen gælder ${props.date}. Gem hver dato og aktivér den særskilt. Datoændring åbner datoens senest gemte kladde; ugemte rettelser følger ikke med.`),
    props.date > props.today && h('p', { 'data-future-plan': true },
      'Fremtidig plandag: grundlaget nedenfor er den aktuelt kendte profil, herunder eventuelt oplyst træningsbelastning. Det bekræfter ikke fremtidens træning, dagsform eller indtag. Fremtidigt indtag er ukendt; dagens kostregistrering er ikke evidens for denne dato. Ingen nye tal anbefales automatisk ved datovalg.'),
    h(PlanActivation, { controller: opened.controller, athleteId: props.athlete.id, date: props.date,
      client: props.client, loadClient: props.loadClient }),
    opened.loadError && h('p', { role: 'alert' }, opened.loadError),
    planContextView(h, { athlete: props.athlete, date: props.date, snapshot, notes,
      onNote: (key, value) => setNotes(old => ({ ...old, [key]: value.slice(0, 600) })) }),
    coachPlanView(h, snapshot, { ...opened.controller,
      generate: () => opened.controller.generate(snapshot.manualImport && gramGenerator
        ? meals.map((name, i) => ({ id: `meal-${i}`, name, items: [] })) : undefined),
      activate: async () => {
      const previous = opened.controller.snapshot().publishedVersion
      const activated = await opened.controller.activate()
      if (activated && opened.controller.snapshot().publishedVersion !== previous) props.onActivated()
      return activated
    } }),
    props.referenceReady && h('p', { 'data-frida-reference': true },
      'I måltidsformularen kan du vælge 40 generiske referencefødevarer fra ',
      h('a', { href: 'https://doi.org/10.11583/DTU.29500682.v8', target: '_blank', rel: 'noreferrer' }, 'DTU Frida5.5'),
      ' (CC BY 4.0). Gennemsnitsværdier pr. 100 g spiselig del i den navngivne tilstand; nogle er anslået eller beregnet. Ikke præcist mærkevareindhold. Manglende værdier er ukendte. Gramgeneratoren bruger det oprindelige katalog.'),
    h(MealDraftImport, { controller: opened.controller, snapshot, coachId: props.coachId }),
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
