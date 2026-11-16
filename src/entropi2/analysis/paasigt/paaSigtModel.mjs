import { antalOrd } from '../../antalOrd.mjs'
import { calendarDay, addCalendarDays, calendarDaysBetween } from '../../../calendarDate.js'
import { estimatedOneRepMax, erDeloadBlok } from '../../../exerciseProgress.js'
import { mainLiftName } from '../../../exerciseSetView.js'
import { adaptPublicContract } from '../publicContract.mjs'
import { MAIN_LIFTS } from '../weekOverview.mjs'
import { developmentSnapshot } from '../developmentModel.mjs'

// Ordre 1543 (Marc 4. nov.: "mere på sigt og fortælle mere til atleten").
// Ren funktion: kun de props Analysis allerede får. Ingen læsning, ingen skrivning.
// Hellere intet end gæt: et løft uden nok sammenlignelige tunge sæt får ingen linje.
export const PAA_SIGT_DAGE = 56
export const PAA_SIGT_MIN_DAGE = 28
export const PAA_SIGT_MIN_UGER = 3
export const PAA_SIGT_FRISK_DAGE = 14
export const PAA_SIGT_TOP_UGER = 8
export const PAA_SIGT_ROLIG = 'Når du har logget tunge sæt i samme løft i mindst 4 uger, viser vi her, hvor din styrke er på vej hen.'

const subjekt = lift => ({ Squat: 'Din squat', Bænkpres: 'Dit bænkpres', Dødløft: 'Dit dødløft', 'Sumo dødløft': 'Dit sumo dødløft' })[lift]
const uger = n => `${n} ${antalOrd(n, 'uge', 'uger')}`

// Lineær tendens (mindste kvadrater) over dage; robust mod én enkelt god eller dårlig uge.
export function paaSigtFit(points) {
  const xs = points.map(p => calendarDaysBetween(points[0].day, p.day)), ys = points.map(p => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  const slope = sxx > 0 ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx : 0
  return { slope, at: x => my + slope * (x - mx), span: xs.at(-1) }
}

// Planlagt sværhed for én øvelse ud fra coachens tekst: "RPE 8", "@8" eller "85 %".
export function planlagtSvaerhed(intensity) {
  const text = typeof intensity === 'string' ? intensity : ''
  const rpe = text.match(/(?:RPE\s*|@\s*)(\d+(?:[.,]\d+)?)/i)
  if (rpe) { const v = Number(rpe[1].replace(',', '.')); return v >= 8 ? 'tung' : v <= 6.5 ? 'let' : 'middel' }
  const pct = text.match(/(\d+(?:[.,]\d+)?)\s*%/)
  if (pct) { const v = Number(pct[1].replace(',', '.')); return v >= 85 ? 'tung' : v <= 70 ? 'let' : 'middel' }
  return null
}

function ugensPlan(contract, lift) {
  if (!contract.activeWeek) return null
  const exercises = (Array.isArray(contract.week?.sessions) ? contract.week.sessions : [])
    .flatMap(s => Array.isArray(s?.exercises) ? s.exercises : [])
    .filter(e => e && mainLiftName(e.name) === lift)
  if (!exercises.length) return null
  const levels = exercises.map(e => planlagtSvaerhed(e.intensity))
  if (levels.includes('tung')) return `Ugens plan har tunge sæt i ${lift.toLowerCase()}, så det er her, fremgangen kan vise sig.`
  if (levels.every(l => l === 'let')) return `Ugens ${lift.toLowerCase()} er planlagt let, så det er ikke ugen til at jagte en top.`
  return null
}

export function paaSigtModel(props = {}, now) {
  const hidden = { state: 'hidden', lifts: [], message: null, deload: null }
  if (props.fremgangError || props.exerciseLogsError || props.fremgangLoading || props.exerciseLogsLoading ||
    !Array.isArray(props.fremgangLogs)) return hidden
  const today = now ? calendarDay(now) : null
  if (!today) return hidden
  const rows = developmentSnapshot(props, now)
  if (!rows) return hidden
  // Historik til toppen: samme vindue som "Din udvikling" (26 uger). Ugens plan fra currentWeek.
  const contract = adaptPublicContract({ fremgangLogs: rows, currentWeek: props.currentWeek }, now, { maxAgeDays: 182 })
  const windowStart = addCalendarDays(today, -(PAA_SIGT_DAGE - 1))
  const lifts = MAIN_LIFTS.flatMap(lift => {
    const all = contract.rows.filter(r => r.lift === lift).map(r => ({ ...r, value: estimatedOneRepMax(r.weight, r.reps_completed) }))
      .filter(r => r.value > 0)
    const recent = all.filter(r => r.logged_at >= windowStart)
    if (!recent.length) return []
    // Samme rep-område som det seneste tunge sæt, ligesom "Din udvikling".
    const latestDay = recent.map(r => r.logged_at).sort().at(-1)
    const zone = recent.filter(r => r.logged_at === latestDay).sort((a, b) => b.value - a.value)[0].repZone
    const buckets = new Map()
    for (const r of recent.filter(r => r.repZone === zone)) {
      const key = Math.floor(calendarDaysBetween(r.logged_at, today) / 7)
      const cur = buckets.get(key)
      if (!cur || r.value > cur.value) buckets.set(key, { day: r.logged_at, value: r.value })
    }
    const points = [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day))
    if (points.length < PAA_SIGT_MIN_UGER) return []
    const last = points.at(-1)
    if (calendarDaysBetween(last.day, today) > PAA_SIGT_FRISK_DAGE) return []
    const fit = paaSigtFit(points)
    if (fit.span < PAA_SIGT_MIN_DAGE) return []
    const from = fit.at(0), to = fit.at(fit.span)
    if (!(from > 0) || !(to > 0)) return []
    const weeks = Math.round(fit.span / 7)
    const percent = Math.round((to / from - 1) * 100)
    const direction = percent > 0 ? 'frem' : percent < 0 ? 'tilbage' : 'stille'
    const text = direction === 'stille'
      ? `${subjekt(lift)} har ligget stabilt de seneste ${uger(weeks)}.`
      : `${subjekt(lift)} er gået ${Math.abs(percent)} % ${direction} på ${uger(weeks)}.`
    // Toppen: bedste skøn i samme rep-område i det seneste halve år.
    const best = Math.max(...all.filter(r => r.repZone === zone && r.logged_at < last.day).map(r => r.value))
    const perWeek = fit.slope * 7
    let top = null
    if (last.value > best) top = 'Din seneste uge er dit bedste skøn i et halvt år, så du er på toppen nu.'
    else if (direction === 'frem' && perWeek > 0) {
      const n = Math.max(1, Math.ceil((best - last.value) / perWeek))
      top = n <= PAA_SIGT_TOP_UGER ? `Holder tempoet, er en ny top realistisk om cirka ${uger(n)}.`
        : `Holder tempoet, er en ny top mere end ${PAA_SIGT_TOP_UGER} uger væk.`
    }
    return [{ lift, zone, weeks, percent, direction, text, top, plan: ugensPlan(contract, lift), points: points.length }]
  })
  const deload = contract.activeWeek && erDeloadBlok(props.currentWeek?.block_name)
    ? 'Denne uge er planlagt som aflastning, så en ny top ventes først bagefter.' : null
  if (!lifts.length) return { state: 'quiet', lifts: [], message: PAA_SIGT_ROLIG, deload: null }
  return { state: 'ready', lifts: deload ? lifts.map(l => ({ ...l, plan: null })) : lifts, message: null, deload }
}
