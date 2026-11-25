// ORDRE 2367v (Marc 25. nov., ugeplanens målstreg 3: "Send som atlet og som coach virker hver gang"):
// lukkes appen, mens et klip sendes, når ingen kode at vise fejlen. AthleteView sætter derfor et
// toast-varsel ved næste åbning (G16, ordre 131), men Entropi 2's Hjem tegner ikke toast-pladsen,
// så varslet var usynligt, og klippet gik tabt i stilhed. Her står varslet på Hjem, til klippet er
// sendt igen (kø'en tømmes ved næste bekræftede videorække) eller atleten lukker det.
import { createElement as h, useState } from 'react'
import { homeStyles as s } from './homeStyles.mjs'
import { pendingSilentFails } from '../../athleteSilentFailLog.js'

const KODE = 'silent:video-upload-interrupted'
const LUK_PREFIX = 'entropi_afbrudt_video_lukket'
export const AFBRUDT_VIDEO_TEKST = 'Din seneste video blev muligvis afbrudt, mens den blev sendt. Åbn VideoCoach og send den igen for at være sikker.'

// Den seneste afbrudte videoupload, som atleten ikke har lukket. null betyder, at intet skal vises.
export function afbrudtVideo(athleteId, storage = globalThis.localStorage, now = Date.now()) {
  if (!athleteId) return null
  const entry = pendingSilentFails(athleteId, storage, now).filter(e => e.code === KODE).pop() || null
  if (!entry) return null
  let lukket = null
  try { lukket = storage?.getItem(`${LUK_PREFIX}:${athleteId}`) ?? null } catch { lukket = null }
  return lukket === entry.at ? null : entry
}

// Luk gælder kun netop denne afbrydelse; en ny afbrydelse vises igen.
export function lukAfbrudtVideo(athleteId, entry, storage = globalThis.localStorage) {
  try { if (athleteId && typeof entry?.at === 'string') storage?.setItem(`${LUK_PREFIX}:${athleteId}`, entry.at) }
  catch { /* fuld eller utilgængelig storage må ikke vælte Hjem */ }
}

export default function AfbrudtVideo({ athleteId, storage }) {
  const [, setLukket] = useState(0)
  const entry = afbrudtVideo(athleteId, storage)
  if (!entry) return null
  return h('div', { style: { maxWidth: 480, margin: '0 auto', paddingTop: 20 } },
    h('section', { role: 'alert', 'data-afbrudt-video': '', style: { ...s.card, borderColor: '#e05555', marginBottom: 0 } },
      h('p', { style: s.eyebrow }, 'Video til din coach'),
      h('p', { style: { ...s.text, margin: 0 } }, AFBRUDT_VIDEO_TEKST),
      h('button', { type: 'button', style: s.secondary, onClick: () => { lukAfbrudtVideo(athleteId, entry, storage); setLukket(n => n + 1) } }, 'Luk')))
}
