import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { inputInteger } from '../../../inputValues.js'

export const PROGRAM_READ_CAP = 1000
const id = value => typeof value === 'string' && value.trim().length > 0
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDay(value) === value

// A cap is never evidence of a complete read. Do not promote the portal's
// shared arrays (which carry no receipt) into complete model snapshots.
async function read(client, table, columns, athleteId, range) {
  let query = client.from(table).select(columns).eq('athlete_id', athleteId)
  if (range) {
    const [field, from, through] = range
    // Timestamp bounds cover the entire Copenhagen civil day, including DST.
    if (field === 'logged_at') {
      query = query.gte(field, from + 'T00:00:00+02:00')
        .lt(field, addCalendarDays(through, 1) + 'T00:00:00+01:00')
    } else query = query.gte(field, from).lte(field, through)
  }
  const result = await query.order('id').limit(PROGRAM_READ_CAP)
  if (result?.error || !Array.isArray(result?.data)) throw Error('Læsningen mislykkedes. Prøv igen.')
  if (result.data.length >= PROGRAM_READ_CAP) throw Error('Grundlaget kan være afkortet. Intet komplet forslag vises.')
  if (result.data.some(row => row?.athlete_id !== athleteId)) throw Error('Grundlaget tilhører ikke den valgte atlet.')
  return result.data.map(row => ({ ...row, id: row.id == null ? row.id : String(row.id) }))
}

const within = (rows, field, from, through) => rows.filter(row => {
  const value = typeof row[field] === 'string' ? calendarDay(row[field]) : null
  if (!value) throw Error('Grundlaget indeholder en ugyldig dato. Intet komplet forslag vises.')
  return value && value >= from && value <= through
})

export async function readBlockBasis(options) {
  if (options.enabled !== true) return null
  const { client, athleteId, today } = options
  if (!id(athleteId) || !day(today)) throw Error('Vælg en atlet og en gyldig dato.')
  const weeks = await read(client, 'weeks', 'id,athlete_id,week_number,start_date,block_name,sessions(id,exercises(id,name,sets))', athleteId)
  // Same contiguous-name grouping as the portal's computePhases. Missing dates,
  // gaps or overlaps invalidate the catalogue rather than inventing a block.
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number)
  if (new Set(sorted.map(week => week.id)).size !== sorted.length) throw Error('Ugeplanen indeholder dubletter.')
  const groups = []
  for (const week of sorted) {
    if (!id(week.id) || !day(week.start_date) || !Number.isSafeInteger(week.week_number) || !id(week.block_name))
      throw Error('Programgrundlaget er ufuldstændigt og kan ikke bruges. Hent grundlaget igen.')
    if (!Array.isArray(week.sessions) || week.sessions.length >= PROGRAM_READ_CAP || week.sessions.some(session =>
      !Array.isArray(session.exercises) || session.exercises.length >= PROGRAM_READ_CAP))
      throw Error('Pas eller øvelser kan være ufuldstændige. Intet komplet forslag vises.')
    const previous = groups.at(-1)?.at(-1)
    if (previous && (week.start_date !== addCalendarDays(previous.start_date, 7) || week.week_number !== previous.week_number + 1))
      throw Error('Ugeplanen har huller eller overlap. Kontrollér datoerne før blokforslaget.')
    if (!previous || previous.block_name !== week.block_name) groups.push([])
    groups.at(-1).push(week)
  }
  const blocks = groups.map(group => ({ id: String(group[0].id), athlete_id: athleteId,
    start_date: group[0].start_date, end_date: addCalendarDays(group.at(-1).start_date, 6), name: group[0].block_name }))
  const block = blocks.filter(b => b.end_date < today).at(-1)
  const snapshot = { athleteId, blocks: { athleteId, through: today, complete: true, rows: blocks } }
  if (!block) return snapshot
  const logs = await read(client, 'exercise_logs', 'id,athlete_id,exercise_id,set_number,logged_at,weight,reps_completed,skipped,rpe_actual,note', athleteId,
    ['logged_at', block.start_date, block.end_date])
  const receipt = { athleteId, blockId: block.id, from: block.start_date, through: block.end_date, complete: true }
  snapshot.plan = { ...receipt, rows: groups.find(group => String(group[0].id) === block.id)
    .map(week => ({ ...week, block_id: block.id, sessions: week.sessions?.map(session => ({ ...session,
      exercises: session.exercises?.map(exercise => ({ ...exercise, sets: inputInteger(exercise.sets) })) })) })) }
  snapshot.logs = { ...receipt, rows: within(logs, 'logged_at', block.start_date, block.end_date) }
  return snapshot
}

export async function readComparison(options) {
  if (options.enabled !== true) return null
  const { client, athleteId, today, first, second } = options
  if (!id(athleteId) || !day(today) || !day(first) || !day(second) || addCalendarDays(first, 6) >= second || second > today)
    throw Error('Vælg to adskilte uger i datoorden for én atlet.')
  const period = async start => {
    const end = addCalendarDays(start, 6), through = end < today ? end : today
    const sources = await Promise.all([
      read(client, 'exercise_logs', 'id,athlete_id,exercise_id,set_number,logged_at,weight,reps_completed,skipped,rpe_actual,note,exercises(name,sessions(id,weeks(block_name)))', athleteId, ['logged_at', start, through]),
      read(client, 'meal_logs', 'id,athlete_id,date,meal,kcal,protein', athleteId, ['date', start, through]),
      read(client, 'weight_logs', 'id,athlete_id,logged_at,weight', athleteId, ['logged_at', start, through]),
    ])
    const receipt = (rows, field) => ({ athleteId, from: start, through, state: 'ready', complete: true,
      rows: within(rows, field, start, through) })
    return { start, training: receipt(sources[0], 'logged_at'), nutrition: receipt(sources[1], 'date'), weight: receipt(sources[2], 'logged_at') }
  }
  const [a, b] = await Promise.all([period(first), period(second)])
  return { athleteId, first: a, second: b }
}

// Only new namespaced local drafts. No database writes or athlete delivery.
export function programDraftKey(athleteId, kind) {
  if (!id(athleteId) || !['block', 'templates', 'program'].includes(kind)) throw Error('Ugyldig udkastkontekst.')
  return `entropi2:coach-program:v1:${encodeURIComponent(athleteId)}:${kind}`
}
export function saveProgramDraft(storage, athleteId, kind, value) {
  const key = programDraftKey(athleteId, kind), raw = JSON.stringify(value)
  if (typeof raw !== 'string' || raw.length > 400000) throw Error('Udkastet er for stort til det lokale lager.')
  storage.setItem(key, raw)
}

// Only controlled validation text crosses the presentation boundary.
const readMessages = new Set([
  'Læsningen mislykkedes. Prøv igen.',
  'Grundlaget kan være afkortet. Intet komplet forslag vises.',
  'Grundlaget tilhører ikke den valgte atlet.',
  'Grundlaget indeholder en ugyldig dato. Intet komplet forslag vises.',
  'Vælg en atlet og en gyldig dato.',
  'Ugeplanen indeholder dubletter.',
  'Programgrundlaget er ufuldstændigt og kan ikke bruges. Hent grundlaget igen.',
  'Pas eller øvelser kan være ufuldstændige. Intet komplet forslag vises.',
  'Ugeplanen har huller eller overlap. Kontrollér datoerne før blokforslaget.',
  'Vælg to adskilte uger i datoorden for én atlet.',
])
export function programReadMessage(failure) {
  return readMessages.has(failure?.message) ? failure.message : 'Programgrundlaget kunne ikke hentes. Prøv igen.'
}
