import { createElement as h } from 'react'
import { antalOrd } from '../antalOrd.mjs'
import { buildProgramOverblik } from '../../programOverblik.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { hasUndatedPlannedWeek } from './coachModel.mjs'

// U11 (Marc 11. nov.): "en nem oversigt så jeg hurtig kan klikke ind og se atlet x program".
// Kun den allerede afgrænsede forsidekontekst. Ingen læsninger, ingen skrivninger.
const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civil = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(ordinal(value)) ? value : null

function programLine(weeks, day) {
  const planned = weeks.filter(w => w && Number(w.exercise_count) > 0 && civil(w.start_date))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  if (!planned.length) return 'Intet program'
  const started = planned.filter(w => w.start_date <= day)
  const current = started.at(-1) ?? planned[0]
  const n = Number(current.week_number)
  const week = Number.isSafeInteger(n) && n > 0 ? `uge ${n}` : 'uge'
  const block = typeof current.block_name === 'string' && current.block_name.trim() ? current.block_name.trim() : null
  return block ? `${block} · ${week}` : week[0].toUpperCase() + week.slice(1)
}

function lastSessionLine(rows, id, day) {
  const days = rows.filter(r => r?.athlete_id === id && r.skipped !== true)
    .map(r => typeof r.logged_at === 'string' ? activityDay(r.logged_at) : null)
    .filter(d => d && d <= day).sort()
  const last = days.at(-1)
  if (!last) return 'Intet pas logget'
  const n = ordinal(day) - ordinal(last)
  return n === 0 ? 'Seneste pas i dag' : n === 1 ? 'Seneste pas i går' : `Seneste pas for ${n} ${antalOrd(n, 'dag', 'dage')} siden`
}

export function athleteOverviewModel(context = {}) {
  const { day, athletes = [], plans = {}, calendarReady, logs, actions = [] } = context
  if (!civil(day)) return []
  // Mærket viser grunden fra Kræver dit blik (første grund), ikke bare at der er en grund.
  const attention = new Map(actions.map(row => [row?.athlete?.id,
    typeof row?.reason === 'string' && row.reason.trim() ? row.reason.trim() : 'Kræver dit blik']))
  const ending = new Map(calendarReady ? buildProgramOverblik({ athletes, calendarWeeks: plans, today: day })
    .filter(entry => !hasUndatedPlannedWeek(plans[entry.athlete.id] || []))
    .map(entry => [entry.athlete.id, entry]) : [])
  return athletes.map(athlete => {
    const entry = ending.get(athlete.id)
    const badge = attention.has(athlete.id) ? { tone: 'gold', text: attention.get(athlete.id) }
      : entry?.daysLeft != null && entry.daysLeft < 0 ? { tone: 'warn', text: 'Program udløbet' }
        : entry?.daysLeft != null && entry.daysLeft <= 7 ? { tone: 'warn', text: 'Slutter snart' }
          : { tone: 'calm', text: 'Rolig' }
    return { athlete, badge,
      program: calendarReady ? programLine(Array.isArray(plans[athlete.id]) ? plans[athlete.id] : [], day) : null,
      lastSession: logs?.usable ? lastSessionLine(logs.rows || [], athlete.id, day) : null }
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
        h('span', { 'data-u11-maerke': row.badge.tone, style: { ...tones[row.badge.tone], flex: '0 1 auto', maxWidth: '60%', fontSize: 13,
          padding: '2px 10px', borderRadius: 999, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.badge.text)),
      (row.program || row.lastSession) && h('span', { style: { display: 'block', marginTop: 2, color: '#b9b4a8', fontSize: 15,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
      [row.program, row.lastSession].filter(Boolean).join(' · '))))))
}
