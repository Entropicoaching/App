import * as React from 'react'
import { homeStyles as s } from '../home/homeStyles.mjs'
import { useDayRow } from './useDayRow.mjs'

// U7 del 3: søvnkvalitet 1 til 5 og smerte 0 til 10 som tal. Ét tryk gemmer. Vises kun, når
// tracking_daily_v1 findes; uden tabellen returnerer kortet null, og forsiden er som i U6.
const h = React.createElement
const appClient = async () => (await import('../../supabase.js')).supabase
const row = { borderTop: '1px solid #2f2f29', paddingTop: 12, marginTop: 12 }
const label = { ...s.text, margin: '0 0 6px', color: '#edeae2', fontWeight: 600 }
const hint = { ...s.text, fontSize: 14, margin: '6px 0 0' }
const pick = pressed => ({ ...s.secondary, marginTop: 0, minWidth: 0, padding: 0, minHeight: 48,
  ...(pressed ? { background: '#edeae2', color: '#16160f', fontWeight: 700 } : {}) })

export default function DayFeeling({ athleteId, today, client, storage }) {
  const [resolved, setResolved] = React.useState(client ?? null)
  React.useEffect(() => {
    if (client) { setResolved(client); return undefined }
    let active = true
    appClient().then(c => { if (active) setResolved(c) }, () => {})
    return () => { active = false }
  }, [client])
  const day = useDayRow({ enabled: true, client: resolved, athleteId, date: today, storage })
  const [place, setPlace] = React.useState(null)
  const [message, setMessage] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  if (day.status !== 'ready') return null
  const sleep = day.row?.sleep_quality ?? null, pain = day.row?.pain ?? null
  const store = async patch => {
    if (saving) return
    setSaving(true)
    const result = await day.save(patch)
    setSaving(false)
    setMessage(result === 'saved' ? 'Gemt. Din coach kan se tallene.' : 'Det blev ikke gemt. Prøv igen.')
  }
  const placeText = place ?? day.row?.pain_location ?? ''
  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Søvn og smerte', 'data-u7-day-feeling': '' },
    h('p', { style: { ...s.eyebrow, margin: 0 } }, 'Søvn og smerte i dag'),
    h('div', { style: { ...row, borderTop: 0, marginTop: 6, paddingTop: 0 } },
      h('p', { style: label }, 'Søvnkvalitet i nat'),
      h('div', { role: 'group', 'aria-label': 'Søvnkvalitet, 1 dårlig og 5 god',
        style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 } },
      ...[1, 2, 3, 4, 5].map(value => h('button', { key: value, type: 'button', disabled: saving, 'aria-pressed': sleep === value,
        'aria-label': `Søvnkvalitet ${value}`, style: pick(sleep === value), onClick: () => store({ sleep_quality: value }) }, String(value)))),
      h('p', { style: hint }, '1 dårlig, 5 god.')),
    h('div', { style: row },
      h('p', { style: label }, 'Smerte i dag'),
      h('div', { role: 'group', 'aria-label': 'Smerte, 0 ingen og 10 værst',
        style: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6 } },
      ...Array.from({ length: 11 }, (_, value) => h('button', { key: value, type: 'button', disabled: saving, 'aria-pressed': pain === value,
        'aria-label': `Smerte ${value}`, style: pick(pain === value),
        onClick: () => store(value === 0 ? { pain: 0, pain_location: null } : { pain: value }) }, String(value)))),
      h('p', { style: hint }, '0 ingen, 10 værst.'),
      pain > 0 && h('form', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 8 },
        onSubmit: event => { event.preventDefault(); store({ pain_location: placeText }) } },
      h('input', { type: 'text', maxLength: 120, 'aria-label': 'Hvor sidder smerten (valgfrit)', placeholder: 'Hvor? fx venstre knæ',
        value: placeText, disabled: saving, onChange: event => setPlace(event.target.value),
        style: { ...s.secondary, marginTop: 0, boxSizing: 'border-box', padding: 12, background: '#171814', minWidth: 0 } }),
      h('button', { type: 'submit', disabled: saving, style: { ...s.secondary, marginTop: 0, minHeight: 48 } }, 'Gem sted'))),
    message && h('p', { role: message.startsWith('Gemt') ? 'status' : 'alert', style: hint }, message))
}
