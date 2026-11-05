import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { buildAthleteWeek } from './athleteWeekModel.mjs'

const format = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const f = n => format.format(n)
const basisStyle = { margin: '4px 0 0', fontSize: '0.875rem' }
const metric = (key, title, value, basis) => h('div', { key, style: { padding: '10px 0' } },
  h('dt', { style: { fontWeight: 600 } }, title),
  h('dd', { style: { margin: '4px 0 0' } }, value,
    h('p', { style: basisStyle }, 'Datagrundlag: ', basis)))
const mean = (data, unit) => data.average !== null ? `${f(data.average)} ${unit === 'timer' ? antalOrd(data.average, 'time', 'timer') : unit}` : 'For lidt data'
const coverage = data => `${data.count}/7 dage · mindst 4 dage for gennemsnit`
const list = (key, rows, describe) => h('ul', { key, style: { paddingInlineStart: 20 } },
  rows.map((row, index) => h('li', { key: `${row.day}-${index}` },
    h('time', { dateTime: row.day }, row.day), ': ', describe(row))))
const nutritionValue = (data, unit) => data.percent === null ? 'Kan ikke sammenlignes med mål'
  : `${f(data.average)} ${unit === 'timer' ? antalOrd(data.average, 'time', 'timer') : unit}/dag · mål ${f(data.targetAverage)} ${unit}/dag (${f(data.percent)} %)`

/** No hooks, fetch, storage, clock or wiring. OFF does not inspect the snapshot. */
export default function AthleteWeek(props = {}) {
  if (props.enabled !== true) return null
  const model = buildAthleteWeek(props.snapshot, { enabled: true })
  const shell = { 'aria-label': 'Ugen i korte træk', className: 'e2-ugeatlet',
    style: { width: '100%', maxWidth: 560, minWidth: 0, boxSizing: 'border-box',
      padding: 16, border: '1px solid currentColor', borderRadius: 16,
      overflowWrap: 'anywhere', lineHeight: 1.5 } }
  const heading = h('h2', { style: { margin: '0 0 8px' } }, 'Ugen i korte træk')
  if (model.status === 'loading') return h('section', { ...shell, 'aria-busy': true }, heading,
    h('p', { role: 'status' }, 'Henter ugens registreringer…'))
  if (model.status === 'error') return h('section', shell, heading,
    h('p', { role: 'alert' }, 'Ugens data kunne ikke vises komplet. Prøv igen.'),
    typeof props.onRetry === 'function' && h('button', { type: 'button', onClick: props.onRetry,
      style: { minHeight: 44, minWidth: 44 } }, 'Prøv igen'))
  // Home already supplies the disclosure heading. Its adapter loads wellbeing
  // only; do not show invented zeroes for training or unavailable nutrition.
  if (props.compactHome === true) return h('div', { className: 'e2-ugeatlet', style: { lineHeight: 1.5 } },
    h('p', null, 'Seneste 7 afsluttede dage · ', h('time', { dateTime: model.from }, model.from), '–',
      h('time', { dateTime: model.to }, model.to)),
    h('dl', { style: { margin: 0 } },
      metric('sleep', 'Søvn i gennemsnit', mean(model.sleep, 'timer'), coverage(model.sleep)),
      metric('energy', 'Dagsform i gennemsnit', mean(model.energy, 'af 5'),
        `${coverage(model.energy)} · selvrapporteret energi, 5 er højest`)),
    h('p', null, 'Kun registreret søvn og energi. Manglende dage udfyldes ikke.'),
    h('p', null, model.encouragement))
  const best = model.bestSet, sessions = model.sessions, nutrition = model.nutrition
  return h('section', shell,
    h('style', null, '.e2-ugeatlet summary:focus-visible,.e2-ugeatlet button:focus-visible{outline:2px solid currentColor;outline-offset:3px}'),
    heading,
    h('p', { style: { margin: '0 0 12px' } }, 'Seneste 7 afsluttede dage · ',
      h('time', { dateTime: model.from }, model.from), '–', h('time', { dateTime: model.to }, model.to)),
    model.status === 'empty' && h('p', { role: 'status' }, 'Ingen registreringer i perioden endnu.'),
    h('dl', { style: { margin: 0 } },
      metric('sessions', 'Pas gennemført', `${sessions.completed} pas`,
        `${sessions.completedPlanned} af ${sessions.planned} ${antalOrd(sessions.planned, 'planlagt', 'planlagte')} · ${sessions.extraCompleted} ekstra gennemført. Kun bekræftede pas.`),
      metric('set', 'Bedste sæt', best.value
        ? `${best.label}: ${f(best.value.kg)} kg × ${best.value.reps}` : 'Intet kvalificeret sæt',
      best.label ? `${best.count} ${antalOrd(best.count, 'bekræftet arbejdssæt', 'bekræftede arbejdssæt')} med 1–10 gentagelser · ét løft og én variant`
        : 'Intet løft valgt til sammenligning'),
      metric('sleep', 'Søvn i gennemsnit', mean(model.sleep, 'timer'), coverage(model.sleep)),
      metric('energy', 'Dagsform i gennemsnit', mean(model.energy, 'af 5'),
        `${coverage(model.energy)} · selvrapporteret energi, 5 er højest`),
      metric('nutrition', 'Kost i forhold til mål', h('div', null,
        h('div', null, 'Energi: ', nutritionValue(nutrition.kcal, 'kcal')),
        h('div', null, 'Protein: ', nutritionValue(nutrition.protein, 'g'))),
      `${nutrition.kcal.count}/7 dage med energi og mål · ${nutrition.protein.count}/7 med protein og mål. Kun komplette kostdage med dateret mål; øvrige dage er ukendte.`)),
    h('p', { style: { margin: '12px 0' } }, model.encouragement),
    h('details', null,
      h('summary', { style: { minHeight: 44, display: 'list-item', padding: '12px 0', cursor: 'pointer' } }, 'Se datagrundlag'),
      h('p', null, 'Perioden er valgt af visningen. Manglende dage udfyldes ikke. Tal beskriver dine registreringer og ændrer ikke din plan.'),
      h('h3', null, 'Pas'), sessions.observations.length
        ? list('sessions', sessions.observations, row => `${row.planned ? 'Planlagt' : 'Ekstra'} pas · ${row.completed ? 'bekræftet gennemført' : 'ikke bekræftet gennemført'}`)
        : h('p', null, 'Ingen registrerede pas i perioden.'),
      h('h3', null, 'Bedste sæt'),
      h('p', null, 'Kun det valgte løft og samme variant i kg. Højeste estimerede 1RM = kg × (1 + gentagelser/30). Opvarmning, oversprungne og afventende sæt indgår ikke. Ved lighed vælges højeste vægt, derefter tidligste dato og sæt-id.'),
      best.value && list('best', [best.value], row => `${f(row.kg)} kg × ${row.reps} · estimeret 1RM ${f(row.estimate)} kg`),
      h('h3', null, 'Søvn'), model.sleep.count ? list('sleep', model.sleep.observations, row => `${f(row.value)} ${antalOrd(row.value, 'time', 'timer')}`)
        : h('p', null, 'Ingen registreret søvn.'),
      h('h3', null, 'Dagsform'), model.energy.count ? list('energy', model.energy.observations, row => `${f(row.value)} af 5`)
        : h('p', null, 'Ingen registreret energi.'),
      h('h3', null, 'Kost'),
      h('p', null, `${nutrition.loggedDays}/7 registrerede dage · ${nutrition.completeDays}/7 bekræftet komplette. Procent = gennemsnit registreret / gennemsnit dateret mål × 100 på de samme dage. Procenten er en sammenligning, ikke en anbefaling.`),
      list('kcal', nutrition.kcal.observations, row => `Energi ${f(row.value)} / ${f(row.target)} kcal · målversion ${row.targetVersion}`),
      list('protein', nutrition.protein.observations, row => `Protein ${f(row.value)} / ${f(row.target)} g · målversion ${row.targetVersion}`)))
}
