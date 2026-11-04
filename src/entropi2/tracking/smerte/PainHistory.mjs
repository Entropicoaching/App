import { createElement as h } from 'react'
import { buildPainHistory } from './painModel.mjs'

const number = n => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(n)
const dated = row => `${row.day}: ${row.value}/10`
const block = { padding: '1rem', border: '1px solid currentColor', borderRadius: '8px', minWidth: 0 }
const disclosure = { minHeight: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center' }

/** Unwired coach view. Literal enabled=true required; no reads while OFF. */
export default function PainHistory(props = {}) {
  if (props.enabled !== true) return null
  const model = buildPainHistory({ enabled: true, data: props.data, weeks: props.weeks })
  const shell = (...children) => h('section', {
    'aria-label': 'Smerte pr. kropsområde',
    style: { display: 'grid', gap: '1rem', minWidth: 0, overflowWrap: 'anywhere' },
  }, h('h2', null, 'Smerte pr. kropsområde'), ...children)
  if (model.state === 'loading') return shell(h('p', { role: 'status', 'aria-busy': true }, 'Henter smertehistorik…'))
  if (model.state === 'error') return shell(h('p', { role: 'alert' },
    'Smertehistorikken kunne ikke vises. Data mangler, er ufuldstændige eller kunne ikke hentes.'),
  typeof props.onRetry === 'function' ? h('button', { type: 'button', onClick: props.onRetry,
    style: { minHeight: '44px' } }, 'Prøv igen') : null)
  return shell(
    h('p', null, `${model.weeks} uger · ${model.from}–${model.to} · atletens egne indtastninger (0–10).`),
    h('p', null, `${model.absentDays} dage uden dagsformdata · ${model.missingDays} dage uden smertetal · ${model.unlocatedDays} dage med 0 uden kropsområde. Huller er ukendte, ikke 0.`),
    model.state === 'empty' ? h('p', null, 'Ingen indtastet smerte med kropsområde i perioden.') : null,
    ...model.areas.map(area => h('article', { key: area.name, style: block, 'aria-label': area.name },
      h('h3', null, area.name),
      h('p', null, `Senest ${dated(area.latest)} · ${area.count} registrerede dage i perioden.`),
      area.high.length ? h('div', null,
        h('strong', null, 'Flag: smerte 7+'),
        h('p', null, `Datagrundlag: ${area.high.length} af ${area.count} registrerede dage i ${model.from}–${model.to}: ${area.high.map(dated).join('; ')}. Regel: mindst én indtastning ≥7/10.`)) : null,
      area.rising ? h('div', null,
        h('strong', null, 'Flag: stigende tendens'),
        h('p', null, `Datagrundlag: ${area.trend.previousFrom}–${area.trend.previousTo}: ${number(area.trend.before)}/10 (${area.trend.previous.length} dage); ${area.trend.recentFrom}–${area.trend.recentTo}: ${number(area.trend.after)}/10 (${area.trend.recent.length} dage). Regel: middel stiger mindst 2 point, mindst 3 dage i hvert 14-dages vindue.`),
        h('p', null, [...area.trend.previous, ...area.trend.recent].map(dated).join('; '))) : null,
      !area.trend.sufficient ? h('p', null, `For lidt data til tendens: ${area.trend.previous.length} og ${area.trend.recent.length} dage; mindst 3 i hvert af de seneste to 14-dages vinduer.`)
        : !area.rising ? h('p', null, 'Ingen stigende tendens efter den beskrevne regel.') : null,
      !area.high.length && !area.rising ? h('p', null, 'Ingen flag efter reglerne; det er ikke en vurdering af helbred.') : null,
      area.high.length || area.rising ? h('p', null, 'Forslag til samtale: Hvordan oplever du smerten i området, og hvad har ændret sig siden sidst?') : null,
      h('details', null,
        h('summary', { style: disclosure }, 'Ugehistorik og alle indtastninger'),
        h('ul', null, ...area.history.map(week => h('li', { key: week.from },
          `${week.from}–${week.to}: ${week.count ? `middel ${number(week.average)}/10 · ${week.count}/7 dage` : 'Ingen indtastninger'}`))),
        h('ul', null, ...area.observations.map(row => h('li', { key: row.day },
          h('time', { dateTime: row.day }, row.day), `: ${row.value}/10`))))
    )),
    h('details', null, h('summary', { style: disclosure }, 'Sådan læses historikken'),
      h('p', null, '7+ markerer enhver indtastning på mindst 7 i den viste periode. Stigende tendens sammenligner middel i de seneste 14 dage med de foregående 14 dage: mindst 2 point op og mindst 3 registrerede dage pr. vindue for samme område. Ugemidler bruger kun indtastede dage. Ømhed på 1–5 omregnes aldrig til smerte. Flag er anledning til samtale, ikke diagnoser eller behandlingsråd.')))
}
