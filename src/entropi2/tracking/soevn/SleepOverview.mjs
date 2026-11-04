import { createElement as h } from 'react'
import { buildSleepOverview } from './sleepModel.mjs'
import { SLEEP_ADVICE, SLEEP_SOURCE } from './sleepAdvice.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const value = (v, unit) => v === null ? 'Ukendt' : `${number.format(v)} ${unit}`
const date = d => `${d.slice(8, 10)}.${d.slice(5, 7)}`
const range = (from, to) => `${date(from)}–${date(to)}`
const weekly = (metric, unit) => metric.average !== null
  ? `${value(metric.average, unit)} · ${metric.count}/7 dage`
  : metric.count ? `For lidt data · ${metric.count}/7 dage` : 'Ukendt · 0/7 dage'
const detail = (key, title, children) => h('details', { key }, h('summary', null, title), children)
const styles = `
.e2-sleep{width:100%;max-width:640px;min-width:0;box-sizing:border-box;overflow-wrap:anywhere;line-height:1.55;color:inherit}
.e2-sleep *{box-sizing:border-box}.e2-sleep p{margin:8px 0 16px}
.e2-sleep .e2-sleep-weeks,.e2-sleep .e2-sleep-days,.e2-sleep .e2-sleep-sessions{list-style:none;padding:0;margin:0}
.e2-sleep .e2-sleep-week{border:1px solid currentColor;border-radius:12px;padding:14px;margin:12px 0}
.e2-sleep h3{font-size:1rem;margin:0 0 8px}.e2-sleep dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}
.e2-sleep dt{font-size:.9rem}.e2-sleep dd{margin:4px 0 0;font-weight:600}
.e2-sleep summary{min-height:44px;padding:12px 0;cursor:pointer;font-weight:600}
.e2-sleep summary:focus-visible,.e2-sleep button:focus-visible,.e2-sleep a:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.e2-sleep button,.e2-sleep a{min-height:44px;display:inline-flex;align-items:center}
.e2-sleep button{padding:10px 16px;font:inherit}.e2-sleep li.e2-sleep-day,.e2-sleep li.e2-sleep-session{padding:12px 0;border-bottom:1px solid currentColor}
.e2-sleep a{color:inherit;text-underline-offset:3px}
@media(max-width:360px){.e2-sleep dl{grid-template-columns:1fr}}
`

/** Stateless React component. Opt in explicitly; host owns period/retry state.
 * Not imported by any entry point. No data access, storage or writes here.
 */
export default function SleepOverview(props = {}) {
  if (props.enabled !== true) return null
  const model = buildSleepOverview(props.snapshot, { enabled: true, weeks: props.weeks })
  const section = (...children) => h('section', { className: 'e2-sleep', 'aria-label': 'Søvn over tid' },
    h('style', null, styles), h('h2', null, 'Søvn over tid'), ...children)
  if (model.status === 'loading') return section(
    h('p', { role: 'status', 'aria-busy': true }, 'Henter dine søvnregistreringer…'))
  if (model.status === 'error') return section(
    h('p', { role: 'alert' }, 'Kunne ikke vise hele perioden. Prøv igen.'),
    typeof props.onRetry === 'function' && h('button', { type: 'button', onClick: props.onRetry }, 'Prøv igen'))
  return section(
    h('p', null, `${model.weeks.length} uger · ${model.from}–${model.to}`),
    model.status === 'empty' && h('p', { role: 'status' }, model.invalidMeasurements
      ? 'Ingen gyldige søvnmålinger i perioden.' : 'Ingen søvnregistreringer i perioden endnu.'),
    model.invalidMeasurements > 0 && h('p', { role: 'status' },
      `${model.invalidMeasurements} registreringer havde ugyldige søvnmålinger og vises som ukendte.`),
    h('p', null, 'Ugegennemsnit kræver mindst 4 registrerede dage for hver måling. Huller tæller ikke som nul.'),
    h('ol', { className: 'e2-sleep-weeks' }, [...model.weeks].reverse().map((week, index) =>
      h('li', { key: week.from, className: 'e2-sleep-week' },
        h('h3', null, `${index === 0 ? 'Seneste 7 dage · ' : ''}${range(week.from, week.to)}`),
        h('dl', null,
          h('div', null, h('dt', null, 'Søvntimer'), h('dd', null, weekly(week.hours, 'timer'))),
          h('div', null, h('dt', null, 'Søvnkvalitet'), h('dd', null, weekly(week.quality, 'af 5'))))))),
    detail('days', 'Se daglige registreringer', h('div', null,
      h('p', null, 'Timer fra dagsform; kvalitet fra din søvnregistrering (1–5). Ukendt betyder manglende eller ugyldig måling. Ingen kvalitet udledes af energi eller dagsformscore.'),
      h('ul', { className: 'e2-sleep-days' }, [...model.days].reverse().map(d =>
        h('li', { key: d.date, className: 'e2-sleep-day' }, h('time', { dateTime: d.date }, d.date),
          h('div', null, `Søvn: ${value(d.hours, 'timer')} · Kvalitet: ${value(d.quality, 'af 5')}`)))))),
    detail('training', 'Søvn og dine pas', h('div', null,
      h('p', null, 'Registreringer på samme dato i dansk tid. Søvnens og passets indbyrdes tidspunkt er ikke bekræftet. Det viser ikke, at søvn er årsagen til et resultat; program, belastning og andre forhold kan også spille ind.'),
      h('p', null, `${model.pairedRpeDays} dage med både søvntimer og RPE · ${model.pairedPerformanceDays} dage med både søvntimer og præstationsestimat.`),
      h('p', null, 'RPE er gennemsnittet af dine egne svar på registrerede sæt i hvert pas, ikke en samlet pasvurdering. Dækningen vises som besvarede sæt ud af registrerede sæt.'),
      h('p', null, 'Præstation vises som højeste estimerede 1RM (Epley) pr. hovedløft i passet, fra tunge sæt med 1–8 gentagelser. Det er et estimat, ikke en test af dit maksimum. Varianter, lette sæt og deload indgår ikke.'),
      model.excludedSets > 0 && h('p', null, `${model.excludedSets} sætrækker er udeladt, fx foreløbige, dubletter med konflikt eller uden sikker pasidentitet.`),
      model.sessions.length ? h('ul', { className: 'e2-sleep-sessions' }, model.sessions.map((s, index) =>
        h('li', { key: index, className: 'e2-sleep-session' },
          h('time', { dateTime: s.date }, s.date), ` · Pas ${index + 1}`,
          h('div', null, `Søvn: ${value(s.hours, 'timer')} · Kvalitet: ${value(s.quality, 'af 5')}`),
          h('div', null, `RPE: ${value(s.rpe, 'af 10')} · ${s.ratedSets}/${s.sets} sæt`),
          s.performance.length ? h('ul', null, s.performance.map(p => h('li', { key: p.lift },
            `${p.lift}: ${value(p.e1rm, 'kg e1RM')}`)))
            : h('div', null, 'Intet kvalificeret præstationsestimat'))))
        : h('p', null, 'Ingen bekræftede pasregistreringer i perioden.'))),
    detail('advice', 'Tre enkle søvnråd til styrketræning', h('div', null,
      h('ul', null, SLEEP_ADVICE.map(tip => h('li', { key: tip }, tip))),
      h('p', null, 'Generelle råd til atleter; ingen garanti for et bestemt løfteresultat.'),
      h('a', { href: SLEEP_SOURCE.href, target: '_blank', rel: 'noopener noreferrer' },
        `${SLEEP_SOURCE.authors} (${SLEEP_SOURCE.year}): ${SLEEP_SOURCE.title}`))))
}
