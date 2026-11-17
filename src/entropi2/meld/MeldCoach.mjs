import { createElement as h, useState } from 'react'
import { homeStyles as s } from '../home/homeStyles.mjs'
import { MELDINGER, sendMelding } from './meldModel.mjs'

// Ordre 1611: "Jeg er syg" og "Jeg er skadet" under Mere i dag. Eet tryk vaelger, eet tryk sender.
const appClient = async () => (await import('../../supabase.js')).supabase
const hint = { ...s.text, fontSize: 14, margin: '6px 0 0' }
const knap = { ...s.secondary, marginTop: 0, minWidth: 0, minHeight: 48 }

export default function MeldCoach({ athleteId, client }) {
  const [valgt, setValgt] = useState(null)
  const [status, setStatus] = useState('')
  const [sender, setSender] = useState(false)
  const send = async () => {
    if (sender || !valgt) return
    setSender(true)
    const resultat = await sendMelding(client ?? await appClient().catch(() => null), athleteId, valgt)
    setSender(false)
    setValgt(null)
    setStatus(resultat === 'sendt' ? 'Sendt. Din coach får besked.' : 'Det blev ikke sendt. Prøv igen.')
  }
  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Meld til din coach', 'data-meld-coach': '' },
    h('p', { style: { ...s.eyebrow, margin: 0 } }, 'Meld til din coach'),
    !valgt && h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 } },
      ...Object.entries(MELDINGER).map(([slags, m]) => h('button', { key: slags, type: 'button', style: knap,
        onClick: () => { setStatus(''); setValgt(slags) } }, m.knap))),
    valgt && h('div', { style: { marginTop: 8 } },
      h('p', { style: { ...s.text, margin: '0 0 8px' } }, MELDINGER[valgt].spoerg),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 } },
        h('button', { type: 'button', disabled: sender, style: { ...knap, background: '#edeae2', color: '#16160f', fontWeight: 700 },
          'data-meld-send': '', onClick: send }, 'Send'),
        h('button', { type: 'button', disabled: sender, style: knap, onClick: () => setValgt(null) }, 'Fortryd'))),
    status && h('p', { role: status.startsWith('Sendt') ? 'status' : 'alert', style: hint }, status))
}
