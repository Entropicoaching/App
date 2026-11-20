// ORDRE 1953: coachen lægger en ugevideo til atleten i Samtale og ser, om den er set.
// Tryk fra telefonen: "Vælg video" (optag eller vælg), "Læg ugevideo". Ugen er forvalgt.
import { createElement as h, useEffect, useState } from 'react'
import { homeStyles as s } from '../entropi2/home/homeStyles.mjs'
import { laegUgevideo, hentCoachUgevideoer, ugeValg, ugeTekst, setTekst } from './ugevideo.mjs'
import { calendarDay } from '../calendarDate.js'

// Fredag til søndag handler videoen oftest om næste uge.
export function forvalgtUge(day = calendarDay()) {
  const ugedag = new Date(`${day}T12:00:00Z`).getUTCDay()
  return ugedag === 0 || ugedag >= 5 ? 'naeste' : 'denne'
}

export default function CoachUgevideo({ client, athlete, day, laeg = laegUgevideo, hent = hentCoachUgevideoer }) {
  const idag = day || calendarDay()
  const valg = ugeValg(idag)
  const athleteId = athlete?.id
  const [uge, setUge] = useState(() => forvalgtUge(idag))
  const [fil, setFil] = useState(null)
  const [status, setStatus] = useState({ kind: 'idle' })
  const [videoer, setVideoer] = useState([])
  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    if (!athleteId) return
    let aktiv = true
    Promise.resolve(hent({ client, athleteId })).then(r => { if (aktiv) setVideoer(r?.videoer || []) }, () => {})
    return () => { aktiv = false }
  }, [client, athleteId, hent])

  if (!athleteId) return null
  const valgt = valg.find(v => v.key === uge) || valg[0]
  const laegger = status.kind === 'busy'
  const send = async () => {
    if (!fil || laegger) return
    setStatus({ kind: 'busy' })
    const r = await laeg({ client, athleteId, weekStart: valgt.weekStart, file: fil })
    if (r?.error) { setStatus({ kind: 'error', text: r.error }); return }
    setVideoer(prev => [r.video, ...prev.filter(v => v.id !== r.video.id)].slice(0, 4))
    setFil(null); setInputKey(k => k + 1)
    setStatus({ kind: 'done', text: 'Ugevideoen er lagt. Atleten ser den øverst på Hjem.' })
  }

  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Ugevideo', 'data-ugevideo-coach': '' },
    h('h2', { style: { ...s.text, color: '#edeae2', fontWeight: 600, margin: '0 0 4px' } }, 'Ugevideo til atleten'),
    h('p', { style: { ...s.text, fontSize: 14, margin: '0 0 12px' } }, 'Forklar, hvordan ugen gik, og hvad der kommer. Kun atleten og du kan se den.'),
    h('div', { role: 'radiogroup', 'aria-label': 'Hvilken uge', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } },
      valg.map(v => h('button', { key: v.key, type: 'button', role: 'radio', 'aria-checked': v.key === uge,
        style: { ...s.secondary, marginTop: 0, borderColor: v.key === uge ? '#c8923a' : '#414139' }, onClick: () => setUge(v.key) },
      `${v.label} (${ugeTekst(v.weekStart).replace('Ugen fra ', '')})`))),
    h('label', { style: { ...s.secondary, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', cursor: 'pointer' } },
      h('span', null, fil ? `Valgt: ${fil.name || 'video'}` : 'Vælg video'),
      h('input', { key: inputKey, type: 'file', accept: 'video/*', 'aria-label': 'Vælg video',
        style: { position: 'absolute', width: 1, height: 1, opacity: 0 },
        onChange: e => { setFil(e.target.files?.[0] || null); setStatus({ kind: 'idle' }) } })),
    h('button', { type: 'button', style: { ...s.primary, opacity: !fil || laegger ? 0.5 : 1 }, disabled: !fil || laegger, onClick: send }, laegger ? 'Lægger videoen op …' : 'Læg ugevideo'),
    status.text && h('p', { role: status.kind === 'error' ? 'alert' : 'status', style: { ...s.text, fontSize: 14, color: status.kind === 'error' ? '#e08a6d' : '#b8b4a8' } }, status.text),
    videoer.length > 0 && h('ul', { 'aria-label': 'Lagte ugevideoer', style: { listStyle: 'none', padding: 0, margin: '12px 0 0' } },
      videoer.map(v => h('li', { key: v.id, 'data-ugevideo-set': v.athlete_seen_at ? 'ja' : 'nej', style: { ...s.text, fontSize: 14, padding: '4px 0' } },
        `${ugeTekst(v.week_start)}: ${setTekst(v.athlete_seen_at)}`))))
}
