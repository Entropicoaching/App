// ORDRE 280 · commit 1 — "at logge et sæt skal ikke kræve tastatur". Når et
// sæt åbnes, skal vægt/reps stå udfyldt (sidste gang på samme øvelse, ellers
// planens tal, ellers tomt), og kunne ændres med store plus/minus-tryk i
// stedet for at skulle tastes. Rene funktioner (ingen React/DOM), samme
// mønster som nextSet.js/athleteTrainingInputs.js, så de enhedstestes uden en
// rigtig browser. Bevidst ADSKILT fra athleteTrainingInputs.js's
// mergeAthleteSetInputs/nextAthleteSetInput — de styrer selve input-STATEN
// (hvad der er bekræftet/tastet), her beregnes kun hvad et TOMT felt skal
// VISE, uden at skrive noget til state før atleten rent faktisk ændrer det.

// `current` er det atleten allerede har tastet/ændret (logInputs[key].weight).
// Er det tomt, falder vi tilbage til sidste gang på øvelsen, dernæst planens
// anbefalede/foreslåede vægt, ellers tomt (samme rækkefølge som Dagens pas
// allerede VISTE som hint — nu bliver det selve feltets værdi).
export function defaultSetWeight(current, { lastWeight, recommendedWeight } = {}) {
  if (current) return current
  if (lastWeight != null) return String(lastWeight)
  if (recommendedWeight != null) return String(recommendedWeight)
  return ''
}

// Samme princip for reps — kun relevant når feltet er redigerbart (interval/
// frit, se repsPrescription.js); fast ordination har intet felt at forudfylde.
export function defaultSetReps(current, { lastReps, planReps } = {}) {
  if (current) return current
  if (lastReps != null) return String(lastReps)
  if (planReps != null) return String(planReps)
  return ''
}

// Vægt i spring på 2,5 kg. Regnet i tiendedele (heltal) for at undgå
// float-støj (0.1 + 0.2-problemet) — 2,5 kg bliver 25 "tiendedele".
export function stepWeight(current, deltaKg = 2.5) {
  const n = parseFloat(String(current ?? '').replace(',', '.'))
  const baseTenths = Number.isFinite(n) ? Math.round(n * 10) : 0
  const nextTenths = Math.max(0, baseTenths + Math.round(deltaKg * 10))
  return String(nextTenths / 10)
}

// Gentagelser i spring på 1, aldrig under 0.
export function stepReps(current, delta = 1) {
  const n = parseInt(current, 10)
  const base = Number.isFinite(n) ? n : 0
  return String(Math.max(0, base + delta))
}
