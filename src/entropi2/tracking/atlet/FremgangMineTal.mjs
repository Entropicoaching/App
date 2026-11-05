import { createElement as h } from 'react'
import MineTal from './MineTal.mjs'
import { fremgangSnapshot } from './fremgangSnapshot.mjs'
import { readinessSections } from './readinessSections.mjs'
import SleepOverview from '../soevn/SleepOverview.mjs'
import RestitutionOverview from '../restitution/RestitutionOverview.mjs'

const summaryStyle = { minHeight: 44, padding: '12px 0', cursor: 'pointer', boxSizing: 'border-box' }

// Called only from the Entropi 2 Fremgang surface. Closed native disclosure.
// It owns no fetch, storage, flags or writes; the host owns snapshot refresh.
export default function FremgangMineTal(props = {}) {
  if (props.enabled !== true) return null
  const snapshot = fremgangSnapshot(props)
  const sections = readinessSections(snapshot, { enabled: true })
  if (sections && !sections.sleep && !sections.restitution) return null
  return h('details', { 'data-fremgang-mine-tal': true,
    style: { marginBottom: 16, minWidth: 0, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, paddingTop: 12, cursor: 'pointer', boxSizing: 'border-box' } }, 'Mine tal'),
    h('p', null, sections ? 'Søvn · 4 uger. Restitution · dagsform fra de seneste 7 dage.'
      : 'Søvn, energi, stress og ømhed · 4 uger. Træning, kost og vægt finder du under Mine data.'),
    snapshot.dailySource === 'readiness_logs' && h('p', null, 'Fra dine dagsformsregistreringer. Ømhed vises på den oprindelige skala fra 1 til 5.'),
    snapshot.status === 'unavailable'
      ? h('p', { role: 'status' }, 'Dine daglige registreringer er ikke klar. Der vises ingen beregnede tal endnu.')
      : sections ? h('div', { 'data-athlete-readiness-sections': true },
        sections.sleep && h('details', { 'data-athlete-sleep': true },
          h('summary', { style: summaryStyle }, 'Søvn'),
          h(SleepOverview, { enabled: true, snapshot: sections.sleep, weeks: 4, hoursOnly: true, compact: true })),
        sections.restitution && h('details', { 'data-athlete-restitution': true },
          h('summary', { style: summaryStyle }, 'Restitution'),
          h(RestitutionOverview, { enabled: true, snapshot: sections.restitution, compact: true })))
        : h(MineTal, { enabled: true, snapshot, wellbeingOnly: true, showHeading: false, onRetry: props.onRetry }))
}
