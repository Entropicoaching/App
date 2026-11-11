import { planKg } from '../../planKg.mjs'
import { sessionPrescription } from './sessionPrescription.mjs'
import { parsePlannedRest, parseTempo } from './tempo/tempoParser.mjs'
import { sessionGroupsForDisplay } from './supersaet/supersetModel.mjs'
import { weekSessions } from './weekSessions.mjs'

const given = value => value != null && String(value).trim() !== ''
const labels = { completed: 'Registreret', skipped: 'Sprunget over', remaining: 'Tilbage',
  pending: 'Venter på net · ikke bekræftet', parked: 'Kunne ikke synkroniseres · ikke bekræftet',
  waiting: 'Afventer bekræftelse', error: 'Ikke gemt', unknown: 'Status ukendt' }

// Presentation of the controller's confirmed snapshot, never an alternate selector.
// Exercise IDs identify the exact planned slots (including work done on earlier days).
// Explicit foreign scope metadata must not turn history into current progress.
function belongs(row, p, s) {
  return (row.athlete_id == null || row.athlete_id === p.athleteId) &&
    (row.session_id == null || row.session_id === s.session.id) &&
    (row.week_id == null || row.week_id === s.selection.weekId) &&
    (row.program_id == null || row.program_id === p.currentWeek?.program_id) &&
    (row.exercises?.session_id == null || row.exercises.session_id === s.session.id)
}

export function createSessionOverview(doc, { p, s, now, active, returnToLog }) {
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = String(text)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
    return node
  }
  const overview = el('details', null, { class: 'session-overview', 'data-detail': 'overview', 'data-session-overview': '' })
  const title = s.session.title || 'Dagens pas'
  const overviewSummary = el('summary', `Overblik over passet · ${title}`, { 'data-overview-focus': 'overview' })
  overview.append(overviewSummary,
    el('h2', title), el('p', s.next ? `Nu: ${s.next.exercise.name} · Sæt ${s.next.setNumber} af ${s.next.totalSets}`
      : 'Alle planlagte sæt er behandlet.', { class: 'overview-position' }))
  const counts = { completed: 0, skipped: 0, remaining: 0, unconfirmed: 0 }
  let incomplete = false
  const list = el('ol', null, { class: 'overview-exercises', 'aria-label': 'Øvelser i planlagt rækkefølge' })
  const groups = sessionGroupsForDisplay(s.session.exercises)
  for (const [index, ex] of s.session.exercises.entries()) {
    const li = el('li'), detail = `overview-${index}`
    const fold = el('details', null, { 'data-detail': detail })
    const isCurrent = s.next?.exercise.id === ex.id
    const summary = el('summary', `${ex.name || 'Øvelse uden navn'}${isCurrent ? ` · Nu: sæt ${s.next.setNumber} af ${s.next.totalSets}` : ''}`,
      { 'data-overview-focus': detail })
    if (isCurrent && !s.summary) summary.setAttribute('aria-current', 'step')
    const group = groups.groups.find(group => group.kind !== 'single' && group.members.some(member => member.exerciseId === ex.id))
    const count = Number.isSafeInteger(ex.sets) && ex.sets >= 0 ? ex.sets : null
    if (count == null) incomplete = true
    const dosage = count == null ? 'Antal sæt mangler eller kan ikke læses' : count === 0 ? '0 planlagte sæt' : `${count} sæt`
    summary.append(el('span', `${dosage} · ${given(ex.reps) ? `${ex.reps} gentagelser` : 'Gentagelser mangler i planen'}`,
      { class: 'overview-dosage' }))
    fold.append(summary)
    if (group) fold.append(el('p', group.label))
    if (given(ex.recommended_weight)) fold.append(el('p', `Planlagt vægt: ${planKg(ex.recommended_weight)} kg`))
    if (given(ex.intensity)) fold.append(el('p', `Intensitet: ${ex.intensity}`))
    const prescription = sessionPrescription(ex), rest = parsePlannedRest(prescription.restSeconds), tempo = parseTempo(prescription.tempo)
    if (rest.status === 'valid') fold.append(el('p', `Pause: ${rest.label}`))
    else if (rest.status === 'invalid') fold.append(el('p', 'Planlagt pause kan ikke læses'))
    if (tempo.status === 'valid') fold.append(el('p', `Tempo: ${tempo.notation}`))
    if (ex.note) fold.append(el('p', `Fra din coach: ${ex.note}`))
    const slots = el('ol', null, { class: 'overview-sets', 'aria-label': `Sæt i ${ex.name || 'øvelsen'}` })
    const exerciseCounts = { completed: 0, skipped: 0, remaining: 0, unconfirmed: 0 }
    for (let set = 1; count != null && set <= count; set++) {
      const key = `${ex.id}_${set}`, current = s.key === key && !s.summary
      const rows = (p.exerciseLogs || []).filter(row => row.exercise_id === ex.id && row.set_number === set && belongs(row, p, s))
      let status = 'remaining'
      if (p.exerciseLogsLoading || p.exerciseLogsError || !Array.isArray(p.exerciseLogs)) status = 'unknown'
      else if ((p.parkedSets || []).some(row => row.exerciseId === ex.id && row.setNumber === set)) status = 'parked'
      else if ((p.pendingSyncKeys || []).includes(key)) status = 'pending'
      else if (p.setConfirm?.[key] === 'error') status = 'error'
      else if (current && !['idle', 'saved'].includes(s.phase)) status =
        ({ error: 'error', queued: 'pending', parked: 'parked' })[s.phase] || 'waiting'
      else if (rows.some(row => row._optimistic)) status = 'waiting'
      else {
        const confirmed = rows.filter(row => s.logs.includes(row) && !row._optimistic)
        // Reuse the strict owner/week/date/duplicate-slot projection. No history
        // or undated rows are promoted to confirmed work in this workout.
        if (confirmed.length) {
          const projection = weekSessions({ week: p.currentWeek, exerciseLogs: confirmed,
            athleteId: p.athleteId, now, pendingSyncKeys: p.pendingSyncKeys, parkedSets: p.parkedSets })
            .sessions.find(session => session.sessionId === s.session.id)
          status = projection?.dataMissing ? 'unknown' : projection?.skipped === 1 ? 'skipped'
            : projection?.confirmed === 1 ? 'completed' : 'remaining'
        }
      }
      const bucket = ['completed', 'skipped', 'remaining'].includes(status) ? status : 'unconfirmed'
      counts[bucket]++; exerciseCounts[bucket]++
      const attrs = { 'data-overview-status': status }
      if (current) attrs['data-overview-current'] = ''
      slots.append(el('li', `Sæt ${set}: ${labels[status]}${current ? ' · Nu' : ''}`, attrs))
    }
    // Compact progress stays visible even while the prescription is folded.
    const progress = el('p', `${exerciseCounts.completed} registreret · ${exerciseCounts.skipped} sprunget over · ${exerciseCounts.remaining} tilbage` +
      (exerciseCounts.unconfirmed ? ` · ${exerciseCounts.unconfirmed} ikke bekræftet` : ''), { class: 'overview-progress' })
    fold.append(slots); li.append(fold, progress); list.append(li)
  }
  const countText = `${counts.completed} registreret · ${counts.skipped} sprunget over · ${counts.remaining} tilbage` +
    (counts.unconfirmed ? ` · ${counts.unconfirmed} ikke bekræftet` : '') + (incomplete ? ' · Planen er ufuldstændig' : '')
  overviewSummary.append(el('span', countText, { class: 'overview-dosage' }))
  overview.append(el('p', countText, { 'data-overview-counts': '' }), list)
  const back = el('button', 'Tilbage til dit sæt', { type: 'button', 'data-overview-focus': 'return' })
  back.addEventListener('click', () => {
    if (!active()) return
    overview.open = false
    returnToLog()
  })
  overview.append(back)
  return overview
}
