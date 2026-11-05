import { createElement as h } from 'react'
import { buildRestitution } from './restitutionModel.mjs'

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
const metric = (title, value, unit) => h('div', { key: title }, h('dt', null, title),
  h('dd', null, value.average === null ? `For lidt data · ${value.count}/7 dage`
    : `${number.format(value.average)} ${unit} · ${value.count}/7 dage`))
const training = (title, bucket) => h('p', null,
  `${title} (${bucket.from}–${bucket.to}): ${bucket.tonnage === null ? 'Ukendt belastning'
    : `${number.format(bucket.tonnage)} kg × gentagelser`} · ${bucket.sets} sæt på ${bucket.recordedDays}/7 dage.`)
const styles = `
.e2-restitution{width:100%;max-width:640px;min-width:0;box-sizing:border-box;overflow-wrap:anywhere;line-height:1.5;color:inherit}
.e2-restitution *{box-sizing:border-box}.e2-restitution p{margin:8px 0 16px}
.e2-restitution dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.e2-restitution dd{margin:4px 0 0}.e2-restitution summary{min-height:44px;padding:12px 0;cursor:pointer;font-weight:600}
.e2-restitution button{min-height:44px;padding:10px 16px;font:inherit}
.e2-restitution summary:focus-visible,.e2-restitution button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media(max-width:360px){.e2-restitution dl{grid-template-columns:1fr}}
`

/** Stateless, explicitly enabled React view. Host owns identity, reads/retry and
 * date. No entry-point import, fetching, storage, program changes or writes.
 */
export default function RestitutionOverview(props = {}) {
  if (props.enabled !== true) return null
  const coach = props.audience === 'coach'
  const model = buildRestitution(props.snapshot, { enabled: true })
  const section = (...children) => h('section', { className: 'e2-restitution', 'aria-label': 'Restitution' },
    h('style', null, styles), !coach && h('h2', null, 'Restitution'), ...children)
  if (model.status === 'loading') return section(h('p', { role: 'status', 'aria-busy': true }, 'Henter registreringer…'))
  if (model.status === 'error') return section(
    h('p', { role: 'alert' }, 'Kunne ikke vise hele datagrundlaget. Prøv igen.'),
    typeof props.onRetry === 'function' && h('button', { type: 'button', onClick: props.onRetry }, 'Prøv igen'))
  return section(
    h('p', { role: 'status' }, model.status === 'insufficient' ? 'For lidt data'
      : `Forsigtig restitutionsstatus: ${{ god: 'God', ok: 'Ok', lav: 'Lav' }[model.level]}`),
    h('p', null, `Til og med ${model.to} · seneste 7 dage med 14 dages belastningshistorik.`),
    h('p', null, `Et enkelt overblik over registreringer, ikke en måling af ${coach ? 'atletens' : 'din'} restitution eller en forklaring på årsager. Programmet ændres ikke.`),
    h('details', null, h('summary', null, 'Se datagrundlag og vurdering'),
      h('p', null, `Søvn og dagsform (${model.recentFrom}–${model.to}) fra ${coach ? 'atletens' : 'dine'} egne svar i dagsform.`),
      h('dl', null,
        metric('Søvn', model.metrics.sleep_hours, 'timer'),
        metric('Energi', model.metrics.energy, 'af 5'),
        metric('Stress', model.metrics.stress, 'af 5'),
        metric('Ømhed', model.metrics.soreness_level, 'af 5')),
      h('p', null, model.latestCompleteDate ? `Seneste komplette dagsform: ${model.latestCompleteDate}.`
        : 'Ingen komplet dagsform i de seneste 7 dage.'),
      !model.fresh && h('p', null, 'Der mangler en komplet dagsform fra periodens sidste to dage.'),
      training('Seneste 7 dage', model.load.recent), training('De foregående 7 dage', model.load.previous),
      h('p', null, model.load.ratio === null ? 'For lidt data til at sammenligne belastning.'
        : `Registreret belastning: ${number.format(model.load.ratio)} gange de foregående 7 dage.`),
      h('p', null, 'Belastning er kg × udførte gentagelser fra registrerede sæt. Manglende dage er ukendte, ikke bekræftede hviledage. Øvelsesvalg og registreringsdækning kan ændre totalen.'),
      model.invalidMeasurements > 0 && h('p', null, `${model.invalidMeasurements} ugyldige dagsformmålinger tæller som ukendte.`),
      model.load.uncertainSets > 0 && h('p', null, `${model.load.uncertainSets} usikre sætrækker forhindrer sammenligning af belastning.`),
      model.load.excludedSets > 0 && h('p', null, `${model.load.excludedSets} foreløbige eller oversprungne sætrækker er udeladt.`),
      h('p', null, 'Status kræver mindst 4/7 dage for hver dagsformmåling, en komplet dagsform fra de sidste to dage og mindst 2 registrerede træningsdage i hver uge. Den foregående belastning skal være over nul. Huller udfyldes ikke.'),
      h('p', null, 'Enkle, ikke klinisk validerede grænser for ugegennemsnit: Lav ved søvn under 6 timer, energi højst 2/5, stress mindst 4/5 eller ømhed mindst 4/5. God ved søvn mindst 7 timer, energi mindst 4/5, stress og ømhed højst 2/5 og belastning højst 1,2 gange den foregående uge. Ellers Ok. Øget belastning alene giver ikke Lav.')))
}
