import { calendarDay, addCalendarDays } from './calendarDate.js'
import { parseInputNumber } from './inputValues.js'
import { HOVEDLOEFT_FAMILIER, erTungtSaet, erDeloadBlok, estimatedOneRepMax } from './exerciseProgress.js'
import { exerciseSetView } from './exerciseSetView.js'
import { hentAlleSider } from './fremgangLogs.js'

export const DEFAULT_BLOK_FREMGANG = false
export const MIN_BLOCK_DAYS = 2

// Kun eksisterende coachfelter. Range afsluttes med en tom side, og fejl
// kasserer alle sider, saa et delvist svar aldrig bliver et blokmaksimum.
export async function readBlockLogs(client, athleteId) {
  try {
    return await hentAlleSider((fra, til) => client.from('exercise_logs')
      .select('id, athlete_id, set_number, weight, reps_completed, note, logged_at, rpe_actual, rpe_planned, skipped, exercise_id, exercises(id, name, sets, reps, intensity, recommended_weight, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false }).order('id', { ascending: false }).range(fra, til))
  } catch (error) {
    return { data: null, error }
  }
}

const unknown = reason => ({ status: 'unknown', reason, lifts: [] })
const blockLabel = block => `${block.name}, uge ${block.weeks[0].week_number} til ${block.weeks.at(-1).week_number}`

// Samme sammenhaengende bloknavne som computePhases. Ingen gattet dato,
// sammenblanding af gentagne navne eller spring over den umiddelbart forrige blok.
export function compareBlocks({ enabled = DEFAULT_BLOK_FREMGANG, weeks = [], logs = [], today = calendarDay(), athleteId } = {}) {
  if (enabled !== true) return null
  if (!Array.isArray(weeks) || !weeks.length || weeks.some(w => !w) || !Array.isArray(logs) || !calendarDay(today)) return unknown('Der mangler program eller logninger.')
  today = calendarDay(today)
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number)
  const ids = new Set(), numbers = new Set()
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i], prev = sorted[i - 1]
    if (w.id == null || ids.has(w.id) || !Number.isSafeInteger(w.week_number) || numbers.has(w.week_number)
      || typeof w.block_name !== 'string' || !w.block_name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(w.start_date || '') || calendarDay(w.start_date) !== w.start_date
      || (athleteId != null && w.athlete_id !== athleteId)
      || (prev && (w.week_number !== prev.week_number + 1 || w.start_date !== addCalendarDays(prev.start_date, 7)))) {
      return unknown('Blokkenes navne, rækkefølge eller datoer er ikke entydige.')
    }
    ids.add(w.id); numbers.add(w.week_number)
  }
  const blocks = []
  for (const w of sorted) {
    if (blocks.at(-1)?.name !== w.block_name) blocks.push({ name: w.block_name, weeks: [] })
    blocks.at(-1).weeks.push(w)
  }
  const index = blocks.findIndex(b => b.weeks.some(w => w.start_date <= today && today < addCalendarDays(w.start_date, 7)))
  if (index <= 0) return unknown('Der skal være en aktuel og en forrige dateret blok.')
  const current = blocks[index], previous = blocks[index - 1]
  if ([current, previous].some(b => erDeloadBlok(b.name))) return unknown('En let blok sammenlignes ikke som styrke.')

  // exercise_id binder saettet til en bestemt programuge. Tidsstemplet
  // alene eller et bloknavn er ikke en sikker identitet.
  const exercises = new Map()
  for (const [side, block] of [[0, previous], [1, current]]) {
    for (const w of block.weeks) for (const session of w.sessions || []) for (const ex of session.exercises || []) {
      if (ex.id == null) continue
      if (exercises.has(ex.id)) return unknown('En øvelse optræder i flere programuger.')
      exercises.set(ex.id, { side, name: ex.name, block })
    }
  }
  const lifts = HOVEDLOEFT_FAMILIER.map(lift => {
    const days = [new Map(), new Map()]
    for (const log of logs) {
      if (!log || log.skipped || typeof log.logged_at !== 'string' || !log.logged_at.trim() || (athleteId != null && log.athlete_id !== athleteId)) continue
      const ex = exercises.get(log.exercise_id)
      if (!ex || !lift.match(ex.name) || !lift.match(log.exercises?.name)) continue
      const day = calendarDay(log.logged_at), weight = parseInputNumber(log.weight), reps = parseInputNumber(log.reps_completed)
      if (!day || day > today || day < ex.block.weeks[0].start_date || day >= addCalendarDays(ex.block.weeks.at(-1).start_date, 7)
        || !(weight > 0) || !Number.isSafeInteger(reps) || !erTungtSaet(log.exercises.name, reps) || !erTungtSaet(ex.name, reps)
        || exerciseSetView(ex.name).key !== exerciseSetView(log.exercises.name).key) continue
      const value = estimatedOneRepMax(weight, reps)
      if (!(value > 0)) continue
      const set = { day, weight, reps, value, name: log.exercises.name }
      const best = days[ex.side].get(day)
      if (!best || value > best.value || (value === best.value && weight > best.weight)) days[ex.side].set(day, set)
    }
    const counts = days.map(d => d.size)
    if (counts.some(n => n < MIN_BLOCK_DAYS)) return { key: lift.key, name: lift.label, status: 'insufficient', counts }
    const best = days.map(d => [...d.values()].sort((a, b) => b.value - a.value || b.weight - a.weight || a.day.localeCompare(b.day))[0])
    const [before, now] = best.map(set => ({ ...set, e1rm: Math.round(set.value) }))
    return { key: lift.key, name: lift.label, status: 'ready', counts, before, now, delta: now.e1rm - before.e1rm }
  })
  return { status: 'known', previous: blockLabel(previous), current: blockLabel(current), today, lifts }
}

const kg = n => String(n).replace('.', ',')
const setText = s => `${kg(s.weight)} kg × ${s.reps}, ${s.day}. e1RM ${s.e1rm} kg`

export function renderBlockComparison(h, options) {
  const model = compareBlocks(options)
  if (!model) return null
  return h('section', { 'aria-label': 'Denne blok mod forrige blok', 'data-blok-fremgang': model.status,
    style: { marginBottom: '1rem', padding: '1rem', border: '1px solid #59564c', color: '#edeae2', overflowWrap: 'anywhere' } },
  h('h2', { style: { fontSize: '1rem' } }, 'Denne blok mod forrige blok'),
  model.status === 'unknown' ? h('p', null, model.reason) : h('div', null,
    h('p', null, `Denne blok: ${model.current}. Indtil ${model.today}. Forrige blok: ${model.previous}.`),
    h('p', null, 'Bedste tunge sæt efter e1RM, et skøn over vægten for én gentagelse. Mindst to træningsdage i hver blok. En igangværende blok kan have færre træningsdage.'),
    ...model.lifts.map(l => h('div', { key: l.key, 'data-blok-loeft': l.key },
      h('h3', { style: { fontSize: '0.95rem' } }, l.name),
      l.status !== 'ready' ? h('p', null, `Ikke nok grundlag. Tunge træningsdage: denne blok ${l.counts[1]}, forrige blok ${l.counts[0]}.`) : h('div', null,
        h('p', null, `Denne blok: ${setText(l.now)}.`),
        h('p', null, `Forrige blok: ${setText(l.before)}.`),
        h('p', null, `Forskel i skøn: ${l.delta > 0 ? '+' : ''}${l.delta} kg. Træningsdage: ${l.counts[1]} mod ${l.counts[0]}.`))))))
}
