// Grupper efter antal registreringer, ikke kalenderuger. Input er datosorteret.
export function weightTrendText(sorted) {
  const split = Math.max(0, sorted.length - 7)
  const recent = sorted.slice(split)
  const prior = sorted.slice(Math.max(0, sorted.length - 14), split)
  if (recent.length < 2 || prior.length < 1) return null

  const average = rows => rows.reduce((sum, row) => sum + row.weight, 0) / rows.length
  const diff = average(recent) - average(prior)
  const change = Math.abs(diff) < 0.3 ? '= stabil'
    : diff > 0 ? `↑ +${diff.toFixed(1)} kg` : `↓ ${Math.abs(diff).toFixed(1)} kg`
  const date = day => day.split('-').reverse().join('.')
  const period = rows => `${date(rows[0].logged_at)} til ${date(rows[rows.length - 1].logged_at)} (${rows.length} ${rows.length === 1 ? 'vejning' : 'vejninger'})`
  return `${change}. Gennemsnit for ${period(recent)} sammenlignet med ${period(prior)}.`
}
