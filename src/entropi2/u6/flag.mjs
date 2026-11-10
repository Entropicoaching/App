// U6 (ordre 75): data der beslutter. Ét flag pr. del, samme mønster som U3 og U5:
// en eksplicit værdi vinder, ellers gælder standardværdien. Rollback er den ene linje pr. del.
export const DEFAULT_U6_PLAN_WEIGHT = true
export const DEFAULT_U6_DRAFTS = true
export const DEFAULT_U6_HEAVY_WEEK = true
export const DEFAULT_U6_MEAL_FIRST = true

const defaults = () => ({ planWeight: DEFAULT_U6_PLAN_WEIGHT, drafts: DEFAULT_U6_DRAFTS,
  heavyWeek: DEFAULT_U6_HEAVY_WEEK, mealFirst: DEFAULT_U6_MEAL_FIRST })
export function u6Enabled(part, value) {
  if (value === undefined) return defaults()[part] === true
  return value === true
}
