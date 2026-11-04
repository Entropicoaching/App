import { createElement as h, useEffect, useState } from 'react'
import SleepOverview from './SleepOverview.mjs'
import { buildSleepOverview } from './sleepModel.mjs'
import { hasReadinessSleep, selectCoachSleep, startCoachSleep } from './coachSleepData.mjs'

const control = { minHeight: 44, padding: '10px 0', cursor: 'pointer' }

export function CoachSleepContent({ snapshot, weeks = 8, onWeeks, onRetry } = {}) {
  const data = snapshot || { status: 'loading' }
  // An empty eight-week source removes the entire section. A shorter selected
  // period may still truthfully show its own empty state inside the fold.
  if (buildSleepOverview(data, { enabled: true, weeks: 8 }).status === 'empty') return null
  return h('details', { style: { minWidth: 0, marginBottom: '1rem' } },
    h('summary', { style: control }, 'Søvn (4-8 uger)'),
    h('label', { style: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' } },
      'Periode', h('select', { value: weeks, style: { minHeight: 44 },
        onChange: event => onWeeks(Number(event.target.value)) },
      ...[4, 6, 8].map(value => h('option', { key: value, value }, `${value} uger`)))),
    h('p', null, 'Afsluttede dage i dansk tid. Selvregistrerede søvntimer; ingen årsagspåstande.'),
    h(SleepOverview, { enabled: true, snapshot: data, weeks, hoursOnly: true, onRetry }))
}

function ActiveCoachSleep({ client, coachId, athleteId, asOf }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [weeks, setWeeks] = useState(8)
  useEffect(() => startCoachSleep({ enabled: true, client,
    scope: { coachId, athleteId, asOf }, attempt }, setResult),
  [client, coachId, athleteId, asOf, attempt])
  const snapshot = selectCoachSleep(result, client, { coachId, athleteId, asOf }, attempt)
  return h(CoachSleepContent, { snapshot, weeks, onWeeks: setWeeks,
    onRetry: () => setAttempt(value => value + 1) })
}

export default function CoachSleep(props = {}) {
  if (!hasReadinessSleep(props) || !props.client) return null
  return h(ActiveCoachSleep, { ...props, key: `${props.coachId}:${props.athleteId}:${props.asOf}` })
}
