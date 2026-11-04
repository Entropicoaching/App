import { addCalendarDays, calendarDay, calendarDaysBetween } from '../../../calendarDate.js'
import { parseInputNumber } from '../../../inputValues.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadBlok } from '../../../exerciseProgress.js'
import { mainLiftName } from '../../../exerciseSetView.js'
import { MAIN_LIFTS } from '../weekOverview.mjs'
import { repZone } from '../../../dataEvidence.mjs'

const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
const day = value => typeof value === 'string' && dayPattern.test(value) ? calendarDay(value) : null
const id = value => typeof value === 'string' && value.trim().length > 0
const problem = message => ({ status: 'error', message })
export const formatBlokslutNumber = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)

// Explicit, athlete-scoped, authoritative full-block snapshot; no implicit clock,
// database reads, history/local merging, side effects or program changes.
export function blokslutModel(props = {}) {
  if (props.error) return problem('Blokkens data kunne ikke hentes. Prøv igen senere.')
  if (props.loading === true) return { status: 'loading', message: 'Henter blokkens data.' }
  const today = day(props.now) || ((props.now instanceof Date ||
    (typeof props.now === 'string' && timestamp.test(props.now))) ? calendarDay(props.now) : null)
  const block = props.block
  const start = day(block?.start_date), end = day(block?.end_date)
  const span = start && end ? calendarDaysBetween(start, end) : null
  if (!today || span === null || span < 0 || span > 365 || start > today)
    return problem('Blokkens periode eller opgørelsesdato mangler eller er ugyldig.')
  const through = today < end ? today : end
  if (!Array.isArray(block.weeks) || block.weeks.length !== Math.floor(span / 7) + 1)
    return problem('Den samlede plan for blokken mangler.')
  const byExercise = new Map(), sessions = []
  const weeks = block.weeks.map((week, i) => ({ start: addCalendarDays(start, i * 7),
    end: addCalendarDays(start, Math.min(span, i * 7 + 6)), sets: 0, tonnage: 0, uncertain: false, week }))
  const sessionIds = new Set()
  for (const w of weeks) {
    if (w.week?.start_date !== w.start || typeof w.week.block_name !== 'string' ||
      !w.week.block_name.trim() || !Array.isArray(w.week.sessions)) return problem('Blokkens ugeplan er ufuldstændig.')
    for (const session of w.week.sessions) {
      if (!id(session?.id) || sessionIds.has(session.id) || !Array.isArray(session.exercises))
        return problem('Blokkens pasplan er ufuldstændig eller indeholder dubletter.')
      sessionIds.add(session.id)
      const planned = []
      for (const ex of session.exercises) {
        if (!id(ex?.id) || byExercise.has(ex.id) || typeof ex.name !== 'string' || !ex.name.trim() ||
          !Number.isSafeInteger(ex.sets) || ex.sets < 1 || ex.sets > 1000)
          return problem('Blokkens øvelsesplan er ufuldstændig eller indeholder dubletter.')
        const entry = { ...ex, week: w, positions: new Map() }
        byExercise.set(ex.id, entry); planned.push(entry)
      }
      if (planned.length && w.start <= through) sessions.push(planned)
    }
  }
  if (!Array.isArray(props.exerciseLogs)) return { status: 'empty', message: 'Blokkens logdata mangler.' }
  // One position per planned exercise/set. Retries with identical content count
  // once; conflicting/pending copies make that position unknown, never a winner.
  const exactCutoff = day(props.now) ? null : new Date(props.now).getTime()
  for (const row of props.exerciseLogs) {
    const ex = byExercise.get(row?.exercise_id)
    if (!ex || !Number.isSafeInteger(row.set_number) || row.set_number < 1 || row.set_number > ex.sets) continue
    const rawDate = row.logged_at
    const logged = day(rawDate) || (typeof rawDate === 'string' && timestamp.test(rawDate) ? calendarDay(rawDate) : null)
    if (!logged || logged < ex.week.start || logged > ex.week.end || logged > through ||
      (exactCutoff !== null && timestamp.test(rawDate) && Date.parse(rawDate) > exactCutoff)) continue
    const weight = parseInputNumber(row.weight), reps = parseInputNumber(row.reps_completed)
    const skipped = row.skipped === true
    const valid = !row._optimistic && (row.skipped == null || typeof row.skipped === 'boolean') &&
      !skipped && weight !== null && weight >= 0 && Number.isSafeInteger(reps) && reps > 0 && Number.isFinite(weight * reps)
    const signature = JSON.stringify([rawDate, weight, reps, row.skipped ?? false, !!row._optimistic])
    const copies = ex.positions.get(row.set_number) ?? new Map()
    copies.set(signature, { logged, weight, reps, valid, skipped, pending: !!row._optimistic })
    ex.positions.set(row.set_number, copies)
  }
  const heavy = []
  let confirmed = 0, uncertain = false
  for (const ex of byExercise.values()) {
    for (const copies of ex.positions.values()) {
      const row = copies.size === 1 ? [...copies.values()][0] : null
      if (!row || row.pending || (!row.valid && !row.skipped)) {
        ex.week.uncertain = true; uncertain = true; continue
      }
      if (row.skipped) continue
      confirmed++; ex.week.sets++
      const total = ex.week.tonnage + row.weight * row.reps
      if (!Number.isFinite(total)) { ex.week.uncertain = true; uncertain = true }
      else ex.week.tonnage = total
      const lift = mainLiftName(ex.name)
      if (lift && !erDeloadBlok(ex.week.week.block_name) && erTungtSaet(ex.name, row.reps)) {
        const value = estimatedOneRepMax(row.weight, row.reps)
        if (value > 0) heavy.push({ lift, value, date: row.logged, weekStart: ex.week.start, zone: repZone(row.reps) })
      }
    }
  }
  const completed = sessions.filter(exercises => exercises.every(ex => ex.positions.size === ex.sets &&
    [...ex.positions.values()].every(copies => copies.size === 1 && [...copies.values()][0].valid))).length
  const latestStart = weeks.find(w => through >= w.start && through <= w.end).start
  const lifts = MAIN_LIFTS.map(lift => {
    const first = heavy.filter(r => r.lift === lift && r.weekStart === start)
    const latest = heavy.filter(r => r.lift === lift && r.weekStart === latestStart)
    const best = rows => rows.sort((a, b) => b.value - a.value || a.date.localeCompare(b.date) || a.zone.localeCompare(b.zone))[0] ?? null
    const baseline = best(first)
    const current = best(latest)
    // Comparing only the best estimates in the same rep zone avoids selecting
    // a weaker baseline just to manufacture an improvement.
    const comparable = latestStart !== start && baseline && current && baseline.zone === current.zone && !uncertain
    const raw = comparable ? current.value - baseline.value : null
    const delta = raw === null ? null : Number(raw.toFixed(1)) || 0
    return { lift, baseline, current, delta,
      message: uncertain ? 'Afventende eller modstridende sæt: sammenligningen er ikke klar.'
        : latestStart === start ? 'Der er endnu kun én blokuge.'
          : !baseline || !current ? 'Mangler tunge sæt ved blokstart eller i den seneste blokuge.'
            : baseline.zone !== current.zone ? 'Sættene har forskellige rep-områder og sammenlignes ikke.' : null }
  })
  const focus = !confirmed || uncertain
    ? 'Aftal med din coach, hvilke registreringer der mangler, før næste blok vurderes.'
    : completed < sessions.length ? 'Tal med din coach om, hvad der kan gøre passene lettere at gennemføre i næste blok.'
      : 'Tag én ting, der fungerede godt i denne blok, med i samtalen om den næste.'
  return { status: 'ready', start, end, through, completed, planned: sessions.length, confirmed, uncertain,
    lifts, focus, weeks: weeks.filter(w => w.start <= through).map(w => ({ start: w.start,
      end: w.end < through ? w.end : through, sets: w.sets, tonnage: w.uncertain ? null : w.tonnage })) }
}
