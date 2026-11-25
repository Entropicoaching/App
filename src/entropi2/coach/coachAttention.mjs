import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { mentionsPain, stilstandUdeSaet, STILSTAND_SPOERG } from '../../coachBriefingRules.js'
import { nutritionTrend } from '../tracking/nutritionTrend.mjs'
import { onVacation } from '../u3/couplings.mjs'
import { mondayOf, shortDate } from '../u3/format.mjs'
import { friUge } from '../kostplan/friPulje.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { painFromDaily, sleepFromDaily } from '../u7/coachData.mjs'
import { erKvitteret, markFor } from './smerteKvittering.mjs'

// U3-planen afsnit 2: nye grunde under "Kræver dit blik". Rene funktioner uden
// læsninger. Tekst fra noter og kommentarer citeres aldrig; kun en fast tekst og
// en dato eller et ugenummer vises.
export const RANK = Object.freeze({ pain: 0, readinessDrop: 1, checkinStopped: 2, lowProtein: 3, followsPlan: 4 })
export const ATTENTION_UNAVAILABLE = 'Nye opmærksomhedsgrunde kunne ikke hentes'

const finite = value => typeof value === 'number' && Number.isFinite(value)
const average = values => values.reduce((n, v) => n + v, 0) / values.length
const dayOf = value => typeof value === 'string' ? calendarDay(/T/.test(value) ? value : value.slice(0, 10)) : null

// (a) Smerteord i exercise_logs.note de seneste 14 dage. Seneste dato vises.
export function painFromNotes(notes, today) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(notes)) return null
  const from = addCalendarDays(day, -14)
  const dates = notes.filter(r => typeof r?.note === 'string' && mentionsPain(r.note))
    .map(r => dayOf(r.logged_at)).filter(d => d && d >= from && d <= day).sort()
  return dates.length ? { date: dates.at(-1), reason: `Smerte nævnt ${shortDate(dates.at(-1))}` } : null
}

// (b) Smerteord i en pas-kommentar. Kommentaren har ingen dato, så ugen tæller
// som i detectPain: start_date mindst mandag i indeværende uge minus 7 dage.
export function painFromVoices(weeks, today) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(weeks)) return null
  const since = addCalendarDays(mondayOf(day), -7)
  const hits = weeks.filter(w => calendarDay(w?.start_date) && w.start_date >= since && w.start_date <= day &&
    Array.isArray(w.session_voices) && w.session_voices.some(v => mentionsPain(v?.comment)))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
  if (!hits.length) return null
  const n = hits[0].week_number
  return { week: n, date: hits[0].start_date, reason: Number.isSafeInteger(n) ? `Smerte nævnt i uge ${n}` : 'Smerte nævnt i en pas-kommentar' }
}

// (c) soreness_level mindst 4 på mindst 3 af de seneste 7 afsluttede dage.
export function soreness(rows, today) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(rows)) return null
  const from = addCalendarDays(day, -7), days = new Set()
  for (const r of rows) {
    const d = dayOf(r?.logged_date)
    if (d && d >= from && d < day && Number(r.soreness_level) >= 4) days.add(d)
  }
  return days.size >= 3 ? { days: days.size, date: [...days].sort().at(-1), reason: `Ømhed ${days.size} af 7 dage` } : null
}

// Readiness falder: snit af de 3 seneste afsluttede dage under snittet for dag
// 4 til 28 minus tærsklen fra compareReadiness (0,5 × sd, ellers 3 point).
export const READINESS_RECENT_DAYS = 3
export const READINESS_MIN_HISTORY = 10
export function readinessDrop(rows, today) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(rows)) return null
  const byDay = new Map()
  for (const r of rows) {
    const d = dayOf(r?.logged_date)
    if (d && d < day && finite(r.readiness_score)) byDay.set(d, r.readiness_score)
  }
  const recent = [1, 2, 3].map(i => byDay.get(addCalendarDays(day, -i)))
  if (recent.some(v => v === undefined)) return null
  const history = []
  for (let i = 4; i <= 28; i++) {
    const v = byDay.get(addCalendarDays(day, -i))
    if (v !== undefined) history.push(v)
  }
  if (history.length < READINESS_MIN_HISTORY) return null
  const mean = average(history)
  const sd = Math.sqrt(history.reduce((n, v) => n + (v - mean) ** 2, 0) / history.length)
  const threshold = sd > 0.0001 ? sd * 0.5 : 3
  const current = average(recent)
  return current < mean - threshold ? { current, mean, threshold, reason: 'Readiness falder' } : null
}

// Check-in stoppet: ingen readiness de seneste 7 afsluttede dage, selvom atleten
// havde mindst 8 check-ins i dagene 8 til 35. Ikke ved ferie.
export function checkinStopped(rows, today, athlete) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(rows) || onVacation(athlete, day)) return null
  const days = new Set(rows.map(r => dayOf(r?.logged_date)).filter(Boolean))
  for (let i = 1; i <= 7; i++) if (days.has(addCalendarDays(day, -i))) return null
  let before = 0
  for (let i = 8; i <= 35; i++) if (days.has(addCalendarDays(day, -i))) before++
  return before >= 8 ? { before, reason: 'Check-in stoppet' } : null
}

// Protein under målet: signalet 'lavt protein' fra nutritionTrend over
// coachNutrition, kun når kilden allerede er godkendt af coachNutritionLines.
export function lowProtein(source, athleteId, day) {
  if (!Array.isArray(source?.rows) || !Array.isArray(source?.targets)) return null
  const target = source.targets.find(t => t?.athlete_id === athleteId)
  if (!(Number(target?.protein_target) > 0)) return null
  const trend = nutritionTrend(source.rows.filter(r => r?.athlete_id === athleteId), target, day, { projection: 'kcal-protein' })
  return trend?.signal === 'lavt protein' ? { reason: 'Protein under målet' } : null
}

// Ordre 2184 (Marc 24. nov. kl. 19:11: atleterne skal "rent faktisk følge planerne"): samme friUge som
// coachens og atletens ugelinje, de 7 seneste afsluttede dage (kostplanens vindue slutter i går).
// Kun med mindst 3 vurderede dage med niveau over 0 %, og kun når basemåltider fulgt er under halvdelen
// eller den fri pulje ikke er holdt på de fleste vurderede dage. Fast, neutral tekst; ren læsning.
export const FOELGER_MIN_DAGE = 3
export function followsPlan(entry, day) {
  if (!Array.isArray(entry?.planDays) || !Array.isArray(entry?.meals) || !calendarDay(day)) return null
  const from = addCalendarDays(day, -7), through = addCalendarDays(day, -1)
  const within = row => row?.date >= from && row.date <= through
  const fri = friUge({ dage: entry.planDays.filter(within),
    raekker: entry.meals.filter(row => within(row) && !isDayReceipt(row) && typeof row.meal === 'string' && row.meal.trim()) })
  if (!fri || fri.vurderede < FOELGER_MIN_DAGE) return null
  const lidtBase = fri.basisAf > 0 && fri.basis * 2 < fri.basisAf
  const pulje = (fri.vurderede - fri.holdt) * 2 > fri.vurderede
  return lidtBase || pulje ? { reason: 'Følger ikke kostplanen' } : null
}

// Ordre 1545: stilstand fra briefingens SQL-regel (stalled >= 3) med Marcs domme fra 8. okt.:
// et sprunget eller fejlet sæt i perioden giver "Spørg atleten først"; ellers "overvej deload"
// uden øvelsesnavne. Fladt uden stigende RPE er ikke akut og vises ikke her. Ukendte sæt
// (source.logs null) giver ingen grund, så coachen aldrig får det forkerte forslag.
export const STILSTAND_RANK = 2
export const flatLog = r => ({ name: r?.exercises?.name, logged_at: r?.logged_at, weight: r?.weight,
  reps_completed: r?.reps_completed, skipped: r?.skipped, session_id: r?.exercises?.session_id,
  block_name: r?.exercises?.sessions?.weeks?.block_name, week_number: r?.exercises?.sessions?.weeks?.week_number })
export function stagnationReason(source) {
  const signal = source?.signal, lift = signal?.o_metrics?.lift, stalled = Number(signal?.o_metrics?.stalled_weeks)
  if (typeof lift !== 'string' || !(stalled >= 3) || !Array.isArray(source.logs)) return null
  const ude = stilstandUdeSaet(source.logs.map(flatLog), lift, stalled)
  if (ude) return { reason: `${STILSTAND_SPOERG} (${lift.toLocaleLowerCase('da')} står stille, ${ude.grund})` }
  return signal.o_severity === 'alert' ? { reason: `${lift} står stille ${stalled} uger: overvej deload` } : null
}

// Alle nye grunde for én atlet. attention er L1 for netop denne atlet, eller
// null, når L1 ikke er komplet: så vises smerte, readiness og check-in ikke.
export function attentionCandidates({ athlete, day, attention, weeks, nutritionSource, nutritionReady, planEntry, kvitteringer }) {
  const out = []
  const add = (kind, rank, found) => found && out.push({ key: `u3-${kind}-${athlete.id}`, athlete, rank, tab: 'hub', reason: found.reason, u3: kind })
  if (attention) {
    // U7: smerte som tal fra tracking_daily_v1 går forud for smerteord; daily findes kun med tabellen.
    const daily = Array.isArray(attention.daily) ? attention.daily : null
    // Ordre 1711: en kvitteret smerte vises ikke, før atleten melder en nyere dato eller et højere niveau.
    const sources = [['daily', () => daily && painFromDaily(daily, day)], ['notes', () => painFromNotes(attention.notes, day)],
      ['voices', () => painFromVoices(weeks, day)], ['soreness', () => soreness(attention.readiness, day)]]
    for (const [kind, find] of sources) {
      const found = find()
      if (!found) continue
      const smerte = markFor(kind, found)
      if (!erKvitteret(kvitteringer, athlete.id, smerte)) { add('pain', RANK.pain, found); out.at(-1).smerte = smerte }
      break
    }
    add('readiness', RANK.readinessDrop, readinessDrop(attention.readiness, day))
    if (daily) add('sleep', RANK.readinessDrop, sleepFromDaily(daily, day))
    add('checkin', RANK.checkinStopped, checkinStopped(attention.readiness, day, athlete))
    if (attention.stagnation) add('stagnation', STILSTAND_RANK, stagnationReason(attention.stagnation))
  }
  if (nutritionReady) add('protein', RANK.lowProtein, lowProtein(nutritionSource, athlete.id, day))
  if (planEntry && !onVacation(athlete, day)) add('plan', RANK.followsPlan, followsPlan(planEntry, day))
  return out
}

export const alsoLine = reasons => reasons.length > 1
  ? `Også: ${reasons.slice(1).map(r => r.charAt(0).toLocaleLowerCase('da') + r.slice(1)).join(', ')}` : null
