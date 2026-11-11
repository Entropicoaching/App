import { createElement as h } from 'react'
import { antalOrd } from '../antalOrd.mjs'
import { buildProgramOverblik } from '../../programOverblik.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { hasUndatedPlannedWeek } from './coachModel.mjs'

// U11 (Marc 11. nov.): "en nem oversigt så jeg hurtig kan klikke ind og se atlet x program".
// Kun den allerede afgrænsede forsidekontekst. Ingen læsninger, ingen skrivninger.
const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civil = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(ordinal(value)) ? value : null

const label = (week, block) => block ? `${block} · ${week}` : week[0].toUpperCase() + week.slice(1)
const weekLabel = w => {
  const n = Number(w.week_number)
  const block = typeof w.block_name === 'string' && w.block_name.trim() ? w.block_name.trim() : null
  return label(Number.isSafeInteger(n) && n > 0 ? `uge ${n}` : 'uge', block)
}

function programLine(weeks, day) {
  const withExercises = weeks.filter(w => w && Number(w.exercise_count) > 0)
  const planned = withExercises.filter(w => civil(w.start_date)).sort((a, b) => a.start_date.localeCompare(b.start_date))
  // Kontrolfund 4: uger uden gyldig dato er stadig et program; sig det i stedet for "Intet program".
  if (!planned.length) return withExercises.length ? `${weekLabel(withExercises[0])} · uden dato` : 'Intet program'
  const started = planned.filter(w => w.start_date <= day)
  if (!started.length) {
    const n = ordinal(planned[0].start_date) - ordinal(day)
    return `${weekLabel(planned[0])} · starter om ${n} ${antalOrd(n, 'dag', 'dage')}`
  }
  return weekLabel(started.at(-1))
}

// Kontrolfund 2: fravær vises kun, når logvinduet er komplet; en ugyldig logtid gør atletens seneste pas ukendt.
function lastSessionLine(rows, id, day, complete) {
  const mine = rows.filter(r => r?.athlete_id === id && r.skipped !== true)
  const days = mine.map(r => typeof r.logged_at === 'string' ? activityDay(r.logged_at) : null)
  if (days.some(d => !d)) return null
  const last = days.filter(d => d <= day).sort().at(-1)
  if (!last) return complete ? 'Intet pas logget' : null
  const n = ordinal(day) - ordinal(last)
  return n === 0 ? 'Seneste pas i dag' : n === 1 ? 'Seneste pas i går' : `Seneste pas for ${n} ${antalOrd(n, 'dag', 'dage')} siden`
}

export function athleteOverviewModel(context = {}) {
  const { day, athletes = [], plans = {}, calendarReady, logs, actions = [], complete } = context
  if (!civil(day)) return []
  // Mærket viser grunden fra Kræver dit blik (første grund), ikke bare at der er en grund.
  const attention = new Map(actions.map(row => [row?.athlete?.id,
    typeof row?.reason === 'string' && row.reason.trim() ? row.reason.trim() : 'Kræver dit blik']))
  const ending = new Map(calendarReady ? buildProgramOverblik({ athletes, calendarWeeks: plans, today: day })
    .filter(entry => !hasUndatedPlannedWeek(plans[entry.athlete.id] || []))
    .map(entry => [entry.athlete.id, entry]) : [])
  return athletes.map(athlete => {
    const entry = ending.get(athlete.id)
    // Kontrolfund 3 og 5: "Rolig" kun på fuldt grundlag og med sikker slutdato; "Slutter snart" som Kræver dit blik (< 7).
    const calm = complete === true && calendarReady && !hasUndatedPlannedWeek(plans[athlete.id] || [])
    const badge = attention.has(athlete.id) ? { tone: 'gold', text: attention.get(athlete.id) }
      : entry?.daysLeft != null && entry.daysLeft < 0 ? { tone: 'warn', text: 'Program udløbet' }
        : entry?.daysLeft != null && entry.daysLeft < 7 ? { tone: 'warn', text: 'Slutter snart' }
          : calm ? { tone: 'calm', text: 'Rolig' } : null
    return { athlete, badge,
      program: calendarReady ? programLine(Array.isArray(plans[athlete.id]) ? plans[athlete.id] : [], day) : null,
      lastSession: logs?.usable ? lastSessionLine(logs.rows || [], athlete.id, day, logs.complete === true) : null }
  }).sort((a, b) => a.athlete.name.localeCompare(b.athlete.name, 'da') || a.athlete.id.localeCompare(b.athlete.id))
}

const tones = { gold: { color: '#141410', background: '#d8b16b' }, warn: { color: '#f1cf7b', background: '#2a2416' },
  calm: { color: '#b9b4a8', background: '#24241f' } }

export default function AthleteOverview({ context, openProfile }) {
  const rows = athleteOverviewModel(context)
  if (!rows.length) return null
  const canOpen = typeof openProfile === 'function'
  return h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, ...rows.map(row =>
    h('li', { key: row.athlete.id }, h('button', {
      type: 'button', disabled: !canOpen, 'data-u11-atlet': row.athlete.id,
      'aria-label': `Åbn programmet for ${row.athlete.name}`,
      onClick: canOpen ? () => openProfile(row.athlete, 'program', 'list') : undefined,
      style: { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 56, margin: '0 0 6px', padding: '10px 14px',
        font: 'inherit', color: '#edeae2', background: '#1c1c18', border: '1px solid #414139', borderRadius: 12,
        textAlign: 'left', cursor: canOpen ? 'pointer' : 'default' } },
      h('span', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
        h('strong', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.athlete.name),
        row.badge && h('span', { 'data-u11-maerke': row.badge.tone, style: { ...tones[row.badge.tone], flex: '0 1 auto', maxWidth: '60%', fontSize: 13,
          padding: '2px 10px', borderRadius: 999, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.badge.text)),
      (row.program || row.lastSession) && h('span', { style: { display: 'block', marginTop: 2, color: '#b9b4a8', fontSize: 15,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
      [row.program, row.lastSession].filter(Boolean).join(' · '))))))
}
