import { planOriginalRetention, VIDEO_SLET } from './videoRetention.mjs'

// createElement is injected to keep this read-only view independently testable.
export function renderVideoRetentionPreview(h, { analyses, objects, athleteId, now, videoSlet = VIDEO_SLET }) {
  const plan = planOriginalRetention({ analyses, objects, athleteId, now })
  return h('section', { 'aria-label': 'Opbevaring af originalvideoer' },
    h('h3', null, 'Originalvideoer efter 30 dage'),
    h('p', null, `Dryrun. Sletning er ${videoSlet === true ? 'slået til' : 'slået fra'}.`),
    h('p', null, 'Markeringer, tegninger, konklusion og et lille stillbillede bevares.'),
    !plan.available ? h('p', { role: 'status' }, 'Filoversigten mangler. Plads kan endnu ikke beregnes.') :
      h('div', null,
        h('p', { role: 'status' }, `${plan.candidates.length} originaler ville blive slettet. ${plan.bytes} bytes ville blive frigjort.`),
        h('p', null, `${plan.blocked.length} originaler afventer sikre metadata eller stillbillede. Præcis 30 dage beholdes.`),
        h('ul', null, ...plan.candidates.map(item => h('li', { key: item.path },
          `${item.id}: ${item.path}, ${item.created_at}, ${item.bytes} bytes`)))))
}
