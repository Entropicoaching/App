const text = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback
const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })

// Match the existing athlete fields; do not infer goals or calculate new targets.
function target(value, unit) {
  if (typeof value !== 'number' && typeof value !== 'string') return 'Ikke angivet endnu'
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return 'Ikke angivet endnu'
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? `${number.format(parsed)} ${unit}` : 'Ikke angivet endnu'
}

// The existing field stores either free text or a nutrition setup code.
function goalLabel(value) {
  const goal = text(value, 'Intet mål angivet endnu')
  switch (goal) {
    case 'cut': return 'Vægttab'
    case 'maintain': return 'Vedligehold'
    case 'bulk': return 'Opbygning'
    default: return goal
  }
}

export function profileModel(athlete) {
  return {
    name: text(athlete?.name, 'Navn ikke angivet'),
    goal: goalLabel(athlete?.goal),
    kcal: target(athlete?.kcal_target, 'kcal'),
    protein: target(athlete?.protein_target, 'g'),
  }
}
