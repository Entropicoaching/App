// ORDRE 1953: atleten ser coachens ugevideo øverst på Hjem med ét tryk. Uden video vises intet.
import { createElement as h, useEffect, useState } from 'react'
import { homeStyles as s } from '../entropi2/home/homeStyles.mjs'
import { hentAtletUgevideo, ugevideoAdresse, markerUgevideoSet, ugeTekst } from './ugevideo.mjs'

export default function AtletUgevideo({ client, athleteId, day, hent = hentAtletUgevideo, adresse = ugevideoAdresse, markerSet = markerUgevideoSet }) {
  const [video, setVideo] = useState(null)
  const [url, setUrl] = useState(null)
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!client || !athleteId) return
    let aktiv = true
    Promise.resolve(hent({ client, athleteId, ...(day ? { day } : {}) })).then(v => { if (aktiv) setVideo(v || null) }, () => {})
    return () => { aktiv = false }
  }, [client, athleteId, day, hent])

  if (!video) return null
  const aabn = async () => {
    if (status === 'busy') return
    setStatus('busy')
    const u = await Promise.resolve(adresse({ client, videoPath: video.video_path })).catch(() => null)
    if (!u) { setStatus('error'); return }
    setUrl(u); setStatus('idle')
    const seenAt = await Promise.resolve(markerSet({ client, video })).catch(() => null)
    if (seenAt) setVideo(v => (v ? { ...v, athlete_seen_at: seenAt } : v))
  }

  return h('section', { style: { ...s.card, borderColor: '#c8923a' }, 'aria-label': 'Ugevideo fra din coach', 'data-ugevideo-atlet': '' },
    h('p', { style: s.eyebrow }, 'Fra din coach'),
    h('h2', { style: { ...s.heading, fontSize: 24, margin: '8px 0 4px' } }, 'Ugevideo'),
    h('p', { style: { ...s.text, margin: 0 } }, ugeTekst(video.week_start)),
    video.note && h('p', { style: { ...s.text, margin: '8px 0 0' } }, video.note),
    url
      ? h('video', { src: url, controls: true, autoPlay: true, playsInline: true, preload: 'metadata', 'aria-label': 'Ugevideo',
        style: { display: 'block', width: '100%', maxHeight: '70vh', marginTop: 16, borderRadius: 8, background: '#000' } })
      : h('button', { type: 'button', style: s.primary, disabled: status === 'busy', onClick: aabn },
        status === 'busy' ? 'Henter videoen …' : 'Se ugevideo'),
    status === 'error' && h('p', { role: 'alert', style: { ...s.text, fontSize: 14, color: '#e08a6d' } }, 'Videoen kunne ikke hentes. Prøv igen.'))
}
