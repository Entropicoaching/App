import { profileModel } from './profileModel.mjs'

export const goalFields = Object.freeze(['goal', 'weight_class', 'competition_date', 'target_weight'])
export const goalLabels = Object.freeze({ goal: 'Mit mål', weight_class: 'Vægtklasse',
  competition_date: 'Næste stævne', target_weight: 'Kropsvægtmål' })
export const goalChoices = Object.freeze([['bulk', 'Bulk · opbygning'], ['maintain', 'Vedligehold'], ['cut', 'Cut · vægttab']])
const blank = value => value == null || typeof value === 'string' && !value.trim()

export function goalWeight(value) {
  if (blank(value)) return null
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const text = String(value).trim()
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return undefined
  const number = Number(text.replace(',', '.'))
  return Number.isFinite(number) && number > 0 && number <= 1000 ? number : undefined
}

export function goalDate(value) {
  if (blank(value)) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return undefined
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : undefined
}

// No defaults, inferred weights or new nutrition calculations. Preserve legacy
// free-text goals until the athlete explicitly chooses a nutrition direction.
export function athleteGoals(athlete = {}) {
  return {
    goal: typeof athlete?.goal === 'string' && athlete.goal.trim() ? athlete.goal.trim() : null,
    weight_class: goalWeight(athlete?.weight_class) ?? null,
    competition_date: goalDate(athlete?.competition_date) ?? null,
    target_weight: null, // No documented database column in the pinned source.
  }
}

export const goalDraft = values => Object.fromEntries(goalFields.map(key => [key, values[key] == null ? '' : String(values[key])]))

export function validateGoalDraft(draft, saved) {
  const errors = {}, values = {}
  const goal = typeof draft?.goal === 'string' ? draft.goal.trim() : undefined
  if (goal === undefined || goal && !goalChoices.some(([code]) => code === goal) && goal !== saved.goal) {
    errors.goal = 'Vælg bulk, vedligehold eller cut, eller behold dit nuværende mål.'
  } else values.goal = goal || null
  for (const key of ['weight_class', 'target_weight']) {
    values[key] = goalWeight(draft?.[key])
    if (values[key] === undefined) errors[key] = 'Brug en vægt over 0 og højst 1000 kg, eller lad feltet stå tomt.'
  }
  values.competition_date = goalDate(draft?.competition_date)
  if (values.competition_date === undefined) errors.competition_date = 'Vælg en gyldig stævnedato, eller lad feltet stå tomt.'
  return { values, errors }
}

export function goalDisplay(values) {
  const kg = value => value == null ? 'Ikke angivet endnu' : `${value.toLocaleString('da-DK', { maximumFractionDigits: 3 })} kg`
  const date = values.competition_date
  return { goal: profileModel({ goal: values.goal }).goal, weight_class: kg(values.weight_class),
    competition_date: date ? `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}` : 'Intet stævne angivet endnu',
    target_weight: kg(values.target_weight) }
}
