// U5 (ordre 73): "I dag"-kortet med let logning. Ét flag for alt nyt i U5.
// Samme mønster som U3: en eksplicit værdi vinder, ellers gælder standardværdien.
// Rollback er denne ene linje.
export const DEFAULT_U5_TODAY = true
export function u5TodayEnabled(value) {
  if (value === undefined) return DEFAULT_U5_TODAY === true
  return value === true
}
