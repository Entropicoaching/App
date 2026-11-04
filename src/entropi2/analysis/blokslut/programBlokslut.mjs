import { calendarDay, addCalendarDays, calendarDaysBetween } from '../../../calendarDate.js'
import { blokslutModel, formatBlokslutNumber as number } from './blokslutModel.mjs'

// Calendar time, never viewed/currentWeek: the host may advance a fully logged week.
export function selectProgramBlock(weeks, now) {
  const today = calendarDay(now)
  if (!today || !Array.isArray(weeks)) return null
  const groups = [], ids = new Set()
  for (const week of weeks) {
    if (!week || typeof week.id !== 'string' || !week.id || ids.has(week.id) ||
      typeof week.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week.start_date) ||
      !calendarDay(week.start_date)) return null
    ids.add(week.id)
    const previous = groups.at(-1)?.at(-1)
    if (previous && previous.start_date >= week.start_date) return null
    if (previous && previous.block_name === week.block_name) groups.at(-1).push(week)
    else groups.push([week])
  }
  const eligible = groups.filter(group => {
    const last = group.at(-1).start_date
    return today >= last && today <= addCalendarDays(last, 13) &&
      group.every((w, i) => typeof w.block_name === 'string' && w.block_name.trim() &&
        (!i || addCalendarDays(group[i - 1].start_date, 7) === w.start_date))
  })
  // If two windows overlap, finish the older block before introducing the new one.
  const group = eligible[0]
  if (!group || calendarDaysBetween(group[0].start_date, group.at(-1).start_date) > 359) return null
  return { start_date: group[0].start_date, end_date: addCalendarDays(group.at(-1).start_date, 6), weeks: group }
}

// The offline host snapshot contains only one week. Confirm boundaries against
// an athlete-scoped full plan before treating a cached last week as block end.
export async function confirmProgramBlock(athleteId, knownWeeks, now, readPage) {
  if (!selectProgramBlock(knownWeeks, now)) return null
  if (typeof athleteId !== 'string' || !athleteId) return null
  if (!readPage) {
    const { supabase } = await import('../../../supabase.js')
    readPage = (from, to) => supabase.from('weeks').select('id,start_date,block_name,week_number')
      .eq('athlete_id', athleteId).order('week_number', { ascending: true })
      .order('id', { ascending: true }).range(from, to)
  }
  const weeks = []
  for (let offset = 0; ; offset += 500) {
    const result = await readPage(offset, offset + 499)
    if (result?.error || !Array.isArray(result?.data)) throw Error('Plan boundaries unavailable')
    weeks.push(...result.data)
    if (result.data.length < 500) break
  }
  const block = selectProgramBlock(weeks, now)
  if (!block) return null
  const supplied = new Map(knownWeeks.map(w => [w.id, w]))
  return { ...block, weeks: block.weeks.map(w => {
    const known = supplied.get(w.id)
    return known?.start_date === w.start_date && known?.block_name === w.block_name ? known : w
  }) }
}

// Only the full, authoritative snapshot is accepted; no current/past log merging.
export async function readBlokslutLogs(athleteId, block, readPage) {
  if (typeof athleteId !== 'string' || !athleteId) throw Error('Missing athlete')
  const ids = [...new Set(block.weeks.flatMap(w => (w.sessions || []).flatMap(s =>
    (s.exercises || []).map(e => e.id))))]
  if (!ids.length) return []
  if (!readPage) {
    const { supabase } = await import('../../../supabase.js')
    readPage = (chunk, from, to) => supabase.from('exercise_logs')
      .select('exercise_id,set_number,weight,reps_completed,skipped,logged_at')
      .eq('athlete_id', athleteId).in('exercise_id', chunk)
      .order('id', { ascending: true }).range(from, to)
  }
  const rows = []
  for (let i = 0; i < ids.length; i += 100) {
    for (let offset = 0; ; offset += 500) {
      const result = await readPage(ids.slice(i, i + 100), offset, offset + 499)
      if (result?.error || !Array.isArray(result?.data)) throw Error('Incomplete block read')
      rows.push(...result.data)
      if (result.data.length < 500) break
    }
  }
  return rows
}

export const blokslutSeenKey = (athleteId, block) =>
  'entropi2:blokslut:v1:' + JSON.stringify([athleteId, block.start_date, block.end_date])
export function wasBlokslutSeen(storage, key) {
  try { return storage?.getItem(key) === '1' } catch { return false }
}
export function markBlokslutSeen(storage, key) {
  try { storage?.setItem(key, '1') } catch { /* Storage is optional; the report still works. */ }
}
export async function programBlokslutModel({ athleteId, block, now, programError, readPage }) {
  if (programError) return blokslutModel({ error: true })
  const plan = blokslutModel({ block, now })
  if (plan.status === 'error') return plan
  try {
    return blokslutModel({ block, now, exerciseLogs: await readBlokslutLogs(athleteId, block, readPage) })
  } catch { return blokslutModel({ error: true }) }
}

// Supplied createElement keeps this renderer usable by real React and hermetic tests.
export function renderProgramBlokslut(h, model, { open, onToggle, onRetry }) {
  const good = model.status === 'ready'
  const gains = good ? model.lifts.filter(row => row.delta > 0) : []
  const strength = gains.length ? gains.map(row => `${row.lift}: +${number(row.delta)} kg beregnet e1RM`).join(' · ')
    : good && model.lifts.some(row => row.delta !== null)
      ? 'Ingen sikker styrkefremgang i de sammenlignelige sæt.'
      : 'Styrkefremgang kan endnu ikke sammenlignes sikkert.'
  return h('details', { 'aria-label': 'Din blok', 'data-program-blokslut': true, open, onToggle,
    style: { marginBottom: 20, padding: 16, border: '1px solid #59564c', color: '#edeae2',
      width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', lineHeight: 1.6 } },
    h('summary', { style: { minHeight: 44, cursor: 'pointer', boxSizing: 'border-box', paddingTop: 8 } }, 'Din blok'),
    good ? h('div', null,
      h('p', null, `${model.start.split('-').reverse().join('.')}–${model.end.split('-').reverse().join('.')}${model.through < model.end ? ' · Sidste uge er i gang.' : ''}`),
      h('p', null, `Gennemførte pas: ${number(model.completed)} af ${number(model.planned)}.`),
      h('p', null, model.confirmed === 0 ? 'Ingen bekræftede træningssæt i blokken endnu.' : strength),
      model.uncertain && h('p', { role: 'status' }, 'Nogle sæt er afventende eller modstridende. Opgørelsen er ufuldstændig.'),
      h('p', null, h('strong', null, 'Ét fokuspunkt: '), model.focus),
      h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer', paddingTop: 8 } }, 'Sådan tælles det'),
        h('p', null, 'Beregnet e1RM er ikke en testet rekord. Bedste tunge sæt i første og seneste blokuge sammenlignes kun i samme rep-område. Varianter, deload og taper indgår ikke. Et pas kræver alle planlagte sæt med gyldige målinger. Manglende logning beviser ikke manglende træning. Programmet ændres ikke.')))
      : h('div', null, h('p', { role: model.status === 'error' ? 'alert' : 'status' }, model.message),
        model.status === 'error' && h('button', { type: 'button', onClick: onRetry,
          style: { minHeight: 44, padding: '8px 16px', cursor: 'pointer' } }, 'Prøv igen')))
}
