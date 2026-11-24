import { calendarTime, parseInputNumber, roundNutrition } from '../../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'
import { retainedNutrition, plannedMicronutrients } from './plannedMicronutrients.mjs'
import { friProcent, skalerMaaltider, erFriRaekke } from '../friPulje.mjs'

export const namespace = 'entropi2:kostplan:atlet:v1'
export const metrics = ['kcal', 'protein', 'carb', 'fat']
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const name = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const fail = () => { throw new TypeError('Ugyldigt kostplangrundlag') }
const unique = items => new Set(items.map(item => item.id)).size === items.length
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export const mealKey = (athleteId, date, plan, mealId) => JSON.stringify([
  namespace, athleteId, date, plan.id, plan.revision, mealId,
])

// No missing nutrient becomes a known zero. Round once, at meal level.
export function mealValues(foods) {
  const totals = Object.fromEntries(metrics.map(key => [key, 0]))
  if (!foods.some(food => parseInputNumber(food.grams) > 0)) return null
  for (const food of foods) {
    const grams = parseInputNumber(food.grams)
    if (grams === null) return null
    for (const key of metrics) {
      const per100 = parseInputNumber(food[key + '100'])
      if (per100 === null) return null
      totals[key] += per100 * grams / 100
      if (!Number.isFinite(totals[key])) return null
    }
  }
  return Object.fromEntries(metrics.map(key => [key, roundNutrition(totals[key])]))
}

// 1924: et spist planmåltid til en ny samlet mængde. Hver fødevare skaleres med
// samme faktor (0,1 g), og tallene regnes fra de skalerede gram som ved Spist.
export function scaledMeal(foods, grams) {
  const total = parseInputNumber(grams)
  const before = foods.reduce((sum, food) => sum + (parseInputNumber(food.grams) ?? NaN), 0)
  if (!(total > 0) || !(before > 0) || !Number.isFinite(total)) return null
  const scaled = foods.map(food => ({ ...food, grams: Math.round(parseInputNumber(food.grams) * total / before * 10) / 10 }))
  const values = mealValues(scaled)
  return values && { grams: total, foods: scaled, values }
}

export function readAthletePlan(value, athleteId, date) {
  if (value === null) return null
  if (!value || value.athlete_id !== athleteId || value.date !== date || typeof value.active !== 'boolean') fail()
  if (!value.active) return null
  if (!id(value.id) || !id(value.revision) || !Array.isArray(value.meals) || value.meals.length > 30) fail()
  const meals = value.meals.map(meal => {
    if (!id(meal?.id) || !name(meal.name) || isDayReceipt({ meal: meal.name.trimStart() })
      || !Array.isArray(meal.foods) || !meal.foods.length || meal.foods.length > 100) fail()
    const foods = meal.foods.map(food => {
      const grams = parseInputNumber(food?.grams)
      if (!id(food?.id) || !name(food.name) || grams === null || grams <= 0) fail()
      const macros = Object.fromEntries(metrics.map(key => [key + '100', parseInputNumber(food[key + '100'])]))
      const retained = retainedNutrition(food.nutrition)
      // Optional evidence must describe this same projected food, not another line.
      const nutrition = retained.nutrition
      const matches = nutrition && nutrition.name.trim() === food.name.trim()
        && ['energyKcal', 'proteinG', 'carbohydrateG', 'fatG'].every((key, i) => nutrition.nutrientsPer100g[key] === macros[metrics[i] + '100'])
      return { id: food.id, name: food.name.trim(), grams, ...macros, ...(matches ? retained : {}) }
    })
    if (!unique(foods)) fail()
    return { id: meal.id, name: meal.name.trim(), foods }
  })
  if (!unique(meals)) fail()
  const targets = Object.fromEntries(metrics.map(key => {
    const valueForKey = parseInputNumber(value.targets?.[key])
    // Approved portion content may be a known zero; it is not a personal goal.
    return [key, valueForKey]
  }))
  const portionGuidance = value.portionGuidance ?? null
  if (portionGuidance !== null && (typeof portionGuidance !== 'string'
    || !portionGuidance.trim() || Array.from(portionGuidance).length > 4000)) fail()
  // 2137: friPct > 0 skalerer måltiderne til basen (protein uændret); dagens kcal = base + pulje.
  const friPct = friProcent(value.friPct)
  const dagKcal = targets.kcal
  if (friPct > 0 && dagKcal > 0) {
    const scaled = skalerMaaltider(meals, friPct)
    const sumMacro = key => Math.round(scaled.meals.flatMap(meal => meal.foods)
      .reduce((n, food) => n + (food[key + '100'] ?? 0) * food.grams / 100, 0))
    const friKcal = Math.round(dagKcal * friPct / 100)
    const planned_ = plannedMicronutrients(scaled.meals)
    return { id: value.id, revision: value.revision, athlete_id: athleteId, date, meals: scaled.meals, portionGuidance,
      targets: { ...targets, kcal: dagKcal - friKcal, carb: sumMacro('carb'), fat: sumMacro('fat') },
      friPct, friKcal, dagKcal,
      ...(planned_.length ? { plannedMicronutrients: planned_ } : {}) }
  }
  const planned = plannedMicronutrients(meals)
  return { id: value.id, revision: value.revision, athlete_id: athleteId, date, meals, targets, portionGuidance,
    ...(planned.length ? { plannedMicronutrients: planned } : {}) }
}

function readDay(value, athleteId, date) {
  if (!value || !Object.hasOwn(value, 'plan')) fail()
  const plan = readAthletePlan(value.plan, athleteId, date)
  if (!plan) return { plan: null, logs: [], eaten: [], blockedMeals: [] }
  if (!Array.isArray(value.logs) || !Array.isArray(value.eaten)) fail()
  const logs = value.logs.map(row => {
    if (!id(row?.id) || row.athlete_id !== athleteId || calendarTime(row.date) === null || row.date > date) fail()
    return { id: row.id, athlete_id: athleteId, date: row.date, meal: row.meal,
      ...Object.fromEntries(metrics.map(key => [key, parseInputNumber(row[key])])) }
  }).filter(row => row.date === date && !isDayReceipt(row))
  if (!unique(logs)) fail()
  const eaten = value.eaten.map(receipt => {
    const meal = plan.meals.find(item => item.id === receipt?.meal_id)
    const log = logs.find(row => row.id === receipt?.log_id)
    if (!meal || !log || receipt.key !== mealKey(athleteId, date, plan, meal.id)
      || !Array.isArray(receipt.foods) || receipt.foods.length !== meal.foods.length || !unique(receipt.foods)) fail()
    const foods = meal.foods.map(food => {
      const grams = parseInputNumber(receipt.foods.find(item => item.id === food.id)?.grams)
      if (grams === null) fail()
      return { ...food, grams }
    })
    const totals = mealValues(foods)
    if (!totals || metrics.some(key => totals[key] !== log[key])) fail()
    return { meal_id: meal.id, log_id: log.id, key: receipt.key, foods }
  })
  if (new Set(eaten.map(item => item.meal_id)).size !== eaten.length
    || new Set(eaten.map(item => item.log_id)).size !== eaten.length) fail()
  const blockedMeals = value.blockedMeals ?? []
  if (!Array.isArray(blockedMeals) || new Set(blockedMeals).size !== blockedMeals.length
    || blockedMeals.some(mealId => !plan.meals.some(meal => meal.id === mealId)
      || eaten.some(receipt => receipt.meal_id === mealId))) fail()
  return { plan, logs, eaten, blockedMeals: [...blockedMeals] }
}

// One immutable athlete/day session. The owner disposes and replaces it when
// athlete, day, activation or plan revision changes. No client or storage globals.
export function createAthleteDay(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date, loadDay, saveMeal, releaseMeal, adjustMeal, currentDay } = options
  if (!id(athleteId) || calendarTime(date) === null || typeof loadDay !== 'function') fail()
  let phase = 'idle', data = null, message = '', pending = null, disposed = false, token = 0
  const drafts = new Map(), editing = new Set(), committed = new Set(), listeners = new Set()
  let cached
  const snapshot = () => {
    if (cached) return cached
    const plan = data?.plan
    const meals = plan?.meals.map(meal => {
      const receipt = data.eaten.find(item => item.meal_id === meal.id)
      const foods = (receipt?.foods || meal.foods).map(food => ({ ...food,
        grams: receipt ? food.grams : (drafts.get(meal.id)?.get(food.id) ?? food.grams) }))
      const values = mealValues(foods)
      const blocked = data.blockedMeals.includes(meal.id)
      return { id: meal.id, name: meal.name, foods, values, eaten: !!receipt || committed.has(meal.id), blocked,
        // 1924: dagbogsrækken bag et spist planmåltid (ikke før genindlæsning efter Spist).
        logId: receipt && receipt.log_id !== receipt.key ? receipt.log_id : null,
        adjusted: foods.some((food, index) => parseInputNumber(food.grams) !== meal.foods[index].grams),
        editing: editing.has(meal.id), canSave: !!values && !receipt && !committed.has(meal.id)
          && !blocked && !pending && ['ready', 'save-error', 'saved'].includes(phase) && typeof saveMeal === 'function' }
    }) || []
    const totals = Object.fromEntries(metrics.map(key => {
      const values = data?.logs.map(row => row[key]) || []
      const sum = values.reduce((total, value) => total + (value ?? 0), 0)
      return [key, values.some(value => value === null) || !Number.isFinite(sum) ? null : sum]
    }))
    // 2137: fri mad (kcal) hører til puljen og trækkes ikke fra basens kcal.
    const friBrugt = plan?.friPct ? data.logs.filter(erFriRaekke).reduce((n, row) => n + (row.kcal ?? 0), 0) : 0
    const remaining = Object.fromEntries(metrics.map(key => [key,
      plan?.targets[key] > 0 && totals[key] !== null
        ? Math.max(0, plan.targets[key] - totals[key] + (key === 'kcal' ? friBrugt : 0)) : null]))
    cached = freeze({ athleteId, date, phase, message, pending: !!pending,
      mode: data ? plan ? 'plan' : 'tracker' : null, meals, totals,
      planId: plan?.id ?? null, planRevision: plan?.revision ?? null,
      ...(plan?.friPct ? { friPct: plan.friPct, friKcal: plan.friKcal, dagKcal: plan.dagKcal } : {}),
      portionGuidance: plan?.portionGuidance ?? null,
      ...(plan?.plannedMicronutrients ? { plannedMicronutrients: plan.plannedMicronutrients } : {}),
      targets: { ...(plan?.targets || {}) }, remaining, loggedCount: data?.logs.length || 0,
      eatenCount: meals.filter(meal => meal.eaten).length,
      canRelease: typeof releaseMeal === 'function',
      canSave: typeof saveMeal === 'function' })
    return cached
  }
  const emit = () => { cached = undefined; if (!disposed) for (const fn of listeners) fn() }
  const mutable = mealId => !disposed && !pending && ['ready', 'saved', 'save-error'].includes(phase)
    && data?.plan?.meals.some(meal => meal.id === mealId) && !committed.has(mealId)
    && !data.blockedMeals.includes(mealId)
    && !data.eaten.some(receipt => receipt.meal_id === mealId)
  const api = {
    snapshot,
    subscribe(fn) { if (disposed) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    async load() {
      if (disposed || pending) return false
      const attempt = ++token
      phase = 'loading'; message = ''; data = null; drafts.clear(); editing.clear(); committed.clear(); emit()
      try {
        const result = await loadDay({ athleteId, date })
        if (disposed || attempt !== token) return false
        data = readDay(result, athleteId, date)
        phase = 'ready'; emit(); return true
      } catch {
        if (disposed || attempt !== token) return false
        phase = 'load-error'; message = 'Dagens kost kunne ikke hentes. Prøv igen.'; emit(); return false
      }
    },
    toggleEdit(mealId) {
      if (!mutable(mealId)) return false
      if (editing.has(mealId)) editing.delete(mealId)
      else editing.add(mealId)
      emit(); return true
    },
    setGrams(mealId, foodId, value) {
      if (!mutable(mealId) || !data.plan.meals.find(meal => meal.id === mealId).foods.some(food => food.id === foodId)) return false
      if (typeof value !== 'number' && typeof value !== 'string') return false
      if (!drafts.has(mealId)) drafts.set(mealId, new Map())
      drafts.get(mealId).set(foodId, value)
      message = ''; emit(); return true
    },
    // Explicit acknowledgement only unlocks a local uncertain receipt. It never
    // logs a meal; the athlete must make a separate logging choice afterwards.
    async confirmNotLogged(mealId) {
      if (disposed || pending || !['ready', 'saved', 'save-error'].includes(phase)
        || !data?.blockedMeals.includes(mealId) || typeof releaseMeal !== 'function') return false
      pending = mealId; phase = 'saving'; message = 'Kontrollerer kostloggen…'; emit()
      let released = false
      try { released = await releaseMeal({ athleteId, date, mealId }) === true }
      catch { /* Keep the block if the read or local receipt write failed. */ }
      pending = null
      if (disposed) return false
      if (released) return api.load()
      phase = 'save-error'; message = 'Måltidet kunne ikke låses op. Kontrollér kostloggen og prøv igen.'; emit(); return false
    },
    async markEaten(mealId) {
      if (!mutable(mealId) || typeof saveMeal !== 'function') return false
      try {
        if (typeof currentDay === 'function' && currentDay() !== date) {
          message = 'Dagen er skiftet. Åbn dagens kost igen før du gemmer.'; emit(); return false
        }
      } catch { message = 'Datoen kunne ikke kontrolleres. Prøv igen.'; emit(); return false }
      const meal = snapshot().meals.find(item => item.id === mealId)
      if (!meal?.values) { message = 'Kontrollér gram og næringsdata. Intet blev gemt.'; emit(); return false }
      const key = mealKey(athleteId, date, data.plan, mealId)
      const payload = freeze({ namespace, key, athlete_id: athleteId, date, plan_id: data.plan.id,
        plan_revision: data.plan.revision, meal_id: mealId,
        foods: meal.foods.map(food => ({ id: food.id, name: food.name, grams: parseInputNumber(food.grams) })),
        log: { meal: meal.name, ...meal.values } })
      pending = key; phase = 'saving'; message = 'Gemmer måltid…'; emit()
      try {
        // Strict true confirms BOTH the diary log and its receipt. The adapter
        // owns the receipt's persistence scope; it must throw on uncertainty so
        // a fresh load can reconcile or explicitly block another attempt.
        const result = await saveMeal(payload)
        if (disposed) return false
        if (result !== true) {
          phase = 'save-error'; message = 'Måltidet blev ikke gemt. Prøv igen.'; return false
        }
        committed.add(mealId)
        data.logs.push({ id: key, athlete_id: athleteId, date, ...meal.values })
        // Retain the actual eaten grams until the next canonical load.
        data.eaten.push({ meal_id: mealId, key, log_id: key,
          foods: meal.foods.map(food => ({ ...food, grams: parseInputNumber(food.grams) })) })
        editing.delete(mealId); phase = 'saved'; message = 'Måltid markeret som spist.'; return true
      } catch {
        if (!disposed) {
          phase = 'uncertain'; message = 'Gemningen kunne ikke bekræftes. Hent dagen igen før du prøver på ny.'
        }
        return false
      } finally { pending = null; emit() }
    },
    // 1924: ny mængde på et spist planmåltid. writeRow er kostloggens egen update
    // af samme række; adapteren holder kvitteringen i trit med rækken.
    async adjustEaten(mealId, grams, writeRow) {
      if (disposed || pending || !['ready', 'saved', 'save-error'].includes(phase) || typeof adjustMeal !== 'function'
        || typeof writeRow !== 'function' || committed.has(mealId)) return false
      const receipt = data?.eaten.find(item => item.meal_id === mealId)
      const meal = data?.plan?.meals.find(item => item.id === mealId)
      if (!receipt || !meal || receipt.log_id === receipt.key || data.blockedMeals.includes(mealId)) return false
      try {
        if (typeof currentDay === 'function' && currentDay() !== date) {
          message = 'Dagen er skiftet. Åbn dagens kost igen før du gemmer.'; emit(); return false
        }
      } catch { message = 'Datoen kunne ikke kontrolleres. Prøv igen.'; emit(); return false }
      const next = scaledMeal(receipt.foods, grams)
      if (!next) { message = 'Skriv en mængde over 0 g. Intet blev gemt.'; emit(); return false }
      const payload = freeze({ key: receipt.key, meal_id: mealId, log_id: receipt.log_id,
        foods: next.foods.map(food => ({ id: food.id, grams: food.grams })), log: { meal: meal.name, ...next.values } })
      pending = receipt.key; phase = 'saving'; message = 'Gemmer mængde…'; emit()
      try {
        const result = await adjustMeal(payload, writeRow)
        if (disposed) return false
        if (result !== true) { phase = 'save-error'; message = 'Mængden blev ikke gemt. Prøv igen.'; return false }
        data.eaten = data.eaten.map(item => item === receipt ? { ...item, foods: next.foods } : item)
        data.logs = data.logs.map(row => row.id === receipt.log_id ? { ...row, ...next.values } : row)
        phase = 'saved'; message = 'Mængden er rettet.'; return true
      } catch {
        if (!disposed) { phase = 'uncertain'; message = 'Rettelsen kunne ikke bekræftes. Hent dagen igen før du prøver på ny.' }
        return false
      } finally { pending = null; emit() }
    },
    dispose() { disposed = true; token++; listeners.clear(); data = null; drafts.clear(); editing.clear(); committed.clear(); cached = undefined },
  }
  return api
}
