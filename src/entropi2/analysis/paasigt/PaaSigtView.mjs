import { createElement as h } from 'react'
import { paaSigtModel } from './paaSigtModel.mjs'

// Ordre 1543: foldet ind under Fremgang (Marc 16. nov.: "gem det i under kategorierne").
// Kun procent og uger; kg og e1RM står allerede i "Din udvikling" og "Dine rekorder".
const card = { border: '1px solid #414139', borderRadius: 16, padding: '0 16px', marginBottom: 16, background: '#1c1c18', minWidth: 0 }
const summaryStyle = { minHeight: 44, paddingTop: 12, paddingBottom: 12, boxSizing: 'border-box', cursor: 'pointer', fontWeight: 600 }
const muted = { margin: '4px 0 0', fontSize: 15, lineHeight: 1.5, color: '#c1beb5' }

export default function PaaSigtView(props = {}) {
  if (props.entropi2 !== true) return null
  const model = paaSigtModel(props, props.now)
  if (model.state === 'hidden') return null
  return h('details', { 'data-analysis-paa-sigt': true, style: card },
    h('summary', { style: summaryStyle }, 'På sigt: hvor er din styrke på vej hen'),
    model.state === 'quiet'
      ? h('p', { 'data-paa-sigt-rolig': true, style: { ...muted, marginBottom: 16 } }, model.message)
      : h('div', { style: { paddingBottom: 16 } },
        ...model.lifts.map(lift => h('section', { key: lift.lift, 'aria-label': `${lift.lift} på sigt`, 'data-paa-sigt-loeft': lift.lift,
          style: { marginTop: 12 } },
          h('p', { style: { margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.5,
            color: lift.direction === 'tilbage' ? '#da9d8e' : '#d8b16b' } }, lift.text),
          lift.top && h('p', { 'data-paa-sigt-top': lift.lift, style: muted }, lift.top),
          lift.plan && h('p', { 'data-paa-sigt-plan': lift.lift, style: muted }, lift.plan))),
        model.deload && h('p', { 'data-paa-sigt-deload': true, style: { ...muted, marginTop: 12 } }, model.deload),
        h('p', { style: { ...muted, marginTop: 12, fontSize: 13 } },
          'Bygger på dine tunge sæt i samme rep-område de seneste 8 uger og ugens plan. Det er et skøn, ikke en garanti.')))
}
