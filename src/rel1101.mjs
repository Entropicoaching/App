export const DEFAULT_REL1101 = false
// Strict local opt-in. Never turns on a different release or feature.
export function rel1101Enabled(value = DEFAULT_REL1101, search = '') {
  const values = new URLSearchParams(search).getAll('rel1101')
  return value === true || (values.length === 1 && values[0] === '1')
}
