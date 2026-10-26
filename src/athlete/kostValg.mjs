// Local fallback for APP-KOST2. No storage, URL, environment or backend activation.
// Coach-approved choices are keyed by athlete ID. Missing choice hides Kost only
// when KOST_PER_ATLET is explicitly true. No real athlete IDs belong in tests.
export const KOST_PER_ATLET = false
export const KOST_VALG = Object.freeze({})

export function kostSynlig(athlete, enabled = KOST_PER_ATLET, choices = KOST_VALG) {
  if (enabled !== true) return true
  const id = athlete?.id
  return typeof id === 'string' && id.length > 0 && choices != null &&
    Object.hasOwn(choices, id) && choices[id] === true
}

export function kostDestination(destination, visible) {
  return destination === 'kost' && visible === false ? 'hjem' : destination
}
