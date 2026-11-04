import { createElement as h } from 'react'
import Program from './Program.mjs'

// Keep the supplied legacy program tree intact, including its logger, retry,
// week navigation and feedback. Assembly wraps the existing LazyBoundary once.
export default function ProgramEntry(props = {}) {
  if (props.enabled !== true) return props.children ?? null
  return h('div', { 'data-entropi2-program-entry': '' },
    h(Program, { enabled: true, currentWeek: props.currentWeek,
      loading: props.loading, programError: props.programError }),
    props.children && h('details', { style: { margin: '0 16px 16px', minWidth: 0 } },
      h('summary', { style: { boxSizing: 'border-box', minHeight: 48, padding: 12,
        cursor: 'pointer', color: '#edeae2', background: '#282820', border: '1px solid #777267',
        borderRadius: 8, overflowWrap: 'anywhere' } }, 'Registrér sæt og se andre uger'),
      props.children))
}
