import { createElement as h } from 'react'
import { buildAthleteOverview } from './overview.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const value = (v, unit) => v === null ? 'Ukendt' : `${number.format(v)} ${unit}`
const coverage = (count, unit = 'dage') => `${count}/7 ${unit}`
const summaryStyle = { minHeight: 44, padding: '12px 0', cursor: 'pointer' }
const detail = (key, title, children, open = false) => h('details', { key, open },
  h('summary', { style: summaryStyle }, title), children)
const dated = (key, days, format) => h('ul', { key, style: { paddingInlineStart: 20 } },
  days.map(day => h('li', { key: day.date }, h('time', { dateTime: day.date }, day.date), ': ', format(day))))
const enough = (average, count, unit) => average !== null
  ? `${value(average, unit)} · ${coverage(count)}`
  : count === 0 ? 'Ingen registreringer i perioden · 0/7 dage'
    : `For lidt data: ${count} af mindst 4 dage · ${coverage(count)}`

function weekView(week, latest, wellbeingOnly) {
  return detail(week.from, `${latest ? 'Seneste 7 dage' : '7 dage'} · ${week.from}–${week.to}`,
    h('div', null,
      h('h3', null, 'Søvn, energi, stress og ømhed'),
      h('dl', null, week.wellbeing.map(field => h('div', { key: field.key },
        h('dt', null, field.label), h('dd', null, enough(field.average, field.count, field.unit))))),
      detail('daily', 'Se dine daglige svar', week.wellbeing.map(field => h('section', { key: field.key },
        h('h4', null, field.label), dated(field.key, field.days, day => value(day.value, field.unit))))),
      !wellbeingOnly && h('div', null,
      h('h3', null, 'Træning'),
      h('p', null, week.training.observedDays
        ? `${week.training.sets} registrerede sæt · ${value(week.training.tonnage, 'kg × gentagelser')} · ${coverage(week.training.observedDays, 'registrerede dage')}`
        : 'Ingen registreringer i perioden · 0/7 dage'),
      h('p', null, 'Kun registrerede sæt. Dage uden log er ukendte. Pas og hviledage er ikke bekræftet her.'),
      detail('training', 'Vis træningsgrundlag', [
        dated('sets', week.training.days, day => day.sets
          ? `${day.sets} sæt · ${value(day.tonnage, 'kg × gentagelser')}` : 'Ukendt'),
      ]),
      h('h3', null, 'Kost'),
      h('p', null, week.nutrition.loggedDays
        ? `${value(week.nutrition.kcal, 'kcal/dag')} · ${value(week.nutrition.protein, 'g protein/dag')} · ${coverage(week.nutrition.loggedDays, 'loggede dage')}`
        : 'Ingen registreringer i perioden · 0/7 dage'),
      h('p', null, 'Gennemsnit af loggede dage. Hele kostdage og historiske mål er ikke bekræftet.'),
      detail('nutrition', 'Vis kostgrundlag', week.nutrition.days.length
        ? dated('meals', week.nutrition.days, day => `${value(day.kcal, 'kcal')} · ${value(day.protein, 'g protein')}`)
        : h('p', null, 'Ingen registreringer i perioden')),
      h('h3', null, 'Vægt'),
      h('p', null, enough(week.weight.average, week.weight.count, 'kg')),
      detail('weight', 'Vis vægtgrundlag', dated('kg', week.weight.days, day => value(day.value, 'kg')))),
    ), latest)
}

/** Read-only view. Default OFF never reads snapshot data. */
export default function MineTal(props = {}) {
  if (props.enabled !== true) return null
  const model = buildAthleteOverview(props.snapshot, { enabled: true })
  if (model.status === 'loading') return h('section', { 'aria-label': 'Mine tal', 'aria-busy': true },
    props.showHeading !== false && h('h2', null, 'Mine tal'), h('p', { role: 'status' }, 'Henter dine registreringer…'))
  if (model.status === 'error') return h('section', { 'aria-label': 'Mine tal' },
    props.showHeading !== false && h('h2', null, 'Mine tal'), h('p', { role: 'alert' }, 'Kunne ikke hente hele perioden — prøv igen'),
    typeof props.onRetry === 'function' && h('button', { type: 'button', onClick: props.onRetry,
      style: { minHeight: 44, minWidth: 44 } }, 'Prøv igen'))
  return h('section', { 'aria-label': 'Mine tal', className: 'e2-track-atlet', style: { width: '100%', maxWidth: 560,
    minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', lineHeight: 1.5 } },
    h('style', null, '.e2-track-atlet summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}.e2-track-atlet dd{margin-inline-start:0}'),
    props.showHeading !== false && h('h2', null, 'Mine tal'), h('p', null, `4 uger · ${model.from}–${model.to}`),
    model.status === 'empty' && h('p', { role: 'status' }, 'Ingen registreringer i perioden'),
    [...model.weeks].reverse().map((week, i) => weekView(week, i === 0, props.wellbeingOnly === true)),
    props.wellbeingOnly !== true && detail('strength', 'Styrke · ugeestimater', h('div', null,
      h('p', null, 'e1RM i kg, estimeret fra registrerede tunge sæt. Kalenderuger kan være delvise. Ingen trendvurdering.'),
      model.strength.length
        ? h('ul', null, model.strength.map(lift =>
          h('li', { key: `${lift.name}-${lift.weekStart}` }, `${lift.name} · uge fra ${lift.weekStart}: ${value(lift.e1rm, 'kg e1RM')}`)))
        : h('p', null, 'Ingen kvalificerede registreringer i perioden'))))
}
