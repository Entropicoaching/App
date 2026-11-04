import { GOALS, INTENSITIES, CONTEXT_LABELS, totals } from './model.mjs'

const format = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })
const macroText = value => value
  ? `${format(value.kcal)} kcal · ${format(value.protein)} g protein · ${format(value.carb)} g kulhydrat · ${format(value.fat)} g fedt`
  : 'Kan ikke beregnes. Ret gram til et tal over 0 og højst 10.000.'
const control = { minHeight: 44, width: '100%', maxWidth: '100%', boxSizing: 'border-box', font: 'inherit' }
const button = { ...control, width: 'auto', padding: '0.5rem 1rem', whiteSpace: 'normal' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))', gap: '0.75rem' }
const statuses = { draft: 'Kladde', active: 'Aktiv', archived: 'Tidligere aktiv' }

// The application passes React.createElement. Hermetic tests pass a tiny element
// factory to exercise this exact view and its event handlers without a browser.
export function coachPlanView(h, snapshot, actions) {
  if (!snapshot) return null
  const s = snapshot, busy = Boolean(s.busy)
  const active = s.history.plans.find(plan => plan.date === s.date && plan.status === 'active')
  const field = (name, title, value, handler) => h('label', { key: name, style: { display: 'grid', gap: '0.25rem' } }, title,
    h('input', { name, style: control, value, type: 'text', inputMode: 'decimal', disabled: busy,
      onChange: event => handler(event.currentTarget.value) }))
  return h('section', { className: 'e2-coach-plan', 'aria-label': 'Coachens kostplan', 'aria-busy': busy,
    style: { maxWidth: '46rem', width: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere', padding: '1rem' } },
  h('h2', null, 'Kostplan'),
  h('p', null, `${s.athleteName} · ${s.date}`),
  h('p', null, active ? 'Atleten har en aktiv dagsplan. Dine rettelser bliver først synlige efter ny aktivering.'
    : s.history.state === 'ready' ? 'Ingen aktiv dagsplan for denne dato. Atleten kan bruge kcal-trackeren.'
      : 'Status for atletens aktive dagsplan er endnu ikke tilgængelig.'),
  h('form', { onSubmit: event => { event.preventDefault(); actions.generate() } },
    h('fieldset', { disabled: busy, style: { minWidth: 0, margin: 0, padding: '0.75rem' } },
      h('legend', null, 'Dagens mål'),
      h('div', { style: grid },
        h('label', null, 'Mål', h('select', { name: 'goal', style: control, value: s.form.goal,
          onChange: event => actions.set('goal', event.currentTarget.value) },
        ...Object.entries(GOALS).map(([value, title]) => h('option', { key: value, value }, title)))),
        h('label', null, 'Intensitet', h('select', { name: 'intensity', style: control, value: s.form.intensity,
          disabled: busy || s.form.goal === 'maintain',
          onChange: event => actions.set('intensity', Number(event.currentTarget.value)) },
        ...INTENSITIES.map(value => h('option', { key: value, value }, `${value} %`)))),
        field('maintenanceKcal', 'Vedligeholdelsesenergi (kcal)', s.form.maintenanceKcal, value => actions.set('maintenanceKcal', value)),
        !s.calculated && field('protein', 'Proteinmål (g)', s.form.protein, value => actions.set('protein', value)),
        !s.calculated && field('fat', 'Fedtmål (g)', s.form.fat, value => actions.set('fat', value))),
      h('p', null, s.calculated
        ? 'Forslaget bruger atletens beregningsgrundlag. Træning, dagsform og modellens gulve kan ændre procentmålet. Coachen skal gennemgå og aktivere planen.'
        : 'Bulk lægger den valgte procent til, cut trækker den fra. Vedligehold bruger 0 %. Kulhydrat udfylder resten af energimålet.'),
      h('button', { type: 'submit', style: button }, s.meals.length ? 'Generér ny dagsplan' : 'Generér dagsplan'))),
  s.suggestion && !s.planTargets && h('p', null, `Forslag til dagens mål: ${macroText(s.suggestion)}`),
  h('details', null,
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Grundlag og tidligere erfaringer'),
    h('p', null, s.calculated ? 'Beregningsgrundlaget bruges kun for den valgte atlet og dato. Frie kontekstnoter indgår ikke automatisk i beregningen.'
      : 'Coachen angiver udgangspunktet og tilpasser det efter atletens data. Procentforslaget vurderer ikke disse oplysninger automatisk.'),
    s.proposal && h('ul', null, ...s.proposal.reasons.map(reason => h('li', { key: reason.code }, reason.text))),
    h('dl', null, ...Object.entries(CONTEXT_LABELS).flatMap(([key, title]) => [
      h('dt', { key: `${key}-title` }, title), h('dd', { key }, s.context[key] ?? 'Ikke oplyst.'),
    ]))),
  s.error && h('p', { role: 'alert' }, s.error),
  s.proposal?.warnings.map((warning, index) => h('p', { key: index, role: 'status' }, warning)),
  h('p', { role: 'status', 'aria-live': 'polite' }, busy
    ? s.busy === 'save' ? 'Gemmer kladde…' : 'Aktiverer planen…'
    : s.message ?? (s.meals.length ? s.dirty ? 'Rettelserne er ikke gemt.' : s.saved?.status === 'active' ? 'Denne plan er aktiv.' : 'Kladde gemt.' : 'Ingen kladde på skærmen.')),
  s.meals.length > 0 && h('section', { 'aria-label': 'Dagsplan til gennemgang' },
    h('h3', null, 'Dagsplan til gennemgang'),
    h('p', null, 'Måltidsskabelonen skaleres efter energi og afrundes til hele gram. Kontrollér fødevarer, tilberedning og fordeling før aktivering.'),
    s.planTargets ? h('div', { style: { overflowX: 'auto' } }, h('table', { style: { width: '100%', textAlign: 'left' } },
      h('caption', null, 'Dagens plan og mål'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Indhold'), h('th', { scope: 'col' }, 'Plan'), h('th', { scope: 'col' }, 'Mål'))),
      h('tbody', null, ...[['kcal', 'Energi', 'kcal'], ['protein', 'Protein', 'g'], ['carb', 'Kulhydrat', 'g'], ['fat', 'Fedt', 'g']]
        .map(([key, title, unit]) => h('tr', { key }, h('th', { scope: 'row' }, title),
          h('td', null, s.totals ? `${format(s.totals[key])} ${unit}` : 'Kan ikke beregnes'),
          h('td', null, `${format(s.planTargets[key])} ${unit}`))))))
      : h('p', { role: 'status' }, 'Målene er ændret. Generér en ny dagsplan før gemning.'),
    ...s.meals.map((meal, mi) => h('fieldset', { key: meal.id, disabled: busy,
      style: { minWidth: 0, margin: '1rem 0', padding: '0.75rem' } },
    h('legend', null, meal.name),
    ...meal.items.map((item, ii) => h('div', { key: ii, style: { ...grid, marginBottom: '0.75rem' } },
      h('label', null, `Fødevare ${ii + 1} i ${meal.name}`, h('select', {
        name: `food-${mi}-${ii}`, style: control, value: item.food.id,
        onChange: event => actions.editFood(mi, ii, event.currentTarget.value),
      }, ...s.foods.map(food => h('option', { key: food.id, value: food.id }, food.name)))),
      field(`grams-${mi}-${ii}`, `Gram af ${item.food.name} i ${meal.name}`, item.grams,
        value => actions.editGrams(mi, ii, value)))),
    h('p', null, macroText(totals([meal]))))),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' } },
      h('button', { type: 'button', style: button, disabled: busy || !s.canSaveAdapter || !s.planTargets || !s.totals
        || s.saved?.status === 'active' && !s.dirty, onClick: () => actions.save() }, 'Gem som kladde'),
      h('button', { type: 'button', style: button, disabled: busy || !s.canActivateAdapter || !s.saved
        || s.saved.status !== 'draft' || s.dirty || !s.planTargets || !s.totals,
      onClick: () => actions.activate() }, 'Aktivér for atleten')),
    !s.canSaveAdapter && h('p', null, 'Gemning er ikke tilgængelig. Kladden er kun på skærmen.'),
    !s.canActivateAdapter && h('p', null, 'Aktivering er ikke tilgængelig.')),
  h('details', null,
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Tidligere planer og atletens respons'),
    s.history.state !== 'ready' && h('p', { role: s.history.state === 'error' ? 'alert' : 'status' },
      s.history.state === 'error' ? 'Tidligere planer og respons kunne ikke hentes. Oversigten kan være ufuldstændig.' : 'Tidligere planer og respons er endnu ikke indlæst.'),
    s.history.state === 'ready' && !s.history.plans.length && h('p', null, 'Ingen tidligere planer eller respons.'),
    ...s.history.plans.map(plan => h('article', { key: plan.id },
      h('h3', null, `${plan.date} · ${statuses[plan.status]} · ${GOALS[plan.goal]}`),
      h('p', null, macroText(totals(plan.meals))),
      h('ul', null, ...plan.meals.map(meal => h('li', { key: meal.id }, `${meal.name}: `,
        meal.items.map(item => `${format(Number(item.grams))} g ${item.food.name}`).join(', ')))),
      ...s.history.responses.filter(row => row.planId === plan.id).map((row, index) => h('p', { key: index }, `${row.date} · Atletens respons: ${row.text}`)),
      !s.history.responses.some(row => row.planId === plan.id) && h('p', null, 'Ingen respons fra atleten endnu.')))))
}
