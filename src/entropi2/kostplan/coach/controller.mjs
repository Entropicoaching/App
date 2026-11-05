import { NAMESPACE, CONTEXT_LABELS, GOALS, INTENSITIES, identifier, day, number, copy, freeze,
  catalogFoods, targets, nutritionProposal, totals, generateMeals, historyReceipt, normalizePlan } from './model.mjs'
import { recipeItems, proteinDistribution } from './connections.mjs'
import { generateCoachGrams, gramFeedback } from './gramPlan.mjs'

// All side effects are explicit coach actions through the two supplied functions.
// The adapter owns authorization, atomic activation and optimistic concurrency.
export function createCoachPlan(options = {}) {
  if (options.enabled !== true) return Object.freeze({ snapshot: () => null, subscribe: () => () => {},
    set: () => false, generate: () => false, editGrams: () => false, editFood: () => false, editBounds: () => false, chooseRecipe: () => false,
    save: async () => false, activate: async () => false })
  const athleteId = options.athlete?.id, date = options.date
  if (!identifier(athleteId) || !day(date)) throw new TypeError('Vælg en atlet og en gyldig dato.')
  const foods = catalogFoods(options.catalog) ?? []
  const weightKg = number(options.athlete.bodyweight, 350)
  const template = copy(options.template ?? [])
  const basis = options.basis?.athleteId === athleteId && options.basis?.date === date ? options.basis : {}
  // Undefined selects the explicit manual-target workflow from delivery 1.
  // A supplied but invalid/mismatched calculation never falls back to that path.
  const calculation = basis.calculation === undefined ? undefined
    : basis.calculation?.date === date ? copy(basis.calculation) : null
  const gramGenerator = options.gramGenerator === true && calculation != null
  const context = Object.fromEntries(Object.keys(CONTEXT_LABELS).map(key => [key,
    typeof basis.context?.[key] === 'string' && basis.context[key].trim() && basis.context[key].length <= 600
      ? basis.context[key].trim() : null]))
  const history = historyReceipt(options.history, athleteId)
  const saveDraft = options.saveDraft, activatePlan = options.activatePlan
  let form = { goal: Object.hasOwn(GOALS, options.goal) ? options.goal : 'maintain', intensity: 10,
    maintenanceKcal: number(basis.maintenanceKcal) ?? '', protein: number(basis.protein) ?? '', fat: number(basis.fat) ?? '' }
  const athleteName = typeof options.athlete.name === 'string' && options.athlete.name.trim()
    && options.athlete.name.length <= 160 ? options.athlete.name.trim() : 'Valgt atlet'
  const localDraftOnly = options.localDraftOnly === true
  const restored = localDraftOnly ? options.restoreDraft : null
  const restoredPlan = restored && normalizePlan(restored.plan, athleteId)
  if (restored && (!restoredPlan || restoredPlan.status !== 'draft' || restoredPlan.date !== date
    || !Number.isSafeInteger(restored.clientVersion) || restored.clientVersion < 0
    || !restored.form || restored.form.goal !== restoredPlan.goal || restored.form.intensity !== restoredPlan.intensity
    || JSON.stringify(targets(restored.form, restored.calculation)) !== JSON.stringify(restoredPlan.targets)))
    throw new TypeError('Den lokale kladde er ugyldig.')
  if (restoredPlan) form = copy(restored.form)
  let state = { localDraftOnly, gramGenerator, generation: null, athleteId, athleteName, date, foods, form, context, history, meals: [], planTargets: null,
    version: 0, saved: null, busy: null, error: null, message: null,
    calculated: calculation !== undefined,
    canSaveAdapter: typeof saveDraft === 'function', canActivateAdapter: typeof activatePlan === 'function' }
  let draftBase = null
  if (restoredPlan) {
    draftBase = { planId: restoredPlan.id, revision: restoredPlan.revision }
    const current = JSON.stringify(targets(form, calculation)) === JSON.stringify(restoredPlan.targets)
    state = { ...state, form, meals: restoredPlan.meals, planTargets: current ? restoredPlan.targets : null,
      version: restored.clientVersion, saved: { ...draftBase, status: 'draft', clientVersion: restored.clientVersion },
      message: current ? 'Lokal kladde indlæst.' : 'Lokal kladde indlæst. Beregningsgrundlaget er ændret; generér igen før gemning.' }
  }
  const listeners = new Set()
  let snapshot
  const publish = patch => {
    state = { ...state, ...patch }
    snapshot = freeze(copy({ ...state, suggestion: targets(state.form, calculation),
      proposal: calculation === undefined ? null : nutritionProposal(state.form, calculation), totals: totals(state.meals),
      gramFeedback: gramGenerator ? gramFeedback(totals(state.meals), state.planTargets, state.generation) : null,
      proteinDistribution: proteinDistribution(state.meals, state.planTargets, weightKg),
      dirty: state.meals.length > 0 && state.saved?.clientVersion !== state.version }))
    for (const listener of listeners) listener()
  }
  publish({})
  const edit = patch => {
    if (state.busy) return false
    // Editing an activated plan starts a new draft; it never updates that plan.
    if (state.saved?.status === 'active') draftBase = null
    publish({ generation: null, ...patch, version: state.version + 1, error: null, message: null })
    return true
  }
  const validCurrent = () => state.planTargets && totals(state.meals) && targets(state.form, calculation)
    && JSON.stringify(state.planTargets) === JSON.stringify(targets(state.form, calculation))
  function receiptMatches(receipt, request, status) {
    return receipt?.ok === true && receipt.namespace === NAMESPACE && receipt.athleteId === athleteId
      && receipt.date === date && receipt.clientVersion === request.clientVersion && receipt.status === status
      && identifier(receipt.planId) && identifier(receipt.revision)
  }
  const controller = Object.freeze({
    snapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    set(field, value) {
      if (!['goal', 'intensity', 'maintenanceKcal', 'protein', 'fat'].includes(field)) return false
      if (state.calculated && ['protein', 'fat'].includes(field)) return false
      if (field === 'goal' && !Object.hasOwn(GOALS, value) || field === 'intensity' && !INTENSITIES.includes(value)) return false
      if (!['goal', 'intensity'].includes(field) && typeof value !== 'string' && typeof value !== 'number') return false
      // New target inputs require regeneration, so the saved foods cannot acquire new targets silently.
      return edit({ form: { ...state.form, [field]: value }, planTargets: null })
    },
    generate(selection) {
      if (state.busy) return false
      const suggestion = targets(state.form, calculation)
      if (!suggestion) { publish({ error: state.calculated
        ? 'Beregningsgrundlaget mangler eller er ugyldigt. Kontrollér atlet, dato, voksenstatus, kropsvægt og vedligeholdelsesenergi.'
        : 'Angiv gyldig vedligeholdelsesenergi, protein og fedt. Makroerne skal kunne rummes i energimålet.' }); return false }
      if (gramGenerator) {
        try {
          const chosen = selection ?? (state.meals.length ? state.meals.map(meal => ({ id: meal.id, name: meal.name,
            items: meal.items.map(item => ({ foodId: item.food.id, minGrams: item.minGrams, maxGrams: item.maxGrams })) })) : template)
          const generated = generateCoachGrams(chosen, suggestion, foods)
          return edit({ meals: generated.meals, planTargets: suggestion, generation: generated.result })
        } catch {
          publish({ error: 'Forslaget kunne ikke genereres. Vælg mindst én kendt fødevare pr. måltid og min./maks. i trin på 5 g fra 5 til 1.000 g. Brug hver fødevare én gang pr. måltid.' })
          return false
        }
      }
      const meals = generateMeals(template, foods, suggestion.kcal)
      if (!meals) { publish({ error: 'Et forslag kræver et gyldigt fødevarekatalog og en måltidsskabelon fra coachen.' }); return false }
      return edit({ meals, planTargets: suggestion })
    },
    editGrams(mealIndex, itemIndex, value) {
      if (!state.meals[mealIndex]?.items[itemIndex] || typeof value !== 'string' && typeof value !== 'number') return false
      const meals = copy(state.meals); meals[mealIndex].items[itemIndex].grams = value
      return edit({ meals })
    },
    editFood(mealIndex, itemIndex, foodId) {
      const food = foods.find(row => row.id === foodId)
      if (!food || !state.meals[mealIndex]?.items[itemIndex]) return false
      const meals = copy(state.meals); meals[mealIndex].items[itemIndex].food = copy(food)
      return edit({ meals })
    },
    editBounds(mealIndex, itemIndex, field, value) {
      if (!gramGenerator || !['minGrams', 'maxGrams'].includes(field)
        || !state.meals[mealIndex]?.items[itemIndex] || typeof value !== 'string' && typeof value !== 'number') return false
      const meals = copy(state.meals); meals[mealIndex].items[itemIndex][field] = value
      return edit({ meals, planTargets: null })
    },
    chooseRecipe(mealIndex, recipeId) {
      if (gramGenerator || state.busy || !Number.isInteger(mealIndex) || !state.meals[mealIndex]) return false
      const kcal = totals([state.meals[mealIndex]])?.kcal
      const items = recipeItems(recipeId, foods, kcal ?? 0)
      if (!items) {
        publish({ error: 'Måltidet kunne ikke erstattes. Kontrollér opskrift, fødevarer og gram.' }); return false
      }
      const meals = copy(state.meals)
      meals[mealIndex].items = items.map(item => ({ grams: item.grams, food: copy(foods.find(food => food.id === item.foodId)) }))
      return edit({ meals })
    },
    async save() {
      if (state.busy) return false
      if (!validCurrent()) { publish({ error: 'Generér en dagsplan med de aktuelle mål, og ret ugyldige gram før gemning.' }); return false }
      if (typeof saveDraft !== 'function') { publish({ error: 'Gemning er ikke tilgængelig. Kladden er kun på skærmen.' }); return false }
      if (state.saved?.status === 'active' && state.saved.clientVersion === state.version) return false
      const plan = { namespace: NAMESPACE, athleteId, date, goal: state.form.goal, intensity: state.form.intensity,
        targets: copy(state.planTargets), meals: copy(state.meals) }
      for (const meal of plan.meals) for (const item of meal.items) item.grams = number(item.grams)
      const request = { namespace: NAMESPACE, athleteId, date, clientVersion: state.version,
        planId: draftBase?.planId ?? null, revision: draftBase?.revision ?? null, plan }
      publish({ busy: 'save', error: null, message: null })
      try {
        const receipt = await saveDraft(copy(request))
        if (!receiptMatches(receipt, request, 'draft')
          || draftBase && (receipt.planId !== draftBase.planId || receipt.revision === draftBase.revision)
          || state.history.plans.some(row => row.id === receipt.planId && row.id !== draftBase?.planId)) throw Error('Invalid receipt')
        draftBase = { planId: receipt.planId, revision: receipt.revision }
        const saved = { ...draftBase, clientVersion: request.clientVersion, status: 'draft' }
        const record = { ...plan, id: saved.planId, revision: saved.revision, status: 'draft' }
        publish({ busy: null, saved, message: localDraftOnly ? 'Lokal kladde gemt.'
          : 'Kladde gemt. Atleten ser den først efter aktivering.',
          history: { ...state.history, plans: [record, ...state.history.plans.filter(row => row.id !== record.id)] } })
        return true
      } catch {
        publish({ busy: null, error: 'Kladden blev ikke bekræftet gemt. Dine rettelser er bevaret. Prøv igen.' })
        return false
      }
    },
    async activate() {
      if (localDraftOnly) return controller.save()
      if (state.busy) return false
      const saved = state.saved
      if (!saved || saved.status !== 'draft' || saved.clientVersion !== state.version || !validCurrent()) {
        publish({ error: 'Gem de aktuelle rettelser som kladde før aktivering.' }); return false
      }
      if (typeof activatePlan !== 'function') { publish({ error: 'Aktivering er ikke tilgængelig. Planen er stadig en kladde.' }); return false }
      const request = { namespace: NAMESPACE, athleteId, date, planId: saved.planId,
        revision: saved.revision, clientVersion: saved.clientVersion }
      publish({ busy: 'activate', error: null, message: null })
      try {
        const receipt = await activatePlan(copy(request))
        if (!receiptMatches(receipt, request, 'active') || receipt.planId !== saved.planId
          || receipt.revision === saved.revision) throw Error('Invalid receipt')
        const plans = state.history.plans.map(plan => plan.id === saved.planId
          ? { ...plan, status: 'active', revision: receipt.revision }
          : plan.date === date && plan.status === 'active' ? { ...plan, status: 'archived' } : plan)
        publish({ busy: null, saved: { ...saved, status: 'active', revision: receipt.revision },
          history: { ...state.history, plans }, message: 'Planen er aktiveret for atleten.' })
        return true
      } catch {
        publish({ busy: null, error: 'Aktivering blev ikke bekræftet. Kladden er bevaret. Prøv igen.' })
        return false
      }
    },
  })
  return controller
}
