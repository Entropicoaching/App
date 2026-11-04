import { createElement as h } from 'react'
import { evaluateCoachWeek } from './evaluate.mjs'

const summaryStyle = { minHeight: 44, cursor: 'pointer', padding: '10px 0', boxSizing: 'border-box' }
const box = { border: '1px solid #66756e', borderRadius: 12, padding: 12, minWidth: 0 }
function basis(section) {
  const b = section.dataBasis
  return h('details', null,
    h('summary', { style: summaryStyle }, 'Vis grundlag'),
    h('p', null, `Vindue: ${b.from} – ${b.to}. Antal: ${b.sampleCount === null ? 'ukendt' : b.sampleCount}. Minimum: ${b.minimumSampleCount}${section.id === 'compliance' ? ' planlagt pas' : ' dage'}.`),
    h('p', null, `Regel: ${b.rule}.`), h('p', null, `Beregning: ${b.formula}.`),
    b.observations.length > 0 ? h('ul', null, ...b.observations.map((line, i) => h('li', { key: i }, line))) :
      h('p', null, 'Ingen validerede registreringer at vise.'))
}
function flagCard(section) {
  return h('section', { key: section.id, style: box, 'aria-label': section.title },
    h('h3', null, `${section.strength === 'vigtig' ? 'Prioritet' : 'Til gennemgang'}: ${section.title}`),
    h('p', null, section.dataBasis.summary),
    h('p', null, `${section.dataBasis.from} – ${section.dataBasis.to}`),
    h('p', null, section.dataBasis.rule), basis(section))
}

/** Unwired, read-only React view. No hooks, requests, persistence or writes. */
export default function CoachWeek(options = {}) {
  if (options?.enabled !== true) return null
  const model = evaluateCoachWeek(options)
  const style = { color: '#f0f4f1', background: '#101815', padding: 12, borderRadius: 16,
    minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', fontFamily: 'inherit' }
  if (model.state === 'loading') return h('section', { style, 'aria-label': 'Ugeevaluering', 'aria-busy': true },
    h('h2', null, 'Ugeevaluering'), h('p', { role: 'status' }, 'Henter ugens datagrundlag …'))
  if (model.state === 'error') return h('section', { style, 'aria-label': 'Ugeevaluering' },
    h('h2', null, 'Ugeevaluering'), h('p', { role: 'alert' }, 'Kunne ikke hente hele perioden — prøv igen. Grundlaget skal kontrolleres.'))
  const priority = model.flags.filter(s => s.strength === 'vigtig').length
  const remainder = model.sections.filter(s => !s.flagged)
  const messages = { empty: 'Ingen registreringer i perioden', insufficient: 'For lidt data til et samlet overblik',
    noFlags: 'Ingen flag i de registrerede data', flags: `${priority} prioritet · ${model.flags.length - priority} til gennemgang` }
  return h('section', { style, 'aria-label': 'Ugeevaluering' },
    h('h2', null, 'Ugeevaluering'), h('p', null, `${model.from} – ${model.asOf} · opgjort til og med ${model.asOf}`),
    h('p', null, messages[model.state]),
    model.state === 'flags' && model.insufficient && h('p', null, 'For lidt data i dele af grundlaget — se mangler nedenfor.'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 } },
      ...model.flags.map(flagCard)),
    remainder.length > 0 && h('details', { style: { marginTop: 12 } },
      h('summary', { style: summaryStyle }, 'Øvrigt grundlag og datamangler'),
      ...remainder.map(section => h('section', { key: section.id, 'aria-label': section.title, style: { marginBottom: 16 } },
        h('h3', null, section.title), h('p', null, section.dataBasis.summary), basis(section)))),
    h('p', null, 'Grundlag: atletens egne registreringer. Manglende registreringer er ikke nul.'),
    h('p', null, 'Coachen vurderer og planlægger. Ingen automatiske programændringer.'))
}
