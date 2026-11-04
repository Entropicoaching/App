import { calendarTime } from '../../athlete/kostNumbers.mjs'

const DAY = 86400000
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
const finite = (n, low, high) => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high
const day = value => {
  const result = calendarTime(value)
  if (result === null || value < '1900-01-01' || value > '9999-12-24') throw new TypeError('Gyldig ISO-kalenderdato kræves (1900-01-01 til 9999-12-24)')
  return result
}
const iso = time => new Date(time).toISOString().slice(0, 10)

// Engineering policy v1, for coach review in adults. These are conservative
// product limits, not a claim of clinical safety for every individual.
export const POLICY = Object.freeze({
  version: 'kostplan-v1', minKcal: 1600, minKcalPerKg: 25,
  proteinPerKg: 2, cutProteinPerKg: 2.2, fatPerKg: 0.8,
  maxWeeklyStepKcal: 150, maxWeeklyStepShare: 0.05, trendTolerancePct: 0.1,
})
const GOALS = Object.freeze({
  bulk: { light: [0.05, 0.1], moderate: [0.1, 0.25], aggressive: [0.15, 0.4] },
  maintain: { light: [0, 0], moderate: [0, 0], aggressive: [0, 0] },
  cut: { light: [-0.05, -0.25], moderate: [-0.1, -0.5], aggressive: [-0.15, -0.75] },
})

// Duplicate dates are excluded entirely. Invalid/future/out-of-window entries
// count as rejected; they never become zero, nor extra evidence for a day.
function dailyRows(rows, end, windowDays, valid) {
  if (rows == null) rows = []
  if (!Array.isArray(rows)) throw new TypeError('Historik skal være en liste')
  const groups = new Map()
  let rejected = 0
  for (const row of rows) {
    const time = calendarTime(row?.date)
    if (time === null || row.date < '1900-01-01' || row.date > '9999-12-24'
      || time > end || time < end - (windowDays - 1) * DAY || !valid(row)) {
      rejected++; continue
    }
    const entries = groups.get(row.date) || []
    entries.push(row); groups.set(row.date, entries)
  }
  const result = []
  for (const entries of groups.values()) {
    if (entries.length === 1) result.push(entries[0])
    else rejected += entries.length
  }
  return { rows: result.sort((a, b) => a.date.localeCompare(b.date)), rejected }
}

function weightEvidence(weights, end, windowDays) {
  const { rows, rejected } = dailyRows(weights, end, windowDays, r => finite(r.kg, 25, 350))
  const spanDays = rows.length ? (end - day(rows[0].date)) / DAY + 1 : 0
  const first = rows.filter(r => day(r.date) < day(rows[0].date) + 7 * DAY)
  const last = rows.filter(r => day(r.date) >= end - 6 * DAY)
  const sufficient = spanDays >= 14 && rows.length >= 10 && first.length >= 5 && last.length >= 5
  const distance = sufficient ? (mean(last.map(r => day(r.date))) - mean(first.map(r => day(r.date)))) / DAY : 0
  const weeklyKg = sufficient ? (mean(last.map(r => r.kg)) - mean(first.map(r => r.kg))) * 7 / distance : null
  return { dates: rows.map(r => r.date), count: rows.length, rejected, spanDays,
    firstCount: first.length, lastCount: last.length, sufficient, weeklyKg }
}

function experienceEvidence(history, end, weightKg) {
  if (history == null) history = []
  if (!Array.isArray(history)) throw new TypeError('Tidligere planer skal være en liste')
  const valid = history.filter(r => {
    const start = calendarTime(r?.from), through = calendarTime(r?.through)
    return start !== null && through !== null && through <= end && end - through <= 180 * DAY
      && (through - start) / DAY + 1 >= 14 && (through - start) / DAY + 1 <= 28
      && finite(r.weightKg, weightKg * 0.8, weightKg * 1.2)
      && finite(r.averageKcal, 800, 10000) && finite(r.weeklyChangeKg, -r.weightKg * 0.01, r.weightKg * 0.01)
      && finite(r.adherence, 0.8, 1)
  }).sort((a, b) => b.through.localeCompare(a.through))
  // Ambiguous latest periods do not get arbitrarily selected.
  const latest = valid[0] && valid.filter(r => r.through === valid[0].through).length === 1 ? valid[0] : null
  return latest ? { from: latest.from, through: latest.through, averageKcal: latest.averageKcal,
    weeklyChangeKg: latest.weeklyChangeKg, adherence: latest.adherence,
    estimatedMaintenanceKcal: latest.averageKcal - latest.weeklyChangeKg * 7700 / 7 } : null
}

/**
 * Pure, unwired proposal. Dates and daily complete-log totals must be supplied
 * for ONE athlete by the caller. No implicit clock, I/O, storage or mutations.
 * See README.md for units, evidence thresholds and the coach approval boundary.
 */
export function calculateNutrition(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Beregningsinput kræves')
  const end = day(input.date), weightKg = input.weightKg
  if (!finite(weightKg, 25, 350)) throw new TypeError('Kropsvægt skal være 25–350 kg')
  if (input.adult !== true) throw new TypeError('Modellen er kun til bekræftede voksne')
  const intensity = input.intensity ?? 'moderate'
  const setting = Object.hasOwn(GOALS, input.goal) && Object.hasOwn(GOALS[input.goal], intensity)
    ? GOALS[input.goal][intensity] : null
  if (!setting) throw new TypeError('Ukendt mål eller intensitet')
  const windowDays = input.windowDays ?? 28
  if (!Number.isInteger(windowDays) || windowDays < 14 || windowDays > 28) throw new TypeError('Trendvindue skal være 14–28 dage')
  const reasons = [], warnings = []
  const explain = (code, text) => reasons.push({ code, text })
  const trend = weightEvidence(input.weights, end, windowDays)
  const logs = dailyRows(input.dietDays, end, windowDays,
    r => r.complete === true && finite(r.kcal, 800, 10000))
  const start = trend.count ? day(trend.dates[0]) : end - (windowDays - 1) * DAY
  const matchedLogs = logs.rows.filter(r => day(r.date) >= start)
  const diet = { dates: matchedLogs.map(r => r.date), completeDays: matchedLogs.length,
    rejected: logs.rejected + logs.rows.length - matchedLogs.length,
    meanKcal: matchedLogs.length ? mean(matchedLogs.map(r => r.kcal)) : null }
  const experience = experienceEvidence(input.experiences, end, weightKg)
  // Calibration and weekly decisions require the same observation period and
  // >=70% complete diary coverage; unlogged dates are not zero intake.
  const diarySufficient = diet.completeDays >= Math.ceil(((end - start) / DAY + 1) * 0.7)
  const plausible = kcal => finite(kcal, weightKg * 20, weightKg * 60)
  if (input.maintenanceKcal != null && !plausible(input.maintenanceKcal)) throw new TypeError('Vedligehold skal være 20–60 kcal/kg')
  let maintenanceKcal, maintenanceSource
  const inferred = trend.sufficient && diarySufficient ? diet.meanKcal - trend.weeklyKg * 7700 / 7 : null
  if (plausible(inferred)) {
    maintenanceKcal = inferred; maintenanceSource = 'current-response'
    explain('current-response', 'Vedligehold estimeret fra komplette kostdage og observeret vægtrespons i samme vindue.')
  } else if (experience && plausible(experience.estimatedMaintenanceKcal)) {
    maintenanceKcal = experience.estimatedMaintenanceKcal; maintenanceSource = 'previous-response'
    explain('previous-response', 'Vedligehold estimeret fra den seneste entydige tidligere plan med mindst 80 % efterlevelse.')
  } else if (input.maintenanceKcal != null) {
    maintenanceKcal = input.maintenanceKcal; maintenanceSource = 'coach-estimate'
    explain('coach-estimate', 'Coachens vedligeholdsestimat bruges; utilstrækkeligt grundlag for aktuel kalibrering.')
  } else {
    maintenanceKcal = weightKg * 30; maintenanceSource = 'weight-estimate'
    warnings.push('Foreløbigt vægtbaseret estimat. Coach skal vurdere energibehov og individuelle grænser.')
    explain('weight-estimate', '30 kcal/kg som synligt foreløbigt startestimat; manglende historik opfindes ikke.')
  }
  const training = input.training ?? { volume: 'rest', intensity: 'light' }
  const volumes = { rest: 0, light: 100, moderate: 200, high: 300 }
  const intensities = { light: 0, moderate: 50, high: 100 }
  if (!training || !Object.hasOwn(volumes, training.volume) || !Object.hasOwn(intensities, training.intensity)
    || (training.volume === 'rest' && training.intensity !== 'light')) throw new TypeError('Ugyldig træningsbelastning')
  const trainingKcal = volumes[training.volume] + intensities[training.intensity]
  const readiness = input.readiness
  if (readiness != null && (!finite(readiness.energy, 1, 5) || !finite(readiness.hunger, 1, 5))) throw new TypeError('Dagsform kræver energi og sult på skala 1–5')
  const recovery = readiness != null && (readiness.energy <= 2 || readiness.hunger >= 4)
  let [energyShare, targetWeeklyPct] = setting
  if (recovery && energyShare < 0) {
    energyShare = 0
    explain('recovery', 'Lav energi eller høj sult: dagens underskud fjernes, og ugentlig reduktion afventer coach.')
  }
  let competition = null
  if (input.competition != null) {
    const event = day(input.competition.date), weightClassKg = input.competition.weightClassKg
    if (!finite(weightClassKg, 25, 350)) throw new TypeError('Ugyldig vægtklasse')
    const daysUntil = (event - end) / DAY
    const requiredWeeklyPct = daysUntil > 0 ? (weightClassKg - weightKg) / weightKg * 100 * 7 / daysUntil : null
    competition = { date: input.competition.date, weightClassKg, daysUntil, requiredWeeklyPct,
      requiresCoachReview: daysUntil >= 0 && (daysUntil <= 14 || requiredWeeklyPct < -0.75 || (weightKg > weightClassKg && input.goal !== 'cut')) }
    if (daysUntil < 0) warnings.push('Stævnedato er passeret og bruges ikke til justering.')
    else if (competition.requiresCoachReview) warnings.push('Stævnevægt kræver coachvurdering. Ingen automatisk indhentning eller væskemanipulation.')
    explain('competition', 'Vægtklasse og tid til stævne vurderes; en deadline øger aldrig underskuddet.')
  }
  const extraFloor = input.minKcal ?? POLICY.minKcal
  if (!finite(extraFloor, POLICY.minKcal, 20000)) throw new TypeError('Coachens energigulv må kun hæve standardgrænsen')
  const protein = Math.ceil(weightKg * (input.goal === 'cut' ? POLICY.cutProteinPerKg : POLICY.proteinPerKg) * 10) / 10
  const carbFloor = weightKg * (training.volume === 'high' || training.intensity === 'high' ? 4 : training.volume === 'rest' ? 2 : 3)
  const fatFloor = Math.ceil(weightKg * POLICY.fatPerKg * 10) / 10
  const baseMinKcal = Math.ceil(Math.max(extraFloor, weightKg * POLICY.minKcalPerKg,
    protein * 4 + fatFloor * 9 + weightKg * 2 * 4))
  // Training is added after protecting the basis. A raised individual floor
  // must not swallow today's training increment or erase carbohydrate cycling.
  const minKcal = Math.ceil(Math.max(baseMinKcal + trainingKcal, protein * 4 + fatFloor * 9 + carbFloor * 4))
  const rawKcal = maintenanceKcal * (1 + energyShare) + trainingKcal
  const kcal = Math.ceil(Math.max(rawKcal, minKcal))
  const fat = Math.max(fatFloor, Math.min(kcal * 0.25 / 9, (kcal - protein * 4 - carbFloor * 4) / 9))
  const carb = (kcal - protein * 4 - fat * 9) / 4
  explain('goal', `${input.goal}/${intensity}: ${energyShare * 100} % energi; ønsket vægtændring ${targetWeeklyPct} %/uge.`)
  explain('training', `Dagens volumen/intensitet: ${training.volume}/${training.intensity}; ${trainingKcal} kcal ekstra, kulhydratgulv ${carbFloor} g.`)
  explain('floors', `Energigulv ${minKcal} kcal, protein ${protein} g og fedtgulv ${fatFloor} g. Gulve går forud for målet.`)
  if (rawKcal < minKcal) warnings.push('Ønsket energimål er hævet til gulvet; ønsket vægtændring kan ikke loves.')
  const targets = { kcal, protein, carb, fat }
  const weekly = weeklyRule(input.currentPlan, { end, date: input.date, weightKg, trend, diarySufficient,
    diet, targetWeeklyPct, minKcal: baseMinKcal, recovery, competition })
  return { policyVersion: POLICY.version, date: input.date, targets, maintenanceKcal, maintenanceSource,
    targetWeeklyPct, energyShare, limits: { minKcal, baseMinKcal, fatFloor, carbFloor, proteinPerKg: protein / weightKg },
    evidence: { from: iso(start), through: input.date, windowDays, trend, diet, experience,
      readiness: readiness ? { energy: readiness.energy, hunger: readiness.hunger } : null,
      training: { volume: training.volume, intensity: training.intensity }, competition },
    reasons, warnings, weekly }
}

function weeklyRule(current, context) {
  const { end, date, weightKg, trend, diarySufficient, diet, targetWeeklyPct, minKcal, recovery, competition } = context
  const evidence = { through: date, weightDates: [...trend.dates], completeDietDates: [...diet.dates],
    observedWeeklyPct: trend.weeklyKg === null ? null : trend.weeklyKg / weightKg * 100, targetWeeklyPct }
  const hold = (reason, kcal = current?.kcal ?? null) => ({ action: 'hold', deltaKcal: 0, proposedKcal: kcal, reason, evidence,
    evaluatedOn: date, nextEligibleOn: null, requiresCoachActivation: true })
  if (current == null) return hold('Ingen aktuel plan; generér en kladde til coachvurdering.')
  if (!finite(current.kcal, 1, 100000)) throw new TypeError('Aktuel plans energi er ugyldig')
  // An unknown or contradictory clock cannot allow a change.
  const created = day(current.createdOn)
  const anchor = current.lastAdjustedOn == null ? created : day(current.lastAdjustedOn)
  if (anchor < created) throw new TypeError('Justering ligger før planens oprettelse')
  if (anchor > end) throw new TypeError('Planens justeringsdato ligger i fremtiden')
  if (current.evaluatedThrough != null && day(current.evaluatedThrough) > end) throw new TypeError('Planens datagrundlag ligger i fremtiden')
  if (current.kcal < minKcal) return { ...hold('Aktuel plan er under basisgulvet; coach skal rette den før brug.', null), action: 'review' }
  if (end - anchor < 7 * DAY) return { ...hold('Der skal gå mindst syv hele dage mellem energiændringer.'), nextEligibleOn: iso(anchor + 7 * DAY) }
  if (current.evaluatedThrough != null && day(current.evaluatedThrough) >= end) return hold('Dette datagrundlag er allerede vurderet.')
  if (!trend.sufficient || !diarySufficient) return hold('Utilstrækkelig 14–28 dages vægttrend eller under 70 % komplette kostdage.')
  if (recovery) return hold('Dagsform kræver coachvurdering før justering.')
  if (competition?.requiresCoachReview) return hold('Stævnevægt kræver coachvurdering før justering.')
  const error = targetWeeklyPct - evidence.observedWeeklyPct
  if (Math.abs(error) <= POLICY.trendTolerancePct + 1e-9) return hold('Vægttrend er inden for tolerancen på 0,1 procentpoint/uge.')
  const step = Math.floor(Math.min(POLICY.maxWeeklyStepKcal, current.kcal * POLICY.maxWeeklyStepShare))
  const proposedKcal = Math.min(100000, Math.max(minKcal, current.kcal + Math.sign(error) * step))
  const deltaKcal = proposedKcal - current.kcal
  if (deltaKcal === 0) return hold(error < 0 ? 'Energigulvet forhindrer yderligere reduktion.' : 'Kontraktens øvre energigrænse forhindrer yderligere forøgelse.')
  return { action: 'adjust', deltaKcal, proposedKcal,
    reason: `Vægttrend ${evidence.observedWeeklyPct.toFixed(2)} %/uge mod mål ${targetWeeklyPct} %/uge. Trin højst 150 kcal og 5 %; energigulv respekteres.`,
    evidence, evaluatedOn: date, nextEligibleOn: iso(end + 7 * DAY), requiresCoachActivation: true }
}
