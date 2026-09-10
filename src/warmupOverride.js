// ORDRE 105 (commit 2) — atleten retter et opvarmningssæts vægt (eller
// springer det over), uden at det tæller som arbejdssæt. Appen husker
// rettelsen, og foreslår den igen næste gang samme øvelse+arbejdsvægt
// (inden for 5 %) dukker op.
//
// Rettelsen går IKKE i `exercise_logs`: den tabel har, så vidt det kan
// bekræftes fra denne kodebase, ingen "extra"/JSON-kolonne til den slags —
// et grep over hele repoet finder kun ét `extra`-felt, og det sidder på
// video-analysetabellen (se AthleteView.jsx/Dashboard.jsx), en helt anden
// tabel. Et forsøg på at bekræfte skemaet direkte (både via Supabase-MCP'et
// og en skrivefri anon-key-probe) blev blokeret af miljøets egen
// auto-mode-klassifikator, før det nåede produktion — så det kunne ikke
// verificeres. At sende et gættet kolonnenavn med i EN HVER sæt-log-skrivning
// ville, hvis gættet er forkert, ødelægge alle atleters sæt-logning i
// produktion (appen deployer direkte fra main, ingen staging) — en risiko
// der ikke står mål med denne ordres størrelse.
//
// I stedet: samme mønster som readinessDraft.js (og — svagere, kun i
// React-state, slet ikke persisteret — meetWarmupOverrides for stævnedag
// længere nede i AthleteView.jsx). Storage sendes eksplicit (default
// globalThis.localStorage) så det kan enhedstestes uden en rigtig browser,
// og enhver fejl (privat vindue, fuld storage) sluger sig selv.
const WARMUP_OVERRIDE_PREFIX = 'entropi_warmup_override'
const TOLERANCE = 0.05

function foldKey(name) {
  return String(name ?? '').trim().toLowerCase()
}

function warmupOverrideKey(athleteId, exerciseName) {
  return `${WARMUP_OVERRIDE_PREFIX}:${athleteId}:${foldKey(exerciseName)}`
}

/**
 * Anvend atletens rettelse (ny vægt og/eller spring-over) på opvarmningssæt
 * `index` i den viste ramp `sets` (modellens eller en tidligere gemt egen
 * ramp). Returnerer den fulde, effektive ramp: det sprungne-over sæt fjernes,
 * resten står uændret omkring det. Det rettede sæt får
 * `warmupOverride: { anbefalet, faktisk }` (faktisk: null ved spring-over) —
 * ordrens felt, ordret.
 */
export function applyWarmupCorrection(sets, index, { weight, skipped } = {}) {
  return sets
    .map((s, i) => {
      if (i !== index) return s
      const anbefalet = s.warmupOverride?.anbefalet ?? s.weight
      if (skipped) return { ...s, skipped: true, warmupOverride: { anbefalet, faktisk: null } }
      const faktisk = Number(weight)
      if (!Number.isFinite(faktisk) || faktisk <= 0) return s
      return { ...s, weight: faktisk, warmupOverride: { anbefalet, faktisk } }
    })
    .filter((s) => !s.skipped)
}

/** Gem dagens effektive ramp for en øvelse+arbejdsvægt, pr. atlet. */
export function saveWarmupOverride(athleteId, exerciseName, workingWeight, sets, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !exerciseName || !(workingWeight > 0)) return false
    storage.setItem(
      warmupOverrideKey(athleteId, exerciseName),
      JSON.stringify({ workingWeight, sets, savedAt: Date.now() }),
    )
    return true
  } catch {
    return false
  }
}

export function loadWarmupOverride(athleteId, exerciseName, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !exerciseName) return null
    const raw = storage.getItem(warmupOverrideKey(athleteId, exerciseName))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !(parsed.workingWeight > 0) || !Array.isArray(parsed.sets)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Atletens egne sidste opvarmningsvægte for øvelsen, hvis dagens arbejdsvægt
 * ligger inden for 5 % af sidste gang. Ellers null — modellen
 * (calcWarmupSets) gælder som normalt.
 */
export function suggestWarmupOverride(athleteId, exerciseName, workingWeight, storage = globalThis.localStorage) {
  const entry = loadWarmupOverride(athleteId, exerciseName, storage)
  if (!entry || !(workingWeight > 0)) return null
  const diff = Math.abs(entry.workingWeight - workingWeight) / entry.workingWeight
  if (diff > TOLERANCE) return null
  return entry.sets
}
