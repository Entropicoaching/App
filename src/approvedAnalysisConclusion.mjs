import { rel1030Feature } from './rel1030.mjs'
import { dayNumber } from './dataEnough.mjs'

export function analyseConclusionEnabled(search = '') {
  const values = new URLSearchParams(search).getAll('analyseConclusion')
  return (values.length === 1 && values[0] === '1') || rel1030Feature('analyseConclusion', search)
}
const liftNames = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft', sumo: 'Sumo dødløft', ohp: 'OHP' }
function sentence(value) {
  if (typeof value !== 'string') return ''
  const clean = value.trim().replace(/\s+/g, ' ')
  return clean.match(/^.*?[.!?](?=\s|$)/u)?.[0] || (clean ? clean + '.' : '')
}

export function approvedConclusionReviews({ athleteId, analyses = [], liftFilter = 'all' }) {
  return analyses.filter(row => row?.athlete_id === athleteId &&
    (liftFilter === 'all' || row.lift === liftFilter) &&
    ['coach_approved', 'shared'].includes(row.status) && dayNumber(row.analyzed_at) !== null && Number.isFinite(Date.parse(row.analyzed_at)) &&
    sentence(row.athlete_feedback?.focus?.[0]?.text))
    .sort((a, b) => Date.parse(b.analyzed_at) - Date.parse(a.analyzed_at) || String(a.id).localeCompare(String(b.id)))
}

export function approvedConclusionText(row) {
  return `Godkendt videoreview (${liftNames[row.lift] || row.lift}, ${row.analyzed_at.slice(0, 10)}): ${sentence(row.athlete_feedback.focus[0].text)}`
}
