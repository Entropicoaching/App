import { GOALS, INTENSITIES, CONTEXT_LABELS, totals } from './model.mjs'
import { recipeChoices } from './connections.mjs'
import { suggestionReason } from '../generator/reasons.mjs'

const format = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })
const macroText = value => value
  ? `${format(value.kcal)} kcal · ${format(value.protein)} g protein · ${format(value.carb)} g kulhydrat · ${format(value.fat)} g fedt`
  : 'Kan ikke beregnes. Ret gram til et tal over 0 og højst 10.000.'
const control = { minHeight: 44, width: '100%', maxWidth: '100%', boxSizing: 'border-box', font: 'inherit' }
const button = { ...control, width: 'auto', padding: '0.5rem 1rem', whiteSpace: 'normal' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))', gap: '0.75rem' }
const statuses = { draft: 'Kladde', active: 'Aktiv', archived: 'Tidligere aktiv' }

export function recipeChoice(h, { foods, name, mealName, disabled, onChoose, scaled = false }) {
  const recipes = recipeChoices(foods)
  if (!recipes.length) return null
  return h('label', { style: { display: 'grid', gap: '0.25rem', marginBottom: '0.75rem' } },
    `Hurtigt opskriftsvalg til ${mealName}${scaled ? ' (bevarer måltidets kcal)' : ''}`,
    h('select', { name, value: '', style: control, disabled,
      onChange: event => { if (event.currentTarget.value) onChoose(event.currentTarget.value) } },
      h('option', { value: '' }, 'Vælg opskrift'),
      ...recipes.map(recipe => h('option', { key: recipe.id, value: recipe.id }, recipe.name))))
}

// The application passes React.createElement. Hermetic tests pass a tiny element
// factory to exercise this exact view and its event handlers without a browser.
export function coachPlanView(h, snapshot, actions) {
  if (!snapshot) return null
  const s = snapshot, busy = Boolean(s.busy)
  const context = Object.entries(CONTEXT_LABELS).filter(([key]) =>
    typeof s.context[key] === 'string' && s.context[key].trim())
  const active = s.history.plans.find(plan => plan.date === s.date && plan.status === 'active')
  const field = (name, title, value, handler) => h('label', { key: name, style: { display: 'grid', gap: '0.25rem' } }, title,
    h('input', { name, style: control, value, type: 'text', inputMode: 'decimal', disabled: busy,
      onChange: event => handler(event.currentTarget.value) }))
  return h('section', { className: 'e2-coach-plan', 'aria-label': 'Coachens kostplan', 'aria-busy': busy,
    style: { maxWidth: '46rem', width: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere', padding: '1rem' } },
  h(s.localDraftOnly ? 'h3' : 'h2', null, s.localDraftOnly ? 'Dagsplan' : 'Kostplan'),
  h('p', null, `${s.athleteName} · ${s.date}`),
  !(s.localDraftOnly && s.publishedVersion === s.version) && h('p', null, s.localDraftOnly ? s.canPublish || s.activationError ? 'Lokal kladde' : 'Lokal kladde · ikke delt med atleten' : active ? 'Atleten har en aktiv dagsplan. Dine rettelser bliver først synlige efter ny aktivering.'
    : s.history.state === 'ready' ? 'Ingen aktiv dagsplan for denne dato. Atleten kan bruge kcal-trackeren.'
      : 'Status for atletens aktive dagsplan er endnu ikke tilgængelig.'),
  h('form', { onSubmit: event => { event.preventDefault(); if (!s.localDraftOnly || s.meals.length) actions.generate() } },
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
        field('maintenanceKcal', s.gramGenerator ? 'Vedligeholdelsesenergi (kcal, valgfrit estimat)' : 'Vedligeholdelsesenergi (kcal)', s.form.maintenanceKcal, value => actions.set('maintenanceKcal', value)),
        !s.calculated && field('protein', 'Proteinmål (g)', s.form.protein, value => actions.set('protein', value)),
        !s.calculated && field('fat', 'Fedtmål (g)', s.form.fat, value => actions.set('fat', value))),
      h('p', null, s.gramGenerator
        ? 'Målene beregnes fra profilens alder, kropsvægt og dit valgte mål. Tom vedligehold bruger modellens foreløbige vægtestimat. Træningsbelastning, dagsform og historik er ikke koblet ind; modellen bruger en hviledag som standard. Gennemgå portionerne før lokal gemning.'
        : s.calculated
        ? 'Forslaget bruger atletens beregningsgrundlag. Træning, dagsform og modellens gulve kan ændre procentmålet. Coachen skal gennemgå og aktivere planen.'
        : 'Bulk lægger den valgte procent til, cut trækker den fra. Vedligehold bruger 0 %. Kulhydrat udfylder resten af energimålet.'),
      (!s.localDraftOnly || s.meals.length > 0) && h('button', { type: 'submit', style: button }, s.gramGenerator ? 'Generér forslag' : s.meals.length ? 'Generér ny dagsplan' : 'Generér dagsplan'))),
  s.suggestion && !s.planTargets && h('p', null, `Forslag til dagens mål: ${macroText(s.suggestion)}`),
  (context.length > 0 || s.proposal?.reasons.length > 0) && h('details', null,
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, context.length ? 'Grundlag og tidligere erfaringer' : 'Beregningsgrundlag'),
    h('p', null, s.calculated ? 'Beregningsgrundlaget bruges kun for den valgte atlet og dato. Frie kontekstnoter indgår ikke automatisk i beregningen.'
      : 'Coachen angiver udgangspunktet og tilpasser det efter atletens data. Procentforslaget vurderer ikke disse oplysninger automatisk.'),
    s.proposal && h('ul', null, ...s.proposal.reasons.map(reason => h('li', { key: reason.code }, reason.text))),
    h('dl', null, ...context.flatMap(([key, title]) => [
      h('dt', { key: `${key}-title` }, title), h('dd', { key }, s.context[key]),
    ]))),
  s.error && h('p', { role: 'alert' }, s.error),
  s.activationError && h('p', { role: 'alert' }, s.activationError),
  s.proposal?.warnings.map((warning, index) => h('p', { key: index, role: 'status' }, warning)),
  (busy || s.message || s.meals.length > 0) && h('p', { role: 'status', 'aria-live': 'polite' }, busy
    ? s.busy === 'save' ? 'Gemmer kladde…' : 'Aktiverer planen…'
    : s.message ?? (s.meals.length ? s.dirty ? 'Rettelserne er ikke gemt.' : s.saved?.status === 'active' ? 'Denne plan er aktiv.' : 'Kladde gemt.' : '')),
  s.meals.length > 0 && h('section', { 'aria-label': 'Dagsplan til gennemgang' },
    h('h3', null, 'Dagsplan til gennemgang'),
    h('p', null, s.gramGenerator
      ? 'Forslaget fordeler gram inden for portionsgrænserne. Tomme måltider får prioriterede katalogvarer med foreløbige grænser på 5–300 g pr. fødevare. Du kan rette fødevarer, grænser og gram før gemning. En ny generering bevarer fødevarevalgene og bruger grænserne igen.'
      : 'Måltidsskabelonen skaleres efter energi og afrundes til hele gram. Kontrollér fødevarer, tilberedning og fordeling før gemning.'),
    s.gramFeedback && h('p', { role: 'status', 'aria-live': 'polite' }, s.gramFeedback.message),
    s.planTargets ? h('div', { style: { overflowX: 'auto' } }, h('table', { style: { width: '100%', textAlign: 'left' } },
      h('caption', null, 'Dagens plan og mål'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Indhold'), h('th', { scope: 'col' }, 'Plan'), h('th', { scope: 'col' }, 'Mål'),
        s.gramGenerator && h('th', { scope: 'col' }, 'Afvigelse'))),
      h('tbody', null, ...[['kcal', 'Energi', 'kcal'], ['protein', 'Protein', 'g'], ['carb', 'Kulhydrat', 'g'], ['fat', 'Fedt', 'g']]
        .map(([key, title, unit]) => h('tr', { key }, h('th', { scope: 'row' }, title),
          h('td', null, s.totals ? `${format(s.totals[key])} ${unit}` : 'Kan ikke beregnes'),
          h('td', null, `${format(s.planTargets[key])} ${unit}`),
          s.gramGenerator && h('td', null, s.gramFeedback
            ? `${s.gramFeedback.deviation[key] > 0 ? '+' : ''}${format(s.gramFeedback.deviation[key])} ${unit}` : 'Kan ikke beregnes'))))))
      : h('p', { role: 'status' }, s.gramGenerator
        ? 'Mål eller portionsgrænser er ændret. Generér et nyt forslag før gemning.'
        : 'Målene er ændret. Generér en ny dagsplan før gemning.'),
    s.gramFeedback && h('details', null,
      h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Om afvigelser og tolerance'),
      h('p', null, 'Afvigelse er plan minus mål. Tolerance er det største af 5 % af målet og henholdsvis 50 kcal, 5 g protein, 10 g kulhydrat og 3 g fedt. Det er en planlægningsregel. Der optimeres på dagens sum; måltidernes fordeling skal gennemgås.'),
      h('p', null, 'Tomme måltider får prioriterede katalogvarer efter måltidets navn: morgenmad, frokost, aftensmad eller mellemmåltid. Varerne roterer efter dagens valg; samme input giver samme forslag. Andre måltidsnavne bruger makroindhold og rotation. Udvalget kan begrænse variationen. Træningstid, allergier og præferencer er ikke koblet ind.'),
      h('p', null, `Dagens tolerance: ±${format(s.gramFeedback.tolerance.kcal)} kcal · ±${format(s.gramFeedback.tolerance.protein)} g protein · ±${format(s.gramFeedback.tolerance.carb)} g kulhydrat · ±${format(s.gramFeedback.tolerance.fat)} g fedt.`)),
    ...s.meals.map((meal, mi) => h('fieldset', { key: meal.id, disabled: busy,
      style: { minWidth: 0, margin: '1rem 0', padding: '0.75rem' } },
    h('legend', null, meal.name),
    s.proteinDistribution && h('small', {
      'aria-label': `Proteinfordeling i ${meal.name}: ${s.proteinDistribution.meals[mi].belowThreshold === null ? 'ukendt' : s.proteinDistribution.meals[mi].belowThreshold ? 'under pejlemærke' : 'pejlemærke nået'}. Pejlemærke ${format(s.proteinDistribution.thresholdG)} g ud fra profilvægten.`,
    }, `Proteinfordeling: ${s.proteinDistribution.meals[mi].belowThreshold === null ? 'ukendt' : s.proteinDistribution.meals[mi].belowThreshold ? 'under pejlemærke' : 'pejlemærke nået'}`),
    !s.gramGenerator && recipeChoice(h, { foods: s.foods, name: `recipe-${mi}`, mealName: meal.name, disabled: busy,
      scaled: true, onChoose: recipeId => actions.chooseRecipe(mi, recipeId) }),
    ...meal.items.map((item, ii) => h('div', { key: ii, style: { ...grid, marginBottom: '0.75rem' } },
      h('label', null, `Fødevare ${ii + 1} i ${meal.name}`, h('select', {
        name: `food-${mi}-${ii}`, style: control, value: item.food.id,
        onChange: event => actions.editFood(mi, ii, event.currentTarget.value),
      }, ...s.foods.map(food => h('option', { key: food.id, value: food.id }, food.name)))),
      field(`grams-${mi}-${ii}`, `Gram af ${item.food.name} i ${meal.name}`, item.grams,
        value => actions.editGrams(mi, ii, value)),
      s.gramGenerator && suggestionReason(item.food.id, item.food.nutrition?.prioritetBegrundelse)
        && h('small', { style: { gridColumn: '1 / -1' } },
          suggestionReason(item.food.id, item.food.nutrition.prioritetBegrundelse)))),
    s.gramGenerator && h('details', null,
      h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, `Portionsgrænser i ${meal.name}`),
      h('p', null, 'Grænser bruges ved næste generering. Vælg min./maks. i trin på 5 g fra 5 til 1.000 g.'),
      ...meal.items.map((item, ii) => h('div', { key: ii, style: grid },
        ...[['minGrams', 'Mindst'], ['maxGrams', 'Højst']].map(([key, title]) =>
          field(`${key}-${mi}-${ii}`, `${title} gram af ${item.food.name} i ${meal.name}`, item[key] ?? '',
            value => actions.editBounds(mi, ii, key, value)))))),
    h('p', null, macroText(totals([meal]))))),
    s.proteinDistribution && h('details', null,
      h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Om proteinfordelingen'),
      h('p', null, `Markeringen bruger profilvægten ${format(s.proteinDistribution.weightKg)} kg og 0,3 g/kg pr. måltid som planlægningspejlemærke. Det er hverken et individuelt minimum eller et loft. Dagens proteinmål ændres ikke; ingen fødevarer tilføjes automatisk.`)),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' } },
      h('button', { type: 'button', style: button, disabled: busy || !s.canSaveAdapter || !s.planTargets || !s.totals
        || s.saved?.status === 'active' && !s.dirty, onClick: () => actions.save() }, 'Gem som kladde'),
      h('button', { type: 'button', style: button, disabled: s.localDraftOnly ? busy || !s.canSaveAdapter || !s.planTargets || !s.totals
        || s.canPublish && (!s.saved || s.dirty || s.publishedVersion === s.version)
        : busy || !s.canActivateAdapter || !s.saved || s.saved.status !== 'draft' || s.dirty || !s.planTargets || !s.totals,
        onClick: () => actions.activate() }, s.localDraftOnly && !s.canPublish ? 'Markér lokal kladde som klar' : 'Aktivér for atleten')),
    !s.canSaveAdapter && h('p', null, 'Gemning er ikke tilgængelig. Kladden er kun på skærmen.'),
    !s.localDraftOnly && !s.canActivateAdapter && h('p', null, 'Aktivering er ikke tilgængelig.')),
  !s.localDraftOnly && h('details', null,
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
