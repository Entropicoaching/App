import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { BASIS_DOMAINS, weeklyDataBasis } from './weeklyDataBasis.mjs'

const labels = { training: 'Træningslog', nutrition: 'Kost', weight: 'Vægt', readiness: 'Dagsform' }
const states = { missing: 'Datakilde mangler.', loading: 'Data indlæses.',
  error: 'Data kunne ikke indlæses.', partial: 'Datakilden er ikke fuldt indlæst.',
  invalid: 'Datagrundlaget kunne ikke kontrolleres.' }
const listStyle = { paddingLeft: 20, margin: '8px 0', overflowWrap: 'anywhere' }

/** Unwired coach section. Caller owns authorization and complete read scope.
 * No hooks or data fetching; explicit boolean true required before data access.
 */
export default function Datagrundlag(props = {}) {
  if (props.enabled !== true) return null
  const model = weeklyDataBasis(props)
  if (model.state !== 'ready') return h('section', { 'aria-label': 'Datagrundlag' },
    h('h2', null, 'Datagrundlag'), h('p', { role: 'status' }, 'Atlet eller opgørelsesdato mangler eller er ugyldig.'))
  return h('section', { 'aria-label': 'Datagrundlag', style: { minWidth: 0, overflowWrap: 'anywhere' } },
    h('h2', null, 'Datagrundlag'),
    h('p', null, `Atlet: ${model.athleteId}. Opgjort til og med ${model.asOf}.`),
    h('p', null, 'Dage med registreringer er ikke bevis for komplette pas eller kostdage. Manglende træningslog kan være hvile. Hvert signal kræver sit eget grundlag.'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 } },
      ...model.weeks.map(week => h('section', { key: week.weekStart,
        'aria-label': `Uge ${week.weekStart}`, style: { minWidth: 0, padding: 12, border: '1px solid currentColor', borderRadius: 12 } },
      h('h3', null, `${week.weekStart} – ${week.weekEnd}`),
      week.partial && h('p', null, `Igangværende uge: ${week.elapsedDays} ${antalOrd(week.elapsedDays, 'dag', 'dage')} til og med ${week.through}. Dagens registreringer kan fortsat ændres.`),
      h('ul', { style: listStyle }, ...BASIS_DOMAINS.map(domain => {
        const basis = week.domains[domain]
        return h('li', { key: domain }, h('strong', null, `${labels[domain]}: `),
          basis.state !== 'ready' ? `${states[basis.state]} Dækning er ukendt.`
            : `${basis.recordedDays}/${week.elapsedDays} ${antalOrd(week.elapsedDays, 'dag', 'dage')} registreret; ${basis.valueDays} med værdigrundlag.`)
      })),
      h('details', null,
        h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Se manglende dage og værdigrundlag'),
        h('ul', { style: listStyle }, ...BASIS_DOMAINS.map(domain => {
          const basis = week.domains[domain]
          return h('li', { key: domain }, h('strong', null, `${labels[domain]}: `),
            basis.state !== 'ready' ? 'Manglende dage kan ikke opgøres.' :
              `Uden registrering: ${basis.missingDays.join(', ') || 'Ingen'}. Uden værdigrundlag: ${basis.invalidDays.join(', ') || 'Ingen'}.`)
        }))),
      ))),
    h('p', null, 'Værdigrundlag: træningssæt med beregnelig tonnage; kost med kendte kcal og protein; gyldig vægt; dagsformscore 0–100 uden modstridende scores samme dag. Det er ikke en samlet kvalitetsgodkendelse.'))
}
