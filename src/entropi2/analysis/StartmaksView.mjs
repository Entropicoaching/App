// Ordre 1713: startmaks, coachen har skrevet på atleten (athletes.squat, bench, deadlift).
// Ingen læsning: AthleteView sender allerede atletens egen række. Intet uden et løft over 0.
import { createElement as h } from 'react'
import { formatHistoryKg } from './fourWeekHistory.mjs'

const LIFTS = [['squat', 'Squat'], ['bench', 'Bænkpres'], ['deadlift', 'Dødløft']]
const card = { border: '1px solid #414139', borderRadius: 16, padding: 16, marginBottom: 16, minWidth: 0 }
const row = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', minWidth: 0 }
const summaryStyle = { minHeight: 44, paddingTop: 12, boxSizing: 'border-box', cursor: 'pointer', fontSize: '1.15rem', fontWeight: 700 }

export function startmaksModel(athlete) {
  const lifts = LIFTS.map(([key, label]) => ({ label, value: Number(athlete?.[key]) }))
    .filter(lift => Number.isFinite(lift.value) && lift.value > 0)
  const total = lifts.length === LIFTS.length ? lifts.reduce((sum, lift) => sum + lift.value, 0) : null
  return { lifts, total }
}

// ownNumbers: atleten har egne e1RM i "Din udvikling" (eller de hentes stadig). Så står
// startmaks foldet som udgangspunkt, så de hverken gentager eller modsiger atletens egne tal.
export default function StartmaksView({ athlete, ownNumbers = false } = {}) {
  const { lifts, total } = startmaksModel(athlete)
  if (!lifts.length) return null
  const list = h('ul', { style: { listStyle: 'none', padding: 0, margin: '8px 0 0', lineHeight: 1.6 } },
    ...lifts.map(lift => h('li', { key: lift.label, style: row },
      h('span', null, lift.label), h('strong', null, `${formatHistoryKg(lift.value)} kg`))),
    total !== null && h('li', { key: 'total', style: { ...row, borderTop: '1px solid #414139', marginTop: 4, paddingTop: 8 } },
      h('span', null, 'Total'), h('strong', null, `${formatHistoryKg(total)} kg`)))
  if (ownNumbers) return h('details', { 'data-analysis-startmaks': true, style: card },
    h('summary', { style: summaryStyle }, 'Dine startmaks fra din coach'),
    h('p', { style: { lineHeight: 1.6, fontSize: 14, color: '#c1beb5' } },
      'Dit udgangspunkt, da du startede. Dine egne tal står i Din udvikling.'),
    list)
  return h('section', { 'data-analysis-startmaks': true, style: card },
    h('h2', { style: { fontSize: '1.15rem', margin: 0 } }, 'Dine startmaks fra din coach'),
    h('p', { style: { lineHeight: 1.6, fontSize: 14, color: '#c1beb5', margin: '4px 0 0' } },
      'Dit udgangspunkt. Når du logger tunge sæt, viser Din udvikling dine egne tal.'),
    list)
}
