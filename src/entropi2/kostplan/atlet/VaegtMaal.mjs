import * as React from 'react'
import { vaegtRaekker, trendFor, vaegtMaalLinje, VINDUE_DAGE } from './vaegtMaalModel.mjs'

const { createElement: h, useEffect, useMemo, useState } = React

// Læsning af planversionens mål (goal, intensity) med den samme forespørgsel som indkøbslisten; kun læsning.
// Kun når vægten rækker, ellers ingen ekstra forespørgsel og ingen linje.
export function useVersionMaal({ client, planId, revision, enabled }) {
  const [state, setState] = useState({ key: null, version: null })
  const key = enabled && planId && revision ? `${planId}:${revision}` : null
  useEffect(() => {
    if (!key) return undefined
    let current = true
    Promise.resolve().then(async () => {
      const response = await client.from('kostplan_v1_versions').select('goal,intensity')
        .eq('id', revision).eq('plan_id', planId).limit(2)
      if (!current) return
      const data = response?.data
      setState({ key, version: !response?.error && Array.isArray(data) && data.length === 1 ? data[0] : null })
    }).catch(() => { if (current) setState({ key, version: null }) })
    return () => { current = false }
  }, [key, client])
  return state.key === key ? state.version : null
}

const line = { margin: '0 0 4px', fontWeight: 600 }
const summary = { minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: 0.85 }

export default function VaegtMaal({ athleteId, date, client, planId, revision, weightLogs, weightStatus }) {
  const ready = weightStatus?.state === 'ready' && weightStatus.athleteId === athleteId
  const rows = useMemo(() => ready ? vaegtRaekker(weightLogs, athleteId) : [], [ready, weightLogs, athleteId])
  const enough = trendFor(rows, date) !== null
  const version = useVersionMaal({ client, planId, revision, enabled: enough })
  const result = enough && version ? vaegtMaalLinje({ rows, date, version }) : null
  if (!result) return null
  return h('div', { 'data-vaegt-maal': result.status },
    h('p', { role: 'status', style: line }, result.text),
    h('details', null,
      h('summary', { style: summary }, 'Hvad bygger det på?'),
      h('p', { style: { margin: '0 0 8px' } },
        `${result.count} vejninger de seneste ${VINDUE_DAGE} dage. Linjen sammenligner vægtens tendens med målet i din plan og vises kun, når der er nok vejninger.`)))
}
