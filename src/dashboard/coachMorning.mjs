import { createElement as h, useEffect, useState } from 'react'

import { COACH_MORNING_ENABLED, coachMorningFlag, morningDay, yesterday, readMorningSource } from './coachMorningSource.mjs'
export { COACH_MORNING_ENABLED, coachMorningFlag, morningDay, yesterday, readMorningSource } from './coachMorningSource.mjs'
export function morningRows({ athletes = [], data = {}, now = new Date(), loading = false, loadError = false } = {}) {
  const day = morningDay(now), prior = yesterday(now)
  const unique = new Map(athletes.filter(a => a?.id).map(a => [a.id, a]))
  const collect = (key, select) => {
    const source = data?.[key]
    const rows = Array.isArray(source?.rows) ? source.rows : []
    const inScope = source?.ids == null || [...unique.keys()].every(id => source.ids.includes(id))
    let complete = !loading && !loadError && day && source?.state === 'ready' && source.day === day && inScope
    const found = new Set()
    for (const row of rows) {
      if (!row || !unique.has(row.athlete_id)) continue
      if (!morningDay(row[key === 'logs' ? 'logged_at' : 'created_at'])) complete = false
    }
    select(rows, found, unique, () => { complete = false })
    return { key, count: found.size, complete: Boolean(complete), athletes: [...unique.values()].filter(a => found.has(a.id)) }
  }
  const logs = collect('logs', (rows, found, scope) => {
    for (const row of rows) if (scope.has(row?.athlete_id) && row.skipped !== true && morningDay(row.logged_at) === prior) found.add(row.athlete_id)
  })
  const messages = collect('messages', (rows, found, scope, uncertain) => {
    const latest = new Map(), ambiguous = new Set()
    for (const row of rows) {
      if (!scope.has(row?.athlete_id) || !morningDay(row.created_at)) continue
      const key = `${row.athlete_id}:${row.category === 'teknik' ? 'teknik' : 'besked'}`
      const prev = latest.get(key)
      if (!prev || Date.parse(row.created_at) > Date.parse(prev.created_at)) { latest.set(key, row); ambiguous.delete(key) }
      else if (Date.parse(row.created_at) === Date.parse(prev.created_at) && row.sender_role !== prev.sender_role) ambiguous.add(key)
    }
    for (const [key, row] of latest) {
      if (ambiguous.has(key)) { uncertain(); continue }
      if (!['athlete', 'coach'].includes(row.sender_role)) uncertain()
      if (row.sender_role === 'athlete') found.add(row.athlete_id)
    }
  })
  // Athlete links are unique. Each draft ID is counted once within its athlete.
  const draftIds = new Set()
  const videos = collect('videos', (rows, found, scope, uncertain) => {
    for (const row of rows) {
      if (!scope.has(row?.athlete_id)) continue
      if (!row.id || !row.status) uncertain()
      if (row.id && row.status === 'draft') { found.add(row.athlete_id); draftIds.add(`${row.athlete_id}:${row.id}`) }
    }
  })
  videos.videoCount = draftIds.size
  return { day, yesterday: prior, rows: [logs, messages, videos] }
}
const style = { minHeight: 44, padding: '0.6rem', color: '#edeae2', background: '#1c1c18', border: '1px solid #59564c', cursor: 'pointer', font: 'inherit' }
export function CoachMorning({ enabled = COACH_MORNING_ENABLED, data, athletes, loading, loadError, openProfile, setView, setSelectedAthlete }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (enabled !== true) return
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [enabled])
  if (enabled !== true) return null
  const model = morningRows({ data, athletes, loading, loadError, now })
  const labels = [`atleter trænede i går (${model.yesterday})`, 'atleter venter på svar', `videoer venter hos ${model.rows[2].complete ? '' : 'mindst '}${model.rows[2].count} atleter`]
  const tabs = ['log', 'beskeder', 'analyse']
  return h('section', { 'aria-label': 'Coachens morgenoverblik', style: { marginBottom: '1rem' } },
    ...model.rows.map((row, index) => {
      const count = row.videoCount ?? row.count
      return h('details', { key: row.key },
      h('summary', { style }, `${row.complete ? count : count ? `Mindst ${count}` : 'Ukendt antal'} ${labels[index]}`),
      !row.complete && h('p', { role: 'status' }, 'Grundlaget er ufuldstændigt eller skal opdateres. Genindlæs for friske tal.'),
      ...row.athletes.map(athlete => h('button', { key: athlete.id, type: 'button', style,
        onClick: () => openProfile(athlete, tabs[index], 'list') }, athlete.name)),
      h('button', { type: 'button', style, onClick: () => { setSelectedAthlete(null); setView(index === 0 ? 'calendar' : 'inbox') } }, index === 0 ? 'Åbn kalender' : 'Åbn arbejdsindbakke')) }))
}
