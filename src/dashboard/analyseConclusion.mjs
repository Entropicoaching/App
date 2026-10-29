import { conclusionSentence as sentence, renderConclusionHistory } from './analyseConclusionHistory.mjs'
import { rel1030Feature } from '../rel1030.mjs'
import { createElement as h } from 'react'
import { hasEnoughData, dataMessage, dayNumber } from '../dataEnough.mjs'
import { heavyPointEvidence } from '../dataEvidence.mjs'
import { bestHeavySetPerDay } from '../exerciseProgress.js'
import { exerciseSetView } from '../exerciseSetView.js'

export const DEFAULT_ANALYSE_CONCLUSION = false
export function analyseConclusionEnabled(search = '') {
  const values = new URLSearchParams(search).getAll('analyseConclusion')
  return (values.length === 1 && values[0] === '1') || rel1030Feature('analyseConclusion', search)
}
const liftNames = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft', sumo: 'Sumo dødløft', ohp: 'OHP' }

export function approvedConclusionReviews({ athleteId, analyses = [], liftFilter = 'all' }) {
  return analyses.filter(row => row?.athlete_id === athleteId &&
    (liftFilter === 'all' || row.lift === liftFilter) &&
    ['coach_approved', 'shared'].includes(row.status) && dayNumber(row.analyzed_at) !== null && Number.isFinite(Date.parse(row.analyzed_at)) &&
    sentence(row.athlete_feedback?.focus?.[0]?.text))
    .sort((a, b) => Date.parse(b.analyzed_at) - Date.parse(a.analyzed_at) || String(a.id).localeCompare(String(b.id)))
}

// A saved, approved focus is a human conclusion, not a newly inferred finding.
// Raw training numbers must pass the existing rules even when appData2 is OFF.
export function analyseConclusion({ athleteId, analyses = [], logs = [], liftFilter = 'all', loading, error }) {
  if (!athleteId) return 'Vælg en atlet for at se analysens konklusion.'
  if (loading) return 'Afvent indlæsning af videoreview, før konklusionen vises.'
  if (error) return 'Videoreview kunne ikke indlæses, så grundlaget skal opdateres.'
  const approved = approvedConclusionReviews({ athleteId, analyses, liftFilter })
  if (approved.length) {
    const row = approved[0]
    return `Godkendt videoreview (${liftNames[row.lift] || row.lift}, ${row.analyzed_at.slice(0, 10)}): ${sentence(row.athlete_feedback.focus[0].text)}`
  }
  const scopedLogs = logs.readEvidence?.athleteId && logs.readEvidence.athleteId !== athleteId ? []
    : logs.filter(row => !row.athlete_id || row.athlete_id === athleteId)
  const names = liftFilter === 'all' ? Object.values(liftNames) : [liftNames[liftFilter]].filter(Boolean)
  // Existing lift order is the priority; never compare unlike lifts or calculate a new trend.
  for (const name of names) {
    // bestHeavySetPerDay already excludes deloads; retain that fact with appData2 OFF.
    const basis = { rows: bestHeavySetPerDay(scopedLogs.filter(row => exerciseSetView(row.exercises?.name).name === name))
      .map(point => heavyPointEvidence({ ...point, deload: false }, name)) }
    if (!hasEnoughData('D21', basis)) continue
    const latest = [...basis.rows].sort((a, b) => dayNumber(b.dag) - dayNumber(a.dag))[0]
    return `${name}: seneste estimerede 1RM er ${latest.e1rm.toLocaleString('da-DK')} kg (${latest.dag}).`
  }
  return `Der mangler et godkendt videoreview med fokus; ${dataMessage('D21').replace(/^Trend/, 'målegrundlaget')}`
}

export default function AnalyseConclusion(props) {
  const { enabled = DEFAULT_ANALYSE_CONCLUSION, children } = props
  if (enabled !== true) return children
  return h('section', { 'aria-label': 'Samlet analyse', style: { minWidth: 0, overflowWrap: 'anywhere' } },
    h('p', { role: 'status', 'aria-label': 'Konklusion', style: { color: '#edeae2', lineHeight: 1.5 } }, analyseConclusion(props)),
    renderConclusionHistory(h, !props.athleteId || props.loading || props.error ? [] : approvedConclusionReviews(props)),
    ...(props.message ? [props.message] : []),
    h('details', null,
      h('summary', { style: { minHeight: 44, padding: '0.65rem', boxSizing: 'border-box', cursor: 'pointer', color: '#edeae2' } }, 'Se grundlaget'),
      children))
}
