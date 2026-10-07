// Ordre 1526 (Marcs V-RPE): hvad gemmes som rpe_actual, naar atleten ikke har valgt en RPE?
// Flaget er FRA = som foer (B): den planlagte RPE gemmes, som om atleten havde valgt den.
// Til = A: ingen RPE gemmes (null), saa et gaettet tal ikke ligner et rigtigt.
// Et ja til A er kun den ene linje herunder (false -> true).
export const RPE_TOM_UDEN_VALG = false

/** valgt: atletens egen RPE (streng/tal eller tom). planlagt: parsePlannedRpe-vaerdi. */
export const rpeActualUdenValg = (valgt, planlagt, tom = RPE_TOM_UDEN_VALG) => {
  if (valgt) return parseFloat(valgt)
  return tom ? null : (planlagt ?? null)
}
