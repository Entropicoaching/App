// Ordre 1705: atleten ser de stævneresultater, coachen har registreret, i Udvikling.
// Navneområde i stedet for navngivne hooks: de lukkede prøveharnesser erstatter react med en
// fixture, der kun har createElement. Hooks køres kun, når komponenten gengives af React.
import * as React from 'react'
import { formatHistoryKg } from './fourWeekHistory.mjs'
import { developmentDate } from './developmentModel.mjs'

export const MEET_FIELDS = 'meet_date, meet_name, squat, bench, deadlift, total'
export const MEET_LIMIT = 5
const LIFTS = [['squat', 'Squat'], ['bench', 'Bænkpres'], ['deadlift', 'Dødløft']]
// PostgREST kan sende numeric som tekst; tomme og ikke konkurrerede løft er null og vises ikke.
const kg = value => {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

// Kun læsning med atletens egen klient og eget id. Fejl giver null, og så vises intet.
export async function readMeetResults({ client, athleteId }) {
  const result = await client.from('meet_results').select(MEET_FIELDS)
    .eq('athlete_id', athleteId).order('meet_date', { ascending: false }).limit(MEET_LIMIT)
  if (!result || result.error || !Array.isArray(result.data)) return null
  return result.data
}

// Nyeste først, højst 5; rækker uden gyldig dato springes over. Ingen nye beregninger.
export function meetRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.meet_date ?? '').slice(0, 10)))
    .map(row => ({ day: row.meet_date.slice(0, 10), name: String(row.meet_name ?? '').trim() || 'Stævne',
      total: kg(row.total), lifts: LIFTS.filter(([key]) => kg(row[key]) !== null).map(([key, label]) => [label, kg(row[key])]) }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .slice(0, MEET_LIMIT)
}

export function useMeetResults({ client, athleteId }) {
  const [state, setState] = React.useState(null)
  // Klienten kan være et nyt objekt ved hver gengivelse; læsningen hører til atleten.
  const clientRef = React.useRef(client)
  clientRef.current = client
  const live = athleteId != null && typeof client?.from === 'function'
  React.useEffect(() => {
    if (!live) return undefined
    let current = true
    readMeetResults({ client: clientRef.current, athleteId })
      .then(rows => { if (current) setState({ athleteId, rows }) }, () => { if (current) setState(null) })
    return () => { current = false }
  }, [live, athleteId])
  return live && state?.athleteId === athleteId ? meetRows(state.rows) : []
}

const card = { border: '1px solid #414139', borderRadius: 16, padding: 16, marginBottom: 16, minWidth: 0 }

export function MeetList({ rows }) {
  if (!rows.length) return null
  const h = React.createElement
  return h('section', { 'aria-label': 'Stævner', 'data-analysis-meets': true, style: card },
    h('h2', null, 'Stævner'),
    h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } },
      ...rows.map(row => h('li', { key: `${row.day}-${row.name}`, style: { padding: '8px 0', borderTop: '1px solid #2c2c26' } },
        h('p', { style: { margin: 0, lineHeight: 1.5 } },
          h('strong', null, developmentDate(row.day)), ` · ${row.name}`),
        (row.total !== null || row.lifts.length > 0) && h('p', { style: { margin: '4px 0 0', lineHeight: 1.5 } },
          [row.total !== null ? `Total ${formatHistoryKg(row.total)} kg` : null,
            ...row.lifts.map(([label, value]) => `${label} ${formatHistoryKg(value)} kg`)].filter(Boolean).join(' · '))))))
}

export default function StaevnerView({ client, athleteId }) {
  return React.createElement(MeetList, { rows: useMeetResults({ client, athleteId }) })
}
