import { createElement as h, useEffect, useState, useSyncExternalStore } from 'react'
import { createUpcomingPlan } from './upcomingPlanModel.mjs'
import { PlanAdvice } from './KostplanAtlet.mjs'

function Preview({ controller }) {
  const s = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  return h('section', { 'aria-label': 'Kommende kostplan', 'aria-busy': ['idle', 'loading'].includes(s.phase),
    style: { maxWidth: '42rem', padding: 16, overflowWrap: 'anywhere' } },
    h('h1', null, 'Kommende kostplan'),
    h('p', null, 'Forhåndsvisning · kun læsning. Måltider kan først registreres på dagen. Kostlog og vejning hører til i dag.'),
    h('time', { dateTime: s.date }, s.date),
    ['idle', 'loading'].includes(s.phase) && h('p', { role: 'status' }, 'Henter planen…'),
    s.phase === 'empty' && h('p', { role: 'status' }, 'Der er ingen godkendt kostplan for denne dato.'),
    s.phase === 'unavailable' && h('p', { role: 'status' }, 'Kostplaner er ikke tilgængelige endnu. Planen kan ikke bekræftes.'),
    s.phase === 'read-error' && h('p', { role: 'alert' }, 'Planen kunne ikke hentes. Prøv igen.'),
    !['idle', 'loading'].includes(s.phase) && h('button', { type: 'button', onClick: controller.load,
      style: { minHeight: 44, font: 'inherit' } }, 'Hent planen igen'),
    s.plan && h('div', null,
      ...s.plan.meals.map(meal => h('section', { key: meal.id, 'aria-label': meal.name,
        style: { border: '1px solid currentColor', borderRadius: 12, padding: 16, marginTop: 16 } },
        h('h2', null, meal.name),
        h('ul', null, ...meal.foods.map(food => h('li', { key: food.id },
          `${food.name} · ${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(food.grams)} g`))))),
      h(PlanAdvice, { text: s.plan.portionGuidance })))
}

export default function UpcomingPlan({ athleteId, today, date, client }) {
  const [owned, setOwned] = useState(null)
  useEffect(() => {
    let controller
    try { controller = createUpcomingPlan({ enabled: true, athleteId, today, date, client }) }
    catch { setOwned({ athleteId, today, date, client, controller: null }); return }
    setOwned({ athleteId, today, date, client, controller })
    void controller.load()
    return controller.dispose
  }, [athleteId, today, date, client])
  // A previous response is never relabelled with a new athlete/date/client.
  const current = owned?.athleteId === athleteId && owned?.today === today && owned?.date === date && owned?.client === client
  if (!current) return h('p', { role: 'status' }, 'Henter planen…')
  return owned.controller ? h(Preview, { controller: owned.controller })
    : h('p', { role: 'alert' }, 'Planen kunne ikke hentes. Åbn kosten igen.')
}
