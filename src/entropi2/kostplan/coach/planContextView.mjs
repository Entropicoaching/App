import { GOALS, number } from './model.mjs'
import { profileCalculation, profileTraining } from './gramPlan.mjs'
import { control } from './formStyles.mjs'

const format = (value, unit) => {
  const n = number(value)
  return n === null ? 'ukendt' : `${n.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ${unit}`
}
const macros = value => value
  ? `${format(value.kcal, 'kcal')} · ${format(value.protein, 'g protein')} · ${format(value.carb, 'g kulhydrat')} · ${format(value.fat, 'g fedt')}`
  : 'ukendt'
const volumeLabels = { rest: 'hvile', light: 'lav', moderate: 'moderat', high: 'høj' }
const intensityLabels = { light: 'lav', moderate: 'moderat', high: 'høj' }

// Mounted in the existing editor. Notes belong only to this open draft: no
// inferred profile fields, automatic food filtering, storage or calculation.
export function planContextView(h, { athlete, date, snapshot: s, notes, onNote }) {
  const calculation = profileCalculation(athlete, date)
  const training = profileTraining(athlete?.training)
  const age = number(athlete?.age, 120)
  const row = (key, title, text) => [h('dt', { key: `${key}-title` }, title), h('dd', { key }, text)]
  return h('section', { 'aria-label': 'Mål og plangrundlag', style: { padding: '1rem', overflowWrap: 'anywhere' } },
    h('h3', null, 'Mål og plangrundlag'),
    h('dl', null,
      ...row('coach', 'Aktuelt coachmål fra profilen',
        `${Object.hasOwn(GOALS, athlete?.goal) ? GOALS[athlete.goal] : 'ukendt'} · ${format(athlete?.kcal_target, 'kcal')} · ${format(athlete?.protein_target, 'g protein')}`),
      ...row('draft', 'Mål valgt i kladden', GOALS[s.form.goal] ?? 'ukendt'),
      ...row('suggestion', 'Separat beregningsforslag', s.calculated ? macros(s.suggestion) : 'Ikke tilgængeligt fra profilen; manuelle mål angives nedenfor.'),
      ...row('portions', 'Planens aktuelle portionssum', macros(s.totals))),
    h('p', null, 'Coachmålet, beregningsforslaget og portionssummen er forskellige referencer. Profilens coachmål ændres ikke af generering.'),
    h('p', { 'data-plan-training': training ? 'supplied' : 'unknown' }, training
      ? `Træningsbelastning: bekræftet input (eksplicit oplyst volumen/intensitet): ${volumeLabels[training.volume]}/${intensityLabels[training.intensity]}.${calculation ? ' Bruges i profilberegningen.' : ' Profilberegningen er ikke tilgængelig.'}`
      : 'Træningsbelastning: ukendt. Intet gyldigt, eksplicit input om både volumen og intensitet. Modellens antagede hviledag er ikke bekræftet træningsdata.'),
    !calculation && h('p', null, age === null ? 'Alder: ukendt. Voksenstatus er ikke bekræftet; profilberegningen er ikke tilgængelig.'
      : 'Profilberegningen kræver gyldig alder på mindst 18 år, kropsvægt, mål og dato.'),
    h('fieldset', { disabled: Boolean(s.busy), style: { minWidth: 0 } },
      h('legend', null, 'Coachens praktiske kladdenoter'),
      h('p', null, 'Kun i denne åbne kladde. Noterne gemmes ikke med planen og deles ikke med atleten. Brug dem til manuel gennemgang og ret fødevarer, placering og portioner nedenfor.'),
      ...[['preferences', 'Præferencer og måltidsplacering', 'Ingen automatisk tilpasning efter præferencer.'],
        ['allergies', 'Allergier og fravalg', 'Allergendata er ikke verificeret. Ingen automatisk allergikontrol eller garanti; kontrollér de valgte fødevarer manuelt.'],
        ['budget', 'Budget og praktiske rammer', 'Coachens ramme; aktuelle priser og automatisk budgetkontrol er ikke tilgængelige.']]
        .map(([key, title, status]) => h('div', { key, style: { marginBottom: 12 } },
          h('label', null, title, h('textarea', { name: `plan-note-${key}`, style: { ...control, width: '100%' },
            maxLength: 600, rows: 2, value: notes[key], onChange: e => onNote(key, e.currentTarget.value) })),
          h('p', null, status)))))
}
