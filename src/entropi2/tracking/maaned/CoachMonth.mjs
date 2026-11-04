import { createElement as h } from 'react'
import { buildMonthReport } from './monthReportModel.mjs'

const number = n => n === null ? 'Ukendt' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(n)
const summary = { minHeight: 44, padding: '12px 0', cursor: 'pointer', boxSizing: 'border-box' }
const box = { border: '1px solid #71877a', borderRadius: 12, padding: 12, minWidth: 0 }
const names = { training: 'Træning', nutrition: 'Kost', weight: 'Vægt', readiness: 'Dagsformscore (0–100)' }
const values = (weeks, select, unit) => weeks.map((w, i) => `Uge ${i + 1}: ${number(select(w))}${unit}`).join(' · ')

/** Read-only, unwired React view. No hooks, requests, clock or persistence. */
export default function CoachMonth(options = {}) {
  if (options?.enabled !== true) return null
  const { snapshot, onRetry } = options
  const model = buildMonthReport(snapshot, { enabled: true })
  const props = { 'aria-label': 'Månedsrapport', style: { color: '#f0f4f1', background: '#101815',
    padding: 12, borderRadius: 16, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' } }
  if (model.status === 'loading') return h('section', { ...props, 'aria-busy': true },
    h('h2', null, 'Månedsrapport'), h('p', { role: 'status' }, 'Henter fire ugers datagrundlag …'))
  if (model.status === 'error') return h('section', props, h('h2', null, 'Månedsrapport'),
    h('p', { role: 'alert' }, 'Hele datagrundlaget kunne ikke bekræftes. Prøv igen.'),
    typeof onRetry === 'function' && h('button', { type: 'button', onClick: onRetry, style: summary }, 'Prøv igen'))
  return h('section', props,
    h('h2', null, 'Månedsrapport'), h('p', null, `${model.from} – ${model.to} · fire perioder à syv dage`),
    h('p', null, model.status === 'empty' ? 'Ingen registreringer i perioden.'
      : model.flags.length ? `${model.flags.length} flag til coachens gennemgang.` : 'Ingen flag i de tilgængelige data.'),
    h('p', null, 'Manglende data er ukendt, ikke nul. Ingen flag betyder ikke, at datagrundlaget er tilstrækkeligt.'),
    ...model.flags.map(flag => h('section', { key: flag.id, style: box }, h('h3', null, flag.title),
      h('p', null, flag.dataBasis.rule), h('details', null, h('summary', { style: summary }, 'Vis flagets datagrundlag'),
        h('p', null, `${flag.dataBasis.from} – ${flag.dataBasis.to}`),
        h('ul', null, ...flag.dataBasis.observations.map((o, i) => h('li', { key: i },
          `${o.from} – ${o.to}: ${number(o.value)} ${o.unit}${o.count === undefined ? '' : ` · grundlag ${o.count}`}`)))))),
    h('h3', null, 'Styrke pr. hovedløft'),
    h('p', null, 'Bedste estimerede 1RM pr. periode (kg). Beregnet fra registrerede tunge sæt; varianter vises hver for sig. Skippede sæt og deload indgår ikke.'),
    h('ul', null, ...model.strength.map(lift => h('li', { key: lift.key },
      `${lift.name}: ${lift.values.map(number).join(' → ')} kg e1RM`))),
    h('h3', null, 'Gennemførte pas'),
    h('ul', null, ...model.weeks.map((w, i) => h('li', { key: w.from },
      `Uge ${i + 1} (${w.from} – ${w.to}): ${w.sessions.completed} gennemførte · ${w.sessions.completedPlanned}/${w.sessions.planned} planlagte · ${w.sessions.extra} ekstra`))),
    h('details', null, h('summary', { style: summary }, 'Volumen og intensitet'),
      h('p', null, values(model.weeks, w => w.training.tonnage, ' kg × reps')),
      h('p', null, values(model.weeks, w => w.training.sets, ' registrerede sæt')),
      h('p', null, 'Volumen er registreret tonnage, ikke planlagt volumen. Tomme perioder er ukendte.'),
      ...model.weeks.map((w, i) => h('section', { key: w.from }, h('h4', null, `Uge ${i + 1}`),
        h('p', null, `${w.intensity.classified} klassificerede sæt · ${w.intensity.unknown} sæt med ukendt intensitet`),
        h('ul', null, ...w.intensity.zones.map(z => h('li', { key: z.key },
          `${z.label}: ${z.count} sæt · ${w.intensity.classified ? number(z.count / w.intensity.classified * 100) + ' %' : 'Ukendt andel'}`))))),
      h('p', null, 'Intensitet: vægt i procent af en uafhængig e1RM-reference for samme løft og variant. Andele gælder kun klassificerede sæt.')),
    h('details', null, h('summary', { style: summary }, 'Kost- og vægttrend'),
      h('p', null, 'Ugegennemsnit af registrerede kostdage; ufuldstændige måltider kan give ukendt. Ingen sammenligning med mål eller påstand om komplette kostdage.'),
      h('p', null, values(model.weeks, w => w.nutrition.kcal, ' kcal/dag')),
      h('p', null, values(model.weeks, w => w.nutrition.protein, ' g protein/dag')),
      h('p', null, values(model.weeks, w => w.nutrition.loggedDays, '/7 kostdage')),
      h('p', null, 'Vægt: mindst fire målte datoer pr. periode. Ingen udfyldning af huller.'),
      h('p', null, values(model.weeks, w => w.weight.average, ' kg')),
      h('p', null, values(model.weeks, w => w.weight.count, '/7 vægtdage'))),
    h('details', null, h('summary', { style: summary }, 'Dagsform'),
      h('p', null, 'Gennemsnit kræver mindst fire kendte dage pr. felt pr. periode.'),
      ...model.weeks[0].wellbeing.map(field => h('section', { key: field.key }, h('h4', null, `${field.label} · ${field.unit}`),
        h('p', null, values(model.weeks, w => w.wellbeing.find(f => f.key === field.key).average, '')),
        h('p', null, values(model.weeks, w => w.wellbeing.find(f => f.key === field.key).count, '/7 kendte dage'))))),
    h('details', null, h('summary', { style: summary }, 'Tracking og datakvalitet'),
      h('p', null, 'Gyldige / manglende / ugyldige dage ud af syv. Registrerede trænings- og kostdage beviser ikke komplette pas eller måltider. Dagsformscore er et særskilt felt og erstatter ikke dækningen ved hvert dagsformsgennemsnit.'),
      ...model.weeks.map((w, i) => h('section', { key: w.from }, h('h4', null, `Uge ${i + 1}`),
        h('ul', null, ...Object.entries(w.basis).map(([key, b]) => h('li', { key },
          `${names[key]}: ${b.validDays} / ${b.missingDays} / ${b.invalidDays}`)))))),
    h('p', null, 'Coachen vurderer og planlægger. Ingen automatiske programændringer.'))
}
