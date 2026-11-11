import { createElement as h, useEffect, useState } from 'react'
import { coachRadarEnabled } from './flag.mjs'
import { coachRadarModel, radarScope } from './model.mjs'
import { loadRadarSnapshot, scopeKey } from './read.mjs'

export { coachRadarEnabled } from './flag.mjs'
const control = { minHeight: 48, padding: 12, font: 'inherit', color: '#edeae2',
  background: '#1c1c18', border: '1px solid #59564c', borderRadius: 12,
  textAlign: 'left', overflowWrap: 'anywhere', cursor: 'pointer', boxSizing: 'border-box' }

export default function CoachRadar(input = {}) {
  if (!coachRadarEnabled(input.enabled)) return null
  return h(LiveRadar, input)
}
function LiveRadar({ source, context }) {
  const scope = radarScope(source, context), key = scopeKey(scope)
  const anchor = source.readContext, client = source.notesClient
  const [read, setRead] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!key || !client) return undefined
    let current = true
    setRead({ key, anchor, client, state: 'loading' })
    const [coachId, day, athleteIds] = JSON.parse(key)
    loadRadarSnapshot({ enabled: true, scope: { coachId, day, athleteIds }, client }).then(snapshot => {
      if (current) setRead({ key, anchor, client, snapshot })
    })
    return () => { current = false }
  }, [key, anchor, client, attempt])
  const current = read?.key === key && read.anchor === anchor && read.client === client
  const model = coachRadarModel({ enabled: true, source, context, snapshot: current ? read.snapshot : null })
  const loading = Boolean(key && client && (!current || read.state === 'loading'))
  return h(CoachRadarView, { enabled: true, model, loading, openProfile: source.openProfile,
    onRefresh: client && key ? () => { setRead(null); setAttempt(n => n + 1) } : source.reloadOverview })
}

export function CoachRadarView(input = {}) {
  if (input.enabled !== true || !input.model) return null
  const { model, loading = false, openProfile, onRefresh } = input
  const canOpen = typeof openProfile === 'function'
  const row = entry => h('li', { key: entry.athlete.id, style: { marginBlock: 10, minWidth: 0 } },
    h('button', { type: 'button', disabled: !canOpen, 'data-coach-radar-athlete': entry.athlete.id,
      style: { ...control, display: 'block', width: '100%' },
      onClick: canOpen ? () => openProfile(entry.athlete, 'hub', 'list') : undefined },
      h('strong', { style: { display: 'block' } }, entry.athlete.name),
      h('span', { style: { display: 'block', marginTop: 4 } }, entry.reason)),
    h('details', null,
      h('summary', { style: { minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' } },
        `Grundlag for ${entry.score} point`),
      h('ul', { style: { paddingLeft: 20 } }, ...entry.signals.map(signal =>
        h('li', { key: signal.key }, `${signal.reason}: ${signal.points} point. ${signal.basis}`)))))
  return h('section', { 'aria-label': 'Coachens radar', 'data-coach-radar': true,
    style: { border: '1px solid #c8923a', borderRadius: 16, padding: 16, marginBlock: 20, minWidth: 0 } },
    h('h2', { style: { marginTop: 0 } }, 'Hvem har brug for dig i dag?'),
    h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Atleter med signaler, du kan følge op på. Flest point står først.')),
    (loading || model.state === 'loading') ? h('p', { role: 'status' }, 'Henter radarens data…') :
      model.state === 'unavailable' ? h('p', { role: 'status' }, 'Opdater overblikket for at se radaren.') :
        model.state === 'partial' && h('p', { role: 'status' }, 'Nogle data mangler. Kun kendte signaler tæller med.'),
    !canOpen && model.rows.length > 0 && h('p', { role: 'status' }, 'Atletvisningen kan ikke åbnes lige nu.'),
    model.rows.length > 0 && h('p', null, `${model.rows.length} ${model.rows.length === 1 ? 'atlet' : 'atleter'} med signaler`),
    h('ol', { style: { listStyle: 'none', padding: 0, margin: 0 } }, ...model.rows.slice(0, 5).map(row)),
    model.rows.length > 5 && h('details', { 'data-coach-radar-more': true },
      h('summary', { style: { minHeight: 48, display: 'flex', alignItems: 'center', cursor: 'pointer' } }, `Vis alle ${model.rows.length} atleter`),
      h('ol', { start: 6, style: { listStyle: 'none', padding: 0, margin: 0 } }, ...model.rows.slice(5).map(row))),
    !loading && model.state === 'ready' && model.rows.length === 0 &&
      h('p', null, 'Ingen af radarens signaler er fundet i de indlæste data.'),
    typeof onRefresh === 'function' && h('button', {
      type: 'button', style: control, disabled: loading || model.state === 'loading', onClick: onRefresh }, 'Opdater radar'))
}
