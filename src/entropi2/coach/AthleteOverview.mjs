import { createElement as h } from 'react'
import { antalOrd } from '../antalOrd.mjs'
import { buildProgramOverblik } from '../../programOverblik.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { hasUndatedPlannedWeek } from './coachModel.mjs'
import { erKostKlient } from './kostKlienter.mjs'

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
  // Ordre 1544 (Marc 16. nov.: ingen gentagelser): grunden står allerede i Kræver dit blik lige over listen.
  // Mærket siger kun, at atleten står dér, så samme tekst og tal ikke står to gange på forsiden.
  const attention = new Set(actions.map(row => row?.athlete?.id))
  const ending = new Map(calendarReady ? buildProgramOverblik({ athletes, calendarWeeks: plans, today: day })
    .filter(entry => !hasUndatedPlannedWeek(plans[entry.athlete.id] || []))
    .map(entry => [entry.athlete.id, entry]) : [])
  return athletes.map(athlete => {
    const entry = ending.get(athlete.id)
    // Kontrolfund 3 og 5: "Rolig" kun på fuldt grundlag og med sikker slutdato; "Slutter snart" som Kræver dit blik (< 7).
    const calm = complete === true && calendarReady && !hasUndatedPlannedWeek(plans[athlete.id] || [])
    // Ordre 1707 (Marc 18. nov.: "coach siden er lidt rodet"): atleten står allerede i Kræver dit blik lige over;
    // et mærke med samme ord gentog afsnittets overskrift på hver række, så den række har intet mærke.
    const badge = attention.has(athlete.id) ? null
      : entry?.daysLeft != null && entry.daysLeft < 0 ? { tone: 'warn', text: 'Program udløbet' }
        : entry?.daysLeft != null && entry.daysLeft < 7 ? { tone: 'warn', text: 'Slutter snart' }
          : calm ? { tone: 'calm', text: 'Rolig' } : null
    return { athlete, badge,
      // Ordre 2103: en kostklient har kostpakke og intet program; det er ikke en mangel.
      program: calendarReady ? (erKostKlient(athlete, plans[athlete.id]) ? 'Kostklient' : programLine(Array.isArray(plans[athlete.id]) ? plans[athlete.id] : [], day)) : null,
      lastSession: logs?.usable && !erKostKlient(athlete, plans[athlete.id]) ? lastSessionLine(logs.rows || [], athlete.id, day, logs.complete === true) : null }
  }).sort((a, b) => a.athlete.name.localeCompare(b.athlete.name, 'da') || a.athlete.id.localeCompare(b.athlete.id))
}

const tones = { gold: { color: '#141410', background: '#d8b16b' }, warn: { color: '#f1cf7b', background: '#2a2416' },
  calm: { color: '#b9b4a8', background: '#24241f' } }

// Ordre 1692: søgningen fra Atletkort står nu over listen, når holdet har mere end seks atleter.
export const SEARCH_FROM = 7
export default function AthleteOverview({ context, openProfile, details, query = '', onQueryChange }) {
  const all = athleteOverviewModel(context)
  if (!all.length) return null
  const needle = query.trim().toLocaleLowerCase('da')
  const rows = all.filter(row => row.athlete.name.toLocaleLowerCase('da').includes(needle))
  const canOpen = typeof openProfile === 'function'
  const flere = athlete => {
    const children = typeof details === 'function' ? details(athlete)?.filter(Boolean) : null
    return children?.length ? h('details', { 'data-u11-flere': athlete.id, style: { margin: '0 0 10px', paddingInline: 4 } },
      h('summary', { style: { cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', color: '#b9b4a8' } },
        h('span', { 'aria-hidden': true, style: { marginRight: 10, color: '#d8b16b' } }, '▸'), 'Flere tal'),
      ...children) : null
  }
  const list = h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, ...rows.map(row =>
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
      [row.program, row.lastSession].filter(Boolean).join(' · '))),
    // Ordre 1692: atletens øvrige oplysninger i én lukket fold under rækken, uden at navnet gentages.
    flere(row.athlete))))
  if (all.length < SEARCH_FROM) return list
  const field = { font: 'inherit', color: '#edeae2', background: '#1c1c18', border: '1px solid #77776b', borderRadius: 8, minHeight: 44 }
  return h('div', null,
    h('label', { style: { display: 'block' } }, 'Søg efter atletnavn',
      h('input', { type: 'search', value: query, onChange: event => onQueryChange?.(event.target.value),
        style: { ...field, display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 8, padding: '0 12px' } })),
    needle && h('button', { type: 'button', style: { ...field, marginTop: 8, padding: '0 14px' }, onClick: () => onQueryChange?.('') }, 'Nulstil søgning'),
    h('p', { 'aria-live': 'polite' }, `${rows.length} af ${all.length}`),
    rows.length === 0 && h('p', null, 'Ingen match på atletnavnet.'),
    list)
}
