import { createElement as h } from 'react'
import MineTal from './MineTal.mjs'
import { fremgangSnapshot } from './fremgangSnapshot.mjs'

// Called only from the Entropi 2 Fremgang surface. Closed native disclosure.
// It owns no fetch, storage, flags or writes; the host owns snapshot refresh.
export default function FremgangMineTal(props = {}) {
  if (props.enabled !== true) return null
  const snapshot = fremgangSnapshot(props)
  return h('details', { 'data-fremgang-mine-tal': true,
    style: { marginBottom: 16, minWidth: 0, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Mine tal'),
    h('p', null, 'Søvn, energi, stress og ømhed · 4 uger. Træning, kost og vægt finder du under Mine data.'),
    snapshot.dailySource === 'readiness_logs' && h('p', null, 'Fra dine dagsformsregistreringer. Ømhed vises på den oprindelige skala fra 1 til 5.'),
    snapshot.status === 'unavailable'
      ? h('p', { role: 'status' }, 'Dine daglige registreringer er ikke klar. Der vises ingen beregnede tal endnu.')
      : h(MineTal, { enabled: true, snapshot, wellbeingOnly: true, showHeading: false, onRetry: props.onRetry }))
}
