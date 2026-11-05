import { antalOrd } from '../../antalOrd.mjs'
export function nutritionReportView(h, props = {}) {
  const labels = [
    ['kcal', 'Energi', 'kcal'], ['protein', 'Protein', 'g'],
    ['carb', 'Kulhydrat', 'g'], ['fat', 'Fedt', 'g'],
  ]
  const number = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
  const dateLabel = value => new Intl.DateTimeFormat('da-DK', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'))
  const range = (from, through) => `${dateLabel(from)} – ${dateLabel(through)}`
  const card = { border: '1px solid currentColor', borderRadius: 12, padding: 16, minWidth: 0 }
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 17rem), 1fr))', gap: 16 }

  function MacroList({ entries, weekly = false }) {
    return h('dl', { style: { margin: 0 } }, ...labels.map(([key, label, unit]) => {
      const { actual, target, percent } = entries[key]
      return h('div', { key, style: { marginBlock: 12 } },
        h('dt', { style: { fontWeight: 600 } }, label),
        h('dd', { style: { margin: 0 } },
          `${actual === null ? 'Ukendt' : `${number(actual)} ${unit}`} registreret`,
          ' · ', target === null ? 'Mål mangler' : `${number(target)} ${unit} plan${weekly ? ' for loggede dage' : ''}`,
          ' · ', percent === null ? 'Procent kan ikke beregnes' : `${number(percent)} % af mål`))
    }))
  }

  function Weight({ weight }) {
    const change = weight.changeKg
    return h('section', { 'aria-label': 'Vægttrend', style: card },
      h('h3', null, 'Vægttrend'),
      h('p', null, range(weight.from, weight.through)),
      h('p', null, weight.average === null ? 'Ikke nok vejninger til et gennemsnit.'
        : `Gennemsnit: ${number(weight.average)} kg`),
      h('p', null, `${weight.days} af 7 dage med vejning. Mindst 3 forskellige dage kræves pr. periode.`),
      h('p', null, change === null ? 'Ændring fra forrige periode kan ikke beregnes.'
        : `Ændring fra forrige periode: ${change > 0 ? '+' : ''}${number(change)} kg`),
      h('p', null, `Forrige periode: ${range(weight.previousFrom, weight.previousThrough)} · ${weight.previousDays} af 7 dage med vejning.`),
      weight.daily.length > 0 && h('details', null,
        h('summary', { style: { minHeight: 44, cursor: 'pointer', paddingBlock: 12 } }, 'Se vejninger'),
        h('ul', null, ...weight.daily.map(row => h('li', { key: row.date }, `${dateLabel(row.date)}: ${number(row.kg)} kg`)))))
  }

  function Day({ day }) {
    const entries = Object.fromEntries(labels.map(([key]) => [key, {
      actual: day.totals[key], target: day.targets[key], percent: day.percentages[key],
    }]))
    return h('section', { 'aria-label': dateLabel(day.date), style: { ...card, marginTop: 12 } },
      h('h4', null, h('time', { dateTime: day.date }, dateLabel(day.date))),
      day.future ? h('p', null, 'Kommende dag · ikke med i opgørelsen.') : h('div', null,
        day.planState === 'none' && h('p', null, 'Ingen aktiveret plan for dagen.'),
        day.planState === 'conflict' && h('p', { role: 'alert' }, 'Flere planer er aktiveret for dagen. Mål kan ikke sammenlignes.'),
        day.logState === 'missing' ? h('div', null,
          h('p', null, 'Ingen kostlog · dagens indtag er ukendt.'),
          day.planState === 'active' && h('dl', null, ...labels.map(([key, label, unit]) => h('div', { key },
            h('dt', null, label), h('dd', { style: { margin: 0 } }, day.targets[key] === null
              ? 'Mål mangler' : `${number(day.targets[key])} ${unit} plan`)))))
          : h('div', null,
            h('p', null, `${day.mealCount} ${antalOrd(day.mealCount, 'registreret måltid', 'registrerede måltider')}.`),
            day.logState === 'unknown' && h('p', { role: 'alert' }, 'Nogle næringsdata mangler. Ukendte tal vises ikke som nul.'),
            h(MacroList, { entries }))))
  }

  /** Presentational only; caller owns loading, access checks and retry. */

    if (props.enabled !== true) return null
    const { state = 'ready', onRetry } = props
    if (state === 'loading') return h('p', { role: 'status', 'aria-busy': true }, 'Henter kostrapport…')
    if (state !== 'ready') return h('div', null,
      h('p', { role: 'alert' }, 'Kostrapporten kunne ikke hentes. Prøv igen.'),
      typeof onRetry === 'function' && h('button', { type: 'button', onClick: onRetry,
        style: { minHeight: 44, minWidth: 44 } }, 'Hent rapporten igen'))
    const report = props.report
    if (!report) return h('p', { role: 'alert' }, 'Kostrapporten er ikke tilsluttet.')
    const active = report.comparison === 'active-plan'
    return h('section', { 'aria-label': 'Kostrapport for én atlet',
      style: { maxWidth: '64rem', width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 16, overflowWrap: 'anywhere' } },
      h('h2', null, 'Plan og registreret kost'),
      h('p', null, `${active ? 'Seneste 7 dage' : 'Uge'}: ${range(report.from, report.through)}`),
      h('p', null, `Opgjort til og med ${dateLabel(report.date)}.`),
      active && h('p', null, 'Den aktive plans dagsmål er reference for perioden. Tidligere planmål er ikke med i sammenligningen.'),
      h('div', { style: grid },
        h('section', { 'aria-label': active ? 'Periodens kost' : 'Ugens kost', style: card },
          h('h3', null, active ? 'Periodens kost' : 'Ugens kost'),
          h('p', null, `${report.week.loggedDays} af ${report.week.elapsedDays} ${antalOrd(report.week.elapsedDays, 'dag', 'dage')} med kostlog · ${report.week.missingDays} uden log.`),
          !active && h('p', null, `${report.week.plannedDays} af ${report.week.elapsedDays} ${antalOrd(report.week.elapsedDays, 'dag', 'dage')} med entydig aktiveret plan.`),
          report.week.conflictDays > 0 && h('p', { role: 'alert' }, 'Planhistorikken overlapper. Berørte mål kan ikke sammenlignes.'),
          report.week.unknownDays > 0 && h('p', { role: 'alert' }, 'Nogle loggede dage har ukendte næringsdata.'),
          report.week.loggedDays === 0 ? h('p', null, 'Der er ingen kostlog i perioden. Indtaget er ukendt.')
            : h(MacroList, { entries: report.week.metrics, weekly: true }),
          h('p', null, active
            ? 'Periodens tal og procenter gælder kun loggede dage sammenholdt med den aktive plans dagsmål. Kostloggen fortæller ikke, om hele dagens indtag er registreret.'
            : 'Ugens tal og procenter gælder kun loggede dage og deres planmål. Kostloggen fortæller ikke, om hele dagens indtag er registreret.')),
        !active && h(Weight, { weight: report.weight })),
      h('details', { style: { marginTop: 16 } },
        h('summary', { style: { minHeight: 44, cursor: 'pointer', paddingBlock: 12 } }, 'Se dage og planmål'),
        ...report.days.map(day => h(Day, { key: day.date, day }))))
}
