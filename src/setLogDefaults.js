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

// ORDRE 293 · blok 1 (F1) — selve trinnet på kaldstedet i Dagens pas. Næste
// sæts reps står som '' i input-state (nextAthleteSetInput nulstiller dem
// bevidst), mens feltet VISER ordinationens nederste tal. `??` fangede kun
// null/undefined, så et tomt felt startede trinnet fra 0 ("1 rep mere" gav 1,
// ikke 5). Tomt falder derfor tilbage på det TALLET FELTET VISER (`shownReps`).
export function stepRepsInInputs(inputs, key, shownInput, shownReps, delta = 1) {
  const current = inputs[key] || shownInput
  return { ...inputs, [key]: { ...current, reps: stepReps(current.reps || shownReps, delta) } }
}

// ORDRE 293 · blok 2 (F3) — forudfyldningen af et sæt, som ren beslutning.
// Effekten i Dagens pas kører nu igen når historikken (exerciseHistory) er
// hentet, for første øvelse åbnes FØR historikken ankommer og fik derfor
// planens tal, som aldrig blev byttet ud med "sidste gang". Returnerer den nye
// input-post, eller null = rør ikke noget. Regler:
//  - `touched` (atleten har trykket plus/minus eller tastet i feltet): rør
//    aldrig, heller ikke hvis atleten har tømt feltet igen.
//  - tomt felt: udfyld (som før).
//  - felt der stadig står præcis som VORES egen tidligere forudfyldning
//    (`lastAuto`): byt ud med de nye standardværdier (planens tal → sidste gang).
//  - alt andet (fx tastet i Program-fanen): rør ikke.
export function autoFillSetInput({ current, lastAuto, touched, weightDefault, repsDefault }) {
  if (touched) return null
  if (!weightDefault && !repsDefault) return null
  const weight = current?.weight || ''
  const reps = current?.reps || ''
  const empty = !weight && !reps
  const stillOurs = !!lastAuto && weight === lastAuto.weight && reps === lastAuto.reps
  if (!empty && !stillOurs) return null
  if (stillOurs && lastAuto.weight === weightDefault && lastAuto.reps === repsDefault) return null
  return { ...current, weight: weightDefault, note: current?.note || '', rpe: current?.rpe || '', reps: repsDefault }
}
