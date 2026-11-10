import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadBlok } from '../../../exerciseProgress.js'
import { exerciseSetView } from '../../../exerciseSetView.js'
import { parseInputNumber } from '../../../inputValues.js'
import { uniqueSets } from '../weeklyLoad.mjs'
import { sessionCounts } from '../../u3/sessionCounts.mjs'

// U3-planen afsnit 4: blok for blok. Reglen fra compareBlocks (blokFremgang.mjs)
// generaliseret til op til 4 blokke: ugerne sorteres efter week_number,
// sammenhængende uger med samme block_name er én blok, og ugerne skal følge
// hinanden med 7 dage. Et sæt hører til blokken via exercise_id, ikke via dato.
export const MAX_BLOCKS = 4
export const MIN_COMPLETED_WEEKS = 2
export const MIN_HEAVY_DAYS = 2
export const AMBIGUOUS = 'Blokkenes rækkefølge er ikke entydig'
export const LIFTS = Object.freeze([['Squat', 'Squat'], ['Bænkpres', 'Bænk'], ['Dødløft', 'Dødløft'], ['Sumo dødløft', 'Sumo']]
  .map(([name, label]) => ({ key: exerciseSetView(name).key, name, label })))
const LIFT_KEYS = new Set(LIFTS.map(l => l.key))

const finite = value => typeof value === 'number' && Number.isFinite(value)
const average = values => values.length ? values.reduce((n, v) => n + v, 0) / values.length : null
const dayOf = value => typeof value === 'string' ? calendarDay(/T/.test(value) ? value : value.slice(0, 10)) : null

export function orderedBlocks(weeks, today) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(weeks)) return { status: 'unknown' }
  const started = weeks.filter(w => calendarDay(w?.start_date) && w.start_date <= day)
  if (!started.length) return { status: 'empty' }
  const ids = new Set(), numbers = new Set()
  for (const w of started) {
    if (w.id == null || ids.has(w.id) || !Number.isSafeInteger(w.week_number) || numbers.has(w.week_number) ||
      typeof w.block_name !== 'string' || !w.block_name.trim()) return { status: 'ambiguous' }
    ids.add(w.id); numbers.add(w.week_number)
  }
  const sorted = [...started].sort((a, b) => a.week_number - b.week_number)
  const blocks = []
  for (const [i, w] of sorted.entries()) {
    const prev = sorted[i - 1]
    if (prev && (w.week_number !== prev.week_number + 1 || w.start_date !== addCalendarDays(prev.start_date, 7))) return { status: 'ambiguous' }
    const last = blocks.at(-1)
    if (last && last.name === w.block_name.trim()) last.weeks.push(w)
    else blocks.push({ name: w.block_name.trim(), weeks: [w] })
  }
  return { status: 'ready', blocks: blocks.slice(-MAX_BLOCKS) }
}

export function blocksModel({ weeks, logs, weights, readiness, today, now = new Date() } = {}) {
  const day = calendarDay(today)
  const order = orderedBlocks(weeks, day)
  if (order.status === 'ambiguous') return { status: 'ambiguous', message: AMBIGUOUS, blocks: [] }
  if (order.status !== 'ready') return { status: order.status, blocks: [] }
  const yesterday = addCalendarDays(day, -1)
  const owner = new Map()
  order.blocks.forEach((block, index) => {
    for (const w of block.weeks) for (const s of w.sessions ?? []) for (const e of s?.exercises ?? []) {
      if (e?.id != null) owner.set(e.id, { index, name: e.name })
    }
  })
  const sets = Array.isArray(logs) ? uniqueSets(logs).filter(r => r && !r.skipped && !r._optimistic && owner.has(r.exercise_id)) : null
  const blocks = order.blocks.map((block, index) => {
    const start = block.weeks[0].start_date
    const end = addCalendarDays(block.weeks.at(-1).start_date, 6)
    const completed = block.weeks.filter(w => addCalendarDays(w.start_date, 6) < day)
    const light = erDeloadBlok(block.name)
    const base = { name: block.name, start, end, current: index === order.blocks.length - 1, light, weeks: block.weeks.length, completedWeeks: completed.length }
    if (completed.length < MIN_COMPLETED_WEEKS) return { ...base, enough: false, lifts: {}, sessionShare: null, setsPerWeek: null, weight: null, readiness: null }

    // B1: bedste e1RM pr. hovedløft (R4: kun tunge sæt, deload udeladt), mindst 2 tunge dage.
    const lifts = {}
    if (!light && sets) {
      for (const lift of LIFTS) {
        const days = new Set()
        let best = null
        for (const r of sets) {
          const ex = owner.get(r.exercise_id)
          if (ex.index !== index) continue
          const name = ex.name ?? r.exercises?.name
          if (exerciseSetView(name).key !== lift.key || !erTungtSaet(name, r.reps_completed)) continue
          const value = estimatedOneRepMax(r.weight, r.reps_completed)
          const d = dayOf(r.logged_at)
          if (!(value > 0) || !d) continue
          days.add(d)
          best = best === null ? value : Math.max(best, value)
        }
        lifts[lift.key] = days.size >= MIN_HEAVY_DAYS ? best : null
      }
    }

    // B2: sæt og tonnage pr. uge i snit og gennemførte pas af planlagte, i afsluttede uger.
    let setsPerWeek = null, tonnagePerWeek = null, sessionShare = null
    if (sets) {
      const ids = new Set(completed.flatMap(w => (w.sessions ?? []).flatMap(s => (s?.exercises ?? []).map(e => e?.id))))
      const inWeeks = sets.filter(r => ids.has(r.exercise_id))
      setsPerWeek = inWeeks.length / completed.length
      const loads = inWeeks.map(r => parseInputNumber(r.weight) * parseInputNumber(r.reps_completed))
      tonnagePerWeek = loads.every(finite) ? loads.reduce((n, v) => n + v, 0) / completed.length : null
      let planned = 0, done = 0
      for (const w of completed) {
        const c = sessionCounts(w, logs, { today: day, now })
        if (c.planned === null || c.done === null) { planned = null; break }
        planned += c.planned; done += c.done
      }
      sessionShare = planned > 0 ? done / planned : null
    }

    // B3: vægt som snit af blokkens sidste 7 dage med mindst 3 vejninger,
    // readiness som snit med mindst 4 dage pr. blokuge i snit.
    const last = end < day ? end : yesterday
    const weightDays = new Map()
    for (const r of Array.isArray(weights) ? weights : []) {
      const d = dayOf(r?.logged_at), w = parseInputNumber(r?.weight)
      if (!d || d < addCalendarDays(last, -6) || d > last || !(w > 0)) continue
      const prev = weightDays.get(d)
      if (!prev || String(r.created_at ?? '') > prev.created) weightDays.set(d, { w, created: String(r.created_at ?? '') })
    }
    const weight = weightDays.size >= 3 ? average([...weightDays.values()].map(v => v.w)) : null
    const readinessDays = new Map()
    for (const r of Array.isArray(readiness) ? readiness : []) {
      const d = dayOf(r?.logged_date)
      if (d && d >= start && d <= last && finite(r.readiness_score)) readinessDays.set(d, r.readiness_score)
    }
    const readinessAverage = readinessDays.size >= 4 * completed.length ? average([...readinessDays.values()]) : null
    return { ...base, enough: true, lifts, setsPerWeek, tonnagePerWeek, sessionShare, weight, readiness: readinessAverage }
  })
  // Ændring mod forrige blok vises kun, når begge blokke har tallet.
  for (const [i, block] of blocks.entries()) {
    block.changes = {}
    const prev = blocks[i - 1]
    for (const lift of LIFTS) {
      const a = prev?.lifts?.[lift.key], b = block.lifts?.[lift.key]
      block.changes[lift.key] = finite(a) && finite(b) ? b - a : null
    }
  }
  const shown = blocks.length < 2 ? blocks.slice(-1) : blocks
  return { status: 'ready', blocks: shown, single: blocks.length < 2, liftsShown: LIFTS.filter(l => shown.some(b => finite(b.lifts?.[l.key]))) }
}

export { LIFT_KEYS }
