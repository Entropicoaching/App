export let effects = []
export function useEffect(callback) { effects.push(callback) }
export function resetEffects() { effects = [] }
export const supabase = { from: (...args) => globalThis.syntheticFrom(...args) }
