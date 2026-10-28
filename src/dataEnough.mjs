import { trin1AppData2 } from './udgivelseTrin.mjs'
import { calendarDay } from './calendarDate.js'
import { rpeOrigin } from './rpeEvidence.mjs'
// APP-DATA2. Release profile or explicit URL opt-in. No storage or network access.
export function dataEnoughEnabled() {
  return trin1AppData2(globalThis.location?.search || '')
}
export function withDataEnoughFlag(url) {
  return dataEnoughEnabled() ? url + (url.includes('?') ? '&' : '?') + 'appData2=1' : url
}

const DAY = 86400000
const groupBy = (rows, key) => {
  const groups = new Map()
  for (const row of rows) { const k = key(row); groups.set(k, [...(groups.get(k) || []), row]) }
  return groups
}
export function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null
  const day = /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? calendarDay(value) : value.slice(0, 10)
  if (!day) return null
  const n = Date.parse(day + 'T00:00:00Z')
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === day ? n / DAY : null
}
const uniqueDays = rows => [...new Set(rows.map(r => dayNumber(r.date ?? r.logged_date ?? r.logged_at ?? r.dag)).filter(n => n !== null))].sort((a, b) => a - b)
const span = rows => { const ds = uniqueDays(rows); return ds.length ? ds.at(-1) - ds[0] : 0 }
const finite = v => typeof v === 'number' && Number.isFinite(v)
export const DATA_MESSAGES = Object.freeze({
  D02: 'Sammenligning kræver fem sammenlignelige check-ins på forskellige dage i de foregående 14 dage.',
  D04: 'Forskel kræver to daterede check-ins med højst syv dage imellem.',
  D06: 'Der er endnu ikke tre lave selvrapporter på sammenhængende dage.',
  D07: 'Datoerne viser rækkefølge. En virkning er ikke dokumenteret.',
  D08: 'Sammenligning kræver 12 matchede dage over 28 dage og seks i hvert bånd med kendt RPE-oprindelse.',
  D09: 'Søvnsammenligning kræver 12 parrede dage over 28 dage og seks i hver af to grupper.',
  D10: 'RPE uden dokumenteret eget valg indgår ikke som selvrapport.',
  D11: 'Vægtforslag kræver tre sammenlignelige tidligere pas med to egne RPE-svar i hvert pas inden for 28 dage.',
  D12: 'RPE-vurdering kræver 12 egne svar på tre pas inden for 14 dage og mindst 80 procent dækning.',
  D13: 'RPE-stigning kræver fire sammenlignelige pas over 14 dage med tre egne svar i hvert pas.',
  D14: 'Gennemgang kræver tre sammenhængende check-in-dage og 12 egne RPE-svar på tre pas i samme 14 dage.',
  D15: 'Ugens RPE beskrives først ved 12 egne svar på tre pas og mindst 80 procent dækning.',
  D16: 'RPE-signalet afventer dokumenteret oprindelse og 20 parrede sæt på tre pas inden for 21 dage.',
  D18: 'Styrketendens kræver fire sammenlignelige tunge dage over mindst 21 dage.',
  D19: 'Styrketendens kræver data fra fire forskellige afsluttede kalenderuger.',
  D21: 'Trend kræver fire sammenlignelige tunge dage over mindst 21 dage.',
  D22: 'Fremgangspil kræver fire sammenlignelige tunge dage over mindst 21 dage.',
  D25: 'Retning kræver tre kvalificerede dage både i de seneste 28 dage og i perioden 28 til 84 dage før.',
  D26: 'Plateau kræver fire trænede uger, tre uger efter toppen og nyere data.',
  D27: 'Stagnation eller fald afventer dokumenteret træning i de relevante uger.',
  D33: 'Tonnageudvikling kræver fire afsluttede daterede uger med fuld læsedækning og træning i hver.',
  D35: 'Gab afventer afsluttede uger med kendt plan, logdækning og kortlægning.',
  D37: 'Logaktivitet. Compliance kræver en afsluttet dateret planuge og komplet læsning.',
  D38: 'Registreret aktivitet. Et fuldt pas kræver alle planpositioner og komplet læsning.',
  D39: 'Plan eller foreløbige registreringer. Ugen er ikke bekræftet afsluttet og fuldt indlæst.',
  D40: 'Ikke registreret er ikke dokumenteret fravær. Læsedækning og plankontekst mangler.',
  D41: 'Grundlaget for en samlet status er endnu ikke bekræftet.',
  D46: 'Vægttrend kræver tre vejninger på forskellige dage i hver af to afsluttede syvdagesperioder.',
  D47: 'Vægttrend kræver tre vejninger på forskellige dage i hver af to afsluttede syvdagesperioder.',
  D48: 'TDEE afventer 21 bekræftet komplette kostdage og tre vejninger i hver ende over mindst 21 dage.',
  D56: 'Observationsudkast afventer kvalitetskontrol, tre gyldige reps og dokumenteret målegrundlag. Marc vurderer fortolkningen.',
  D59: 'Personlig sammenligning afventer fem godkendte referenceanalyser på tre dage med samme metode og version.',
  D69: 'Grundlag ikke dokumenteret. Forecast afventer dateret planreference og beregningsmotorens minimum.',
  D76: 'Status afventer en fuld, fejlfri opdatering af alle relevante kilder.',
})
export const dataMessage = id => DATA_MESSAGES[id] || 'Endnu ikke nok sammenligneligt grundlag.'

// No unknown provenance is inferred from actual != planned or a row count.
export function explicitRpe(row) {
  return rpeOrigin(row) === 'athlete' && finite(row.rpe_actual ?? row.rpe) && (row.rpe_actual ?? row.rpe) >= 0 && (row.rpe_actual ?? row.rpe) <= 10
}
const dated = rows => rows.filter(r => dayNumber(r.date ?? r.logged_at ?? r.logged_date ?? r.dag) !== null)
const sessions = rows => new Set(rows.map(r => r.session_id ?? r.exercises?.session_id).filter(Boolean)).size
function recent(rows, today, days, includeToday = true) {
  const t = dayNumber(today)
  return t === null ? [] : dated(rows).filter(r => {
    const age = t - dayNumber(r.date ?? r.logged_at ?? r.logged_date ?? r.dag)
    return age >= (includeToday ? 0 : 1) && age <= days
  })
}
function ratedBasis(e, days, n, pas, coverage = 0) {
  const all = recent(e.rows || [], e.today, days).filter(r => !r.skipped).map(r => ({ ...r, session_id: r.session_id ?? r.exercises?.session_id }))
  const key = r => r.id || (r.session_id && r.exercise_id && r.set_number ? `${r.session_id}|${r.exercise_id}|${r.set_number}` : null)
  const grouped = groupBy(all, key)
  const own = all.filter(r => explicitRpe(r) && key(r) && grouped.get(key(r)).length === 1)
  return own.length >= n && sessions(own) >= pas && all.length > 0 && own.length / all.length >= coverage
}
function heavyBasis(rows, n = 4, days = 21) {
  const good = rows.filter(r => r.qualified === true && finite(r.e1rm) && r.e1rm > 0 && r.repZone != null && r.lift)
  if (!good.length) return false
  const groups = groupBy(good, r => r.lift + '|' + r.repZone)
  return groups.size === 1 && good.length === rows.length && uniqueDays(good).length >= n && span(good) >= days
}
function weeksBasis(e, count, mapping = false) {
  const t = dayNumber(e.today)
  if (t === null) return false
  const rows = (e.weeks || []).filter(w => {
    const d = dayNumber(w.start_date)
    return d !== null && d + 7 <= t && w.complete === true && (mapping ? w.performedSessions >= 0 : w.performedSessions >= 1) && (!mapping || w.mappingKnown === true)
  })
  return new Set(rows.map(w => w.start_date)).size >= count
}
export function lowStreak(entries, threshold = 50) {
  const byDay = groupBy(dated(entries || []), r => r.logged_date)
  const days = [...byDay.keys()].sort().reverse()
  let n = 0, previous = null
  for (const date of days) {
    const d = dayNumber(date), rs = byDay.get(date)
    // Conflicting duplicate dates cannot establish a streak.
    if (rs.length !== 1 || !finite(rs[0].readiness_score) || rs[0].readiness_score < 0 || rs[0].readiness_score >= threshold || (previous !== null && previous - d !== 1)) break
    n++; previous = d
  }
  return n
}
export function readinessBasis(todayRow, history) {
  const fields = ['energy', 'motivation', 'stress', 'soreness_level']
  const complete = r => fields.every(k => Number.isInteger(r?.[k]) && r[k] >= 1 && r[k] <= 5) && finite(r?.readiness_score)
  if (!complete(todayRow)) return []
  const hasSleep = finite(todayRow.sleep_hours) && todayRow.sleep_hours > 0
  const rows = recent(history || [], todayRow.logged_date, 14, false).filter(r => complete(r) && (finite(r.sleep_hours) && r.sleep_hours > 0) === hasSleep)
  const byDay = groupBy(rows, r => r.logged_date)
  return [...byDay.values()].filter(rs => rs.length === 1).map(rs => rs[0])
}
export function weightWindows(rows, today) {
  const t = dayNumber(today)
  const clean = (rows || []).filter(r => finite(r.weight) && r.weight > 0 && dayNumber(r.logged_at) !== null)
  const window = (lo, hi) => clean.filter(r => { const age = t - dayNumber(r.logged_at); return age >= lo && age <= hi })
  // Today is unfinished. Yesterday ends the most recent complete seven days.
  const recentRows = t === null ? [] : window(1, 7)
  const priorRows = t === null ? [] : window(8, 14)
  const ready = uniqueDays(recentRows).length >= 3 && uniqueDays(priorRows).length >= 3
  const mean = rs => rs.reduce((sum, r) => sum + r.weight / rs.length, 0)
  return { ready, recent: recentRows, prior: priorRows, diff: ready ? mean(recentRows) - mean(priorRows) : null }
}
export function hasEnoughData(id, e = {}) {
  e = e && typeof e === 'object' ? e : {}
  const objects = value => Array.isArray(value) ? value.filter(r => r && typeof r === 'object') : []
  e = { ...e, rows: objects(e.rows), weeks: objects(e.weeks), weights: objects(e.weights), checkins: objects(e.checkins) }
  const rows = e.rows
  switch (id) {
    case 'D02': return readinessBasis(e.current, rows).length >= 5
    case 'D04': { const ds = uniqueDays(rows.filter(r => finite(r.readiness_score))); return ds.some((d, i) => i > 0 && d - ds[i - 1] <= 7) }
    case 'D06': return lowStreak(rows) >= 3
    case 'D07': return e.explicitDecisionLink === true && !!e.checkinId && !!e.decisionId
    case 'D08':
    case 'D09': {
      const matched = dated(rows).filter(r => r.matched === true && finite(r.value) && r.band != null && (id === 'D09' || (r.comparable === true && r.independentRpe === true)))
      const groups = groupBy(matched, r => r.band)
      return uniqueDays(matched).length >= 12 && span(matched) >= 28 && [...groups.values()].filter(g => uniqueDays(g).length >= 6).length >= 2
    }
    case 'D10': return rows.some(explicitRpe)
    case 'D11': {
      const good = recent(rows, e.today, 28, false).filter(r => explicitRpe(r) && r.comparable === true && r.targetRpe === e.targetRpe && r.lift === e.lift && r.repZone === e.repZone)
      return [...groupBy(good, r => r.session_id).values()].filter(g => g[0].session_id && new Set(g.map(r => r.id || (r.exercise_id && (r.set_number || r.set) ? `${r.exercise_id}|${r.set_number || r.set}` : null)).filter(Boolean)).size >= 2).length >= 3 && !e.pain
    }
    case 'D12': return ratedBasis(e, 14, 12, 3, 0.8)
    case 'D13': {
      const identity = r => r.id || (r.session_id && r.exercise_id && r.set_number ? `${r.session_id}|${r.exercise_id}|${r.set_number}` : null)
      const counts = groupBy(rows, identity)
      const good = rows.filter(r => identity(r) && counts.get(identity(r)).length === 1 && explicitRpe(r) && r.comparable === true && r.planKey && r.planKey === e.planKey)
      const gs = [...groupBy(good, r => r.session_id).values()].filter(g => g[0].session_id && g.length >= 3)
      return gs.length >= 4 && span(gs.flat()) >= 14
    }
    case 'D14': return lowStreak(recent(e.checkins || [], e.today, 14), 60) >= 3 && ratedBasis(e, 14, 12, 3)
    case 'D15': return e.closed === true && ratedBasis(e, 7, 12, 3, 0.8)
    case 'D16': {
      const paired = rows.filter(r => finite(r.rpe_planned))
      return ratedBasis({ ...e, rows: paired }, 21, 20, 3) && ratedBasis({ ...e, rows: paired.filter(r => r.lift === e.lift) }, 21, 6, 2) && (!e.conflict || uniqueDays(recent(e.checkins || [], e.today, 21)).length >= 3)
    }
    case 'D18': case 'D21': case 'D22': return heavyBasis(rows)
    case 'D19': return weeksBasis(e, 4) && e.qualified === true
    case 'D25': {
      const now = dayNumber(e.today)
      const inWindow = (lo, hi) => rows.filter(r => { const d = dayNumber(r.dag); return d !== null && now !== null && now - d >= lo && now - d < hi })
      return new Set(rows.map(r => r.lift + '|' + r.repZone)).size === 1 && heavyBasis(inWindow(0, 28), 3, 0) && heavyBasis(inWindow(28, 84), 3, 0)
    }
    case 'D26': case 'D27': return e.qualified === true && e.nonDeload === true && e.trainedWeeks >= 4 && e.trainedWeeksAfterPeak >= 3 && e.latestAge >= 0 && e.latestAge <= 14 && (id !== 'D27' || !e.fall || e.consecutiveObservedWeeks >= 6)
    case 'D33': return weeksBasis(e, 4)
    case 'D35': return weeksBasis(e, e.trend ? 4 : 1, true) && e.comparable === true
    case 'D37': case 'D39': return e.plannedSets >= 1 && e.samePeriod === true && e.weeks.some(w => {
      const d = dayNumber(w.start_date), t = dayNumber(e.today)
      return d !== null && t !== null && d + 7 <= t && w.complete === true
    })
    case 'D38': return e.complete === true && e.plannedSets >= 1 && e.performedPositions === e.plannedSets && e.allExercises === true
    case 'D40': return e.complete === true && e.planKnown === true && (e.dropout ? e.historicalWeeks >= 4 && e.recentCompleteDays >= 30 && e.contextKnown === true : e.closed === true)
    case 'D41': return e.fullPlanWeek === true && e.performedSessions >= 1 && e.voiceCount >= 1 && e.openCount === 0 && e.allSourcesConfirmed === true
    case 'D46': case 'D47': return weightWindows(rows, e.today).ready
    case 'D48': {
      const meals = recent(rows, e.today, 28).filter(r => r.completeDay === true && finite(r.kcal) && r.kcal >= 0)
      const weights = recent(e.weights || [], e.today, 28).filter(r => finite(r.weight) && r.weight > 0)
      const ds = uniqueDays(meals), ws = uniqueDays(weights)
      return ds.length >= 21 && ws.length >= 6 && span(weights) >= 21 && weights.every(w => ds.includes(dayNumber(w.logged_at))) && ws.filter(d => d < ds[0] + 7).length >= 3 && ws.filter(d => d > ds.at(-1) - 7).length >= 3
    }
    case 'D56': return e.qualityChecked === true && e.validReps >= 3 && e.phasesKnown === true && e.calibrated === true && e.measurementBasis === true && (!e.interpretation || e.marcReviewed === true)
    case 'D59': {
      if (!e.currentId || !e.athleteId || !e.metric || !e.method || !e.version || !e.variation) return false
      const refs = dated(rows).filter(r => r.id && r.id !== e.currentId && r.approved === true && r.athleteId === e.athleteId && r.variation === e.variation && r.metric === e.metric && r.method === e.method && r.version === e.version && finite(r.value))
      const ids = new Set(refs.map(r => r.id))
      return ids.size === refs.length && ids.size >= 5 && uniqueDays(refs).length >= 3
    }
    case 'D69': return rows.some(r => r.planReference && dayNumber(r.basisDate) !== null && r.engineMinimumDocumented === true && r.engineMinimumMet === true && (!r.historicalDirection || r.comparableSessions >= 3))
    case 'D76': return e.openCount === 0 && e.allSourcesConfirmed === true && dayNumber(e.refreshedAt) !== null
    default: return false
  }
}
export function dataAllowed(id, evidence = {}) {
  return !dataEnoughEnabled() || hasEnoughData(id, evidence)
}
// Lazy rendering keeps the legacy value and callback untouched when off.
export function renderDataInsight(h, id, evidence, render) {
  return dataAllowed(id, evidence) ? render() : h('p', { 'data-insufficient': id }, dataMessage(id))
}
