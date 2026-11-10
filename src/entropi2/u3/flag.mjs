// U3 (ordre 64): data i fire perspektiver. Ét flag for alt nyt i U3.
// Samme mønster som entropi2Enabled: en eksplicit værdi vinder, ellers gælder
// standardværdien. Rollback er denne ene linje.
export const DEFAULT_U3_DATA = true
export function u3DataEnabled(value) {
  if (value === undefined) return DEFAULT_U3_DATA === true
  return value === true
}
