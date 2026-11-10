// U7 (ordre 76): kost som data. Ét flag pr. del, samme mønster som U3, U5 og U6:
// en eksplicit værdi vinder, ellers gælder standardværdien. Rollback er den ene linje pr. del.
// Uden tabellerne fra migrationspakken viser alle tre dele det samme som U6.
export const DEFAULT_U7_TOP_SET = true
export const DEFAULT_U7_DAY_DATA = true
export const DEFAULT_U7_COACH_DATA = true

const defaults = () => ({ topSet: DEFAULT_U7_TOP_SET, dayData: DEFAULT_U7_DAY_DATA, coachData: DEFAULT_U7_COACH_DATA })
export function u7Enabled(part, value) {
  if (value === undefined) return defaults()[part] === true
  return value === true
}
