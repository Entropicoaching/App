import { createElement as h, useEffect, useState } from 'react'
import RestitutionOverview from './RestitutionOverview.mjs'
import { buildRestitution } from './restitutionModel.mjs'
import { hasRestitutionData, hasRestitutionRows, selectCoachRestitution, startCoachRestitution } from './coachRestitutionData.mjs'

export function CoachRestitutionContent({ snapshot, onRetry } = {}) {
  const data = snapshot || { status: 'loading' }
  const model = buildRestitution(data, { enabled: true })
  // Successful empty sources remove the fold; malformed/failed reads stay errors.
  if (['ready', 'insufficient'].includes(model.status) && !hasRestitutionRows(data, model.to)) return null
  return h('details', { style: { minWidth: 0, marginBottom: '1rem' } },
    h('summary', { style: { minHeight: 44, padding: '12px 0', cursor: 'pointer' } }, 'Restitution (7-14 dage)'),
    h(RestitutionOverview, { enabled: true, snapshot: data, audience: 'coach', onRetry }))
}

function ActiveCoachRestitution({ client, coachId, athleteId, asOf }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => startCoachRestitution({ enabled: true, client,
    scope: { coachId, athleteId, asOf }, attempt }, setResult), [client, coachId, athleteId, asOf, attempt])
  const snapshot = selectCoachRestitution(result, client, { coachId, athleteId, asOf }, attempt)
  return h(CoachRestitutionContent, { snapshot, onRetry: () => setAttempt(value => value + 1) })
}

export default function CoachRestitution(props = {}) {
  if (!hasRestitutionData(props) || !props.client) return null
  return h(ActiveCoachRestitution, { ...props, key: `${props.coachId}:${props.athleteId}:${props.asOf}` })
}
