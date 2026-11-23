import { addCalendarDays } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { isDayReceipt } from '../../mealEvidence.mjs'

// Dhurvas valg (ordre 1580), ikke Marcs: en kostdag rammer coachens plan, når
// kcal ligger inden for 10 % af planens mål og protein er mindst 90 % af planens mål.
export const KCAL_TOLERANCE = 0.10
export const PROTEIN_MIN_SHARE = 0.90
// Samme grænse som coachens kostlinje: under 4 vurderede dage vises intet.
export const MIN_ASSESSED_DAYS = 4
export const WINDOW_DAYS = 14

const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

// De 14 afsluttede dage før i dag. I dag er ikke færdig og kan ikke ramme eller misse.
export const planWindow = today => ({ start: addCalendarDays(today, -WINDOW_DAYS), end: addCalendarDays(today, -1) })

// Ren: planDays er godkendte dagsreferencer ({ date, state, targets }), meals er atletens
// egne kostrækker. Dage uden godkendt plan, uden log eller med ukendt kcal/protein
// får intet svar. Ingen gæt og intet fald tilbage til profilens kcal_target.
// Ordre 1596: dagsmålingen er delt, så ugerapportens protein og kostlinjen vurderer samme dag ens.
function planMaal(planDays, start, end) {
  return new Map(planDays.filter(d => d?.state === 'approved' && day(d.date)
    && d.date >= start && d.date <= end && positive(d.targets?.kcal) && positive(d.targets?.protein))
    .map(d => [d.date, d.targets]))
}
// Ordre 2030: through er sidste dag i et 7-dages vindue (inklusive i dag), ellers de 14 afsluttede dage.
function dagsSummer({ planDays, meals, today, through } = {}) {
  if (!day(today) || !Array.isArray(planDays) || !Array.isArray(meals)) return new Map()
  const { start, end } = day(through) ? { start: addCalendarDays(through, -6), end: through } : planWindow(today)
  const targets = planMaal(planDays, start, end)
  const eaten = new Map()
  for (const row of meals) {
    if (!row || !day(row.date) || !targets.has(row.date) || isDayReceipt(row)) continue
    const kcal = parseInputNumber(row.kcal), protein = parseInputNumber(row.protein)
    const sum = eaten.get(row.date) ?? { kcal: 0, protein: 0, known: true }
    if (kcal === null || protein === null) sum.known = false
    else { sum.kcal += kcal; sum.protein += protein }
    eaten.set(row.date, sum)
  }
  const result = new Map()
  for (const [date, sum] of eaten) if (sum.known) result.set(date, { sum, goal: targets.get(date) })
  return result
}
const proteinHit = ({ sum, goal }) => sum.protein >= goal.protein * PROTEIN_MIN_SHARE

export function kostDageModPlan(input) {
  const result = new Map()
  for (const [date, entry] of dagsSummer(input))
    result.set(date, Math.abs(entry.sum.kcal - entry.goal.kcal) <= entry.goal.kcal * KCAL_TOLERANCE && proteinHit(entry))
  return result.size >= MIN_ASSESSED_DAYS ? result : new Map()
}

// Ordre 1596: kun proteindelen af samme dagsvurdering, uden grænsen på 4 dage (ugerapporten har ingen).
export function proteinDageModPlan(input) {
  return new Map([...dagsSummer(input)].map(([date, entry]) => [date, proteinHit(entry)]))
}

// Ordre 1619: kulhydrat og fedt pr. dag mod planens dagsmål (flyttet fra kostlinjen, 1615, så kostlinje og
// ugerapport vurderer samme dag ens). dates er de dage, der allerede er vurderet. En dag får kun svar for et
// felt, hvis planen har et mål over 0 og alle dagens rækker har tal (0 er et tal, null er ukendt).
export function makroDageModPlan({ planDays, meals, dates } = {}) {
  const result = { carb: new Map(), fat: new Map() }
  if (!Array.isArray(planDays) || !Array.isArray(meals) || !dates) return result
  const goals = new Map(planDays.filter(d => d?.state === 'approved' && dates.has(d.date)).map(d => [d.date, d.targets]))
  const eaten = new Map()
  for (const row of meals) {
    if (!row || !dates.has(row.date) || isDayReceipt(row)) continue
    const sum = eaten.get(row.date) ?? { carb: 0, fat: 0, carbKnown: true, fatKnown: true }
    for (const key of ['carb', 'fat']) {
      const value = parseInputNumber(row[key])
      if (value === null) sum[key + 'Known'] = false; else sum[key] += value
    }
    eaten.set(row.date, sum)
  }
  for (const [date, sum] of eaten) for (const key of ['carb', 'fat']) {
    const goal = goals.get(date)?.[key]
    if (!sum[key + 'Known'] || typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0) continue
    result[key].set(date, Math.abs(sum[key] - goal) <= goal * KCAL_TOLERANCE)
  }
  return result
}

// Ordre 2030: coachens "dage inden for mål" for de 7 dage til og med i dag, mod planens dagsmål (samme dagsvurdering
// som kostlinjen og ugerapporten: kcal inden for 10 %, protein mindst 90 %). planDates er dagene med godkendt plan
// og mål over 0 (nævneren); kcal og protein har kun svar for dage med log. Uden planDates tælles intet mod planen.
export function ugeDageModPlan({ planDays, meals, through } = {}) {
  const none = { planDates: new Set(), kcal: new Map(), protein: new Map() }
  if (!day(through) || !Array.isArray(planDays) || !Array.isArray(meals)) return none
  const planDates = new Set(planMaal(planDays, addCalendarDays(through, -6), through).keys())
  const result = { planDates, kcal: new Map(), protein: new Map() }
  for (const [date, entry] of dagsSummer({ planDays, meals, today: through, through })) {
    result.kcal.set(date, Math.abs(entry.sum.kcal - entry.goal.kcal) <= entry.goal.kcal * KCAL_TOLERANCE)
    result.protein.set(date, proteinHit(entry))
  }
  return result
}
