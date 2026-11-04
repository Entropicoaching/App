import { createElement as h, useEffect, useState } from 'react'
import CoachWeek from '../entropi2/tracking/coachuge/CoachWeek.mjs'
import { evaluateCoachWeek } from '../entropi2/tracking/coachuge/evaluate.mjs'
import Datagrundlag from '../entropi2/tracking/kvalitet/Datagrundlag.mjs'
import { getSignalExplanation } from '../entropi2/tracking/tekster/signalExplanations.mjs'
import { analyseWeekSnapshot, selectAnalyseWeek, startAnalyseWeek, validWeekScope } from './analyseUgeData.mjs'

const summaryStyle = { minHeight: 44, cursor: 'pointer', padding: '10px 0' }

export function AnalyseWeekContent({ enabled = false, athleteId, asOf, batch, retry } = {}) {
  if (enabled !== true) return null
  const data = analyseWeekSnapshot(batch)
  const model = evaluateCoachWeek({ enabled: true, data })
  // The weekly evaluator uses different thresholds from the trend models.
  // Reuse only neutral conversation/caveat copy, never their detection rules.
  const weight = model.flags.find(flag => flag.id === 'weight')
  const explanation = weight ? getSignalExplanation('hurtig vægtændring') : null
  return h('div', { style: { minWidth: 0, marginBottom: '1rem', color: '#f0f4f1' } },
    h(CoachWeek, { enabled: true, data }),
    model.state === 'error' && retry && h('button', { type: 'button', onClick: retry,
      style: { minHeight: 44, padding: 12 } }, 'Prøv ugeevalueringen igen'),
    batch && h('details', null,
      h('summary', { style: summaryStyle }, 'Datagrundlag pr. uge'),
      h(Datagrundlag, { enabled: true, athleteId, asOf, sources: batch.sources })),
    explanation && h('details', null,
      h('summary', { style: summaryStyle }, 'Om vægtflaget'),
      h('p', null, explanation.conversation), h('p', null, explanation.caveat)))
}

function ActiveAnalyseWeek({ client, coachId, athleteId, asOf }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => startAnalyseWeek({ enabled: true, client, scope: { coachId, athleteId, asOf }, attempt }, setResult),
    [client, coachId, athleteId, asOf, attempt])
  const scope = { coachId, athleteId, asOf }
  const batch = selectAnalyseWeek(result, true, client, scope, attempt)
  if (!validWeekScope(scope) || !client) return h('section', { 'aria-label': 'Ugeevaluering' },
    h('h2', null, 'Ugeevaluering'), h('p', { role: 'alert' }, 'Atlet eller opgørelsesdato mangler.'))
  return h(AnalyseWeekContent, { enabled: true, athleteId, asOf, batch, retry: () => setAttempt(n => n + 1) })
}

// OFF unmounts all state/effects. A later ON starts from loading, even if
// coach/athlete/day are identical to the previous activation.
export default function AnalyseUgeevaluering(props = {}) {
  if (props.enabled !== true) return null
  return h(ActiveAnalyseWeek, props)
}
