// Existing athletes fields only. Never fall back to a goal or an undated weight.
export function planKg(value) {
  const raw = typeof value === 'string' ? value.trim() : value
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(raw))) return null
  const number = typeof raw === 'number' ? raw : Number(raw.replace(',', '.'))
  return Number.isFinite(number) && number >= 25 && number <= 350 ? number : null
}

export function competitionBasis(props = {}) {
  if (props.enabled !== true) return null
  const date = props.athlete?.competition_date
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || date < '1900-01-01' || date > '9999-12-30') return null
  const time = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null
  const weightClassKg = planKg(props.athlete?.weight_class)
  return weightClassKg === null ? null : { competitionDate: date, weightClassKg }
}

// The model receives an explicit local calendar day; it has no implicit clock.
export function localPlanDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const emptyPlanDraft = () => ({ weightKg: '', weighInHours: '', adult: false, healthReviewed: false })

export function competitionInput(basis, draft, asOf) {
  return { ...basis, asOf, weightKg: planKg(draft.weightKg),
    weighInHours: draft.weighInHours === '2' ? 2 : draft.weighInHours === '24' ? 24 : null,
    adult: draft.adult === true, healthReviewed: draft.healthReviewed === true }
}
