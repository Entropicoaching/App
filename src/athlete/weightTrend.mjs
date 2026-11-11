import { antalOrd } from '../entropi2/antalOrd.mjs'
import { dataEnoughEnabled, weightWindows, dataMessage } from '../dataEnough.mjs'
const kg = value => value.toFixed(1).replace('.', ',')
// Grupper efter antal registreringer, ikke kalenderuger. Input er datosorteret.
export function weightTrendText(sorted, today = new Date().toLocaleDateString('en-CA')) {
  if (dataEnoughEnabled()) {
    const w = weightWindows(sorted, today)
    if (!w.ready) return dataMessage('D46')
    const period = rs => [...new Set(rs.map(r => r.logged_at.slice(0, 10)))].sort()
    return `Observeret forskel: ${kg(w.diff)} kg. ${period(w.prior).join(', ')} (${w.prior.length} ${antalOrd(w.prior.length, 'vejning', 'vejninger')}) mod ${period(w.recent).join(', ')} (${w.recent.length} ${antalOrd(w.recent.length, 'vejning', 'vejninger')}).`
  }
  const split = Math.max(0, sorted.length - 7)
  const recent = sorted.slice(split)
  const prior = sorted.slice(Math.max(0, sorted.length - 14), split)
  if (recent.length < 2 || prior.length < 1) return null

  const average = rows => rows.reduce((sum, row) => sum + row.weight, 0) / rows.length
  const diff = average(recent) - average(prior)
  const change = Math.abs(diff) < 0.3 ? '= stabil'
    : diff > 0 ? `↑ +${kg(diff)} kg` : `↓ ${kg(Math.abs(diff))} kg`
  const date = day => day.split('-').reverse().join('.')
  const period = rows => `${date(rows[0].logged_at)} til ${date(rows[rows.length - 1].logged_at)} (${rows.length} ${antalOrd(rows.length, 'vejning', 'vejninger')})`
  return `${change}. Gennemsnit for ${period(recent)} sammenlignet med ${period(prior)}.`
}
