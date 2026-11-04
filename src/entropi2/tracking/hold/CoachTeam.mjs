import { createElement as h } from 'react'
import { BASIS_DOMAINS } from '../kvalitet/weeklyDataBasis.mjs'
import { buildCoachTeamOverview } from './overview.mjs'

const labels = { training: 'Træningslog', nutrition: 'Kost', weight: 'Vægt', readiness: 'Dagsform' }
const sourceMessages = { missing: 'Kilde mangler', loading: 'Indlæses', error: 'Kunne ikke indlæses',
  partial: 'Ufuldstændig indlæsning', invalid: 'Ugyldigt grundlag' }
const weekMessages = { flags: 'Flag fra ugeevalueringen; øvrige områder kan mangle grundlag.',
  noFlags: 'Ingen flag i det kontrollerede ugegrundlag.', insufficient: 'For lidt data til en samlet ugeevaluering.',
  empty: 'Ingen registreringer i ugegrundlaget.', loading: 'Ugegrundlaget indlæses.', error: 'Ugegrundlaget kunne ikke kontrolleres.' }
const summaryStyle = { minHeight: 44, padding: '10px 0', boxSizing: 'border-box', cursor: 'pointer' }

function coverage(week) {
  return h('section', { key: week.weekStart, 'aria-label': `Datagrundlag fra ${week.weekStart}` },
    h('h4', null, `${week.weekStart} – ${week.through}`),
    week.partial && h('p', null, `Igangværende uge: ${week.elapsedDays} af 7 dage. Dagens data kan ændres.`),
    h('ul', { style: { paddingLeft: 20 } }, ...BASIS_DOMAINS.map(domain => {
      const d = week.domains[domain]
      return h('li', { key: domain }, h('strong', null, `${labels[domain]}: `),
        d.state === 'ready' ? `${d.recordedDays}/${week.elapsedDays} dage registreret; ${d.valueDays} med værdigrundlag.`
          : `${sourceMessages[d.state]}. Dækning ukendt.`)
    })))
}

/** Read-only React view. Explicit opt-in; no hooks, fetching or persistence. */
export default function CoachTeam(options = {}) {
  if (options?.enabled !== true) return null
  const model = buildCoachTeamOverview(options)
  const style = { color: '#f0f4f1', background: '#101815', padding: 12, borderRadius: 16,
    minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', fontFamily: 'inherit' }
  const heading = h('h2', null, 'Holdoverblik')
  if (model.state === 'loading') return h('section', { style, 'aria-label': 'Holdoverblik', 'aria-busy': true },
    heading, h('p', { role: 'status' }, 'Henter coachens atletliste …'))
  if (model.state === 'error') return h('section', { style, 'aria-label': 'Holdoverblik' },
    heading, h('p', { role: 'alert' }, 'Holdoverblikket kunne ikke opgøres. Hele atletlisten og opgørelsesdatoen skal kontrolleres.'))
  if (model.state === 'empty') return h('section', { style, 'aria-label': 'Holdoverblik' },
    heading, h('p', { role: 'status' }, 'Ingen atleter på coachens hold.'))
  return h('section', { style, 'aria-label': 'Holdoverblik' }, heading,
    h('p', null, `${model.athletes.length} atleter · opgjort til og med ${model.asOf}.`),
    h('p', null, 'Flest flag først, dernæst ukendt flagantal og til sidst ingen flag. Ved lighed: ukendt dækning, så flest dage uden værdigrundlag over fire uger.'),
    h('ol', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, paddingLeft: 24 } },
      ...model.athletes.map(athlete => h('li', { key: athlete.athleteId, style: { minWidth: 0 } },
        h('article', { 'aria-label': `Atlet ${athlete.athleteId}`,
          style: { border: '1px solid #66756e', borderRadius: 12, padding: 12, minWidth: 0 } },
        h('h3', null, `Atlet ${athlete.athleteId}`),
        h('p', null, athlete.flagCount === null ? 'Flagantal ukendt' : `${athlete.flagCount} flag`),
        h('p', { role: athlete.weekState === 'error' ? 'alert' : undefined }, weekMessages[athlete.weekState]),
        coverage(athlete.weeks.at(-1)),
        h('details', null, h('summary', { style: summaryStyle }, 'Tidligere tre ugers datagrundlag'),
          ...athlete.weeks.slice(0, -1).map(coverage)))))),
    h('p', null, 'Dage med registreringer er ikke bevis for komplette pas eller kostdage. Manglende træningslog kan være hvile. Hvert flag kræver sit eget grundlag.'),
    h('p', null, 'Coachen vurderer og planlægger. Ingen automatiske programændringer.'))
}

// Connected view: shorter, existing Dashboard reads have their own honest
// windows. The standalone snapshot view above keeps its explicit contract.
export function CoachTeamRegistrations(options = {}) {
  if (options.enabled !== true) return null
  const model = options.model
  if (!model?.athletes?.length) return null
  return h('section', { 'aria-label': 'Holdets registreringer',
    style: { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } },
    h('p', null, `Registreringer til og med ${model.asOf}. Atleter med data vises; flest registreringssignaler først.`),
    h('p', null, 'Signaler beregnes kun fra tilstrækkelige belastnings- og kostdata. Dage med log er ikke bevis for komplette pas eller kostdage. Manglende træningslog kan være hvile.'),
    h('ol', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, paddingLeft: 24 } },
      ...model.athletes.map(athlete => h('li', { key: athlete.athleteId, style: { minWidth: 0 } },
        h('article', { 'aria-label': `Holdregistreringer: ${athlete.name}`,
          style: { border: '1px solid #66756e', borderRadius: 12, padding: 12, minWidth: 0 } },
          h('h3', null, athlete.name),
          athlete.signalCount > 0 && h('p', null,
            `${athlete.signalCount} registreringssignal${athlete.signalCount === 1 ? '' : 'er'}`),
          athlete.trainingDays !== null && h('p', null,
            `Træningslog ${model.trainingFrom} – ${model.asOf}: ${athlete.trainingDays}/28 dage registreret.`),
          athlete.nutritionDays !== null && h('p', null,
            `Kost ${model.nutritionFrom} – ${model.asOf}: ${athlete.nutritionDays}/7 dage registreret.`))))))
}
