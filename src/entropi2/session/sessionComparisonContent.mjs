const decimal = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 10 })
const date = new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', year: 'numeric' })
const heavy = set => `${decimal.format(set.weight)} kg × ${set.reps}`
const count = n => `${n} ${n === 1 ? 'bekræftet' : 'bekræftede'} sæt`

// Shared by the production DOM renderer and real React rendering tests.
export function sessionComparisonContent(h, comparisons) {
  if (!comparisons.length) return null
  return h('section', { 'aria-label': 'Sammenligning med sidst', 'data-session-comparison': '' },
    h('h2', null, 'Sammenlignet med sidst'),
    ...comparisons.map(item => h('section', { key: item.exerciseId },
      h('h3', null, item.name),
      h('p', null, item.before.count === item.current.count
        ? `Sidst ${date.format(new Date(`${item.previousDate}T12:00:00Z`))}: ${count(item.before.count)} · Nu i dag: ${count(item.current.count)}`
        : `Sidst ${date.format(new Date(`${item.previousDate}T12:00:00Z`))} · ${item.before.count} sæt sidst, ${item.current.count} sæt i dag (bekræftede).`),
      h('p', null, `Tungeste sæt: ${heavy(item.before.heaviest)} → ${heavy(item.current.heaviest)}`),
      h('p', null, item.before.count === item.current.count
        ? `Samlet volumen: ${decimal.format(item.before.volume)} kg → ${decimal.format(item.current.volume)} kg`
        : 'Forskelligt antal sæt. Samlet volumen sammenlignes ikke.'))),
    h('p', null, 'Før → nu. Volumen er vægt × gentagelser og vises kun ved samme antal bekræftede sæt.'))
}
