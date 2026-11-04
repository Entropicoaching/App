import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { createMonthlyExportRequest, validExportScope } from './monthlyDownload.mjs'

const buttonStyle = { minHeight: 44, padding: '8px 12px', cursor: 'pointer',
  color: '#c8923a', background: 'transparent', border: '1px solid #8a6835', borderRadius: 2 }

export function MonthlyExportContent({ state = {}, onExport } = {}) {
  const loading = state.status === 'loading'
  return h('details', { style: { marginBottom: '1rem', minWidth: 0 } },
    h('summary', { style: { ...buttonStyle, width: 'fit-content', maxWidth: '100%', boxSizing: 'border-box' } },
      'Eksportér 4 uger (CSV/JSON)'),
    h('p', null, 'De seneste 28 afsluttede dage. Uden cyklusdata.'),
    h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      ...['csv', 'json'].map(format => h('button', { key: format, type: 'button', style: buttonStyle,
        disabled: loading, onClick: () => onExport(format) }, `Hent ${format.toUpperCase()}`))),
    h('p', { role: state.status === 'error' ? 'alert' : 'status', 'aria-live': 'polite' },
      loading ? 'Henter eksport…' : state.message || ''))
}

function ActiveMonthlyExport({ client, coachId, athleteId, asOf }) {
  const request = useMemo(() => createMonthlyExportRequest(client, { coachId, athleteId, asOf }),
    [client, coachId, athleteId, asOf])
  const active = useRef(request)
  active.current = request
  const [result, setResult] = useState(null)
  useEffect(() => () => request.cancel(), [request])
  return h(MonthlyExportContent, { state: result?.request === request ? result.state : {},
    onExport: format => request.run(format, { isCurrent: () => active.current === request,
      update: state => setResult({ request, state }) }) })
}

export default function CoachMonthlyExport(props = {}) {
  if (props.enabled !== true) return null
  if (!props.client || !validExportScope(props)) return h('p', { role: 'alert' }, 'Vælg en atlet for at eksportere.')
  return h(ActiveMonthlyExport, props)
}
