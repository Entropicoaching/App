export const DEFAULT_ANALYSE_MISSING_DATA = false
export function analyseMissingDataEnabled(search = globalThis.window?.location?.search ?? globalThis.location?.search ?? '') {
  const values = new URLSearchParams(search).getAll('analyseMissingData')
  return values.length === 1 && values[0] === '1'
}
