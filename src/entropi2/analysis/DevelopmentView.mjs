import { createElement as h } from 'react'
import { developmentModel, developmentNumber as number, developmentDate as date } from './developmentModel.mjs'

const text = value => h('p', { style: { lineHeight: 1.6 } }, value)
const summaryStyle = { minHeight: 44, paddingTop: 12, boxSizing: 'border-box', cursor: 'pointer' }
const card = { border: '1px solid #414139', borderRadius: 16, padding: 16, marginBottom: 16, minWidth: 0 }
const compactDate = day => `${day.slice(8, 10)}.${day.slice(5, 7)}`
const palette = ['#d8b16b', '#8ab5bc', '#bca1d5', '#98b786', '#da9d8e']
function loadChart(model, title, value, unit) {
  const max = Math.max(1, ...model.weeks.map(w => value(w) ?? 0))
  return h('figure', { 'aria-label': title, style: { margin: '16px 0' } },
    h('figcaption', null, title),
    h('div', { role: 'img', 'aria-label': `${title}. Tal og manglende målinger står i tabellen nedenfor.`,
      style: { display: 'grid', gridTemplateColumns: 'repeat(26, minmax(0, 1fr))', gap: 2, height: 56, alignItems: 'end', marginTop: 8 } },
      ...model.weeks.map(w => h('span', { key: w.start, 'aria-hidden': 'true',
        title: `${date(w.start)}: ${value(w) === null ? 'Ukendt' : `${number(value(w))} ${unit}`}`,
        style: { height: value(w) === null ? 0 : `${Math.max(2, value(w) / max * 100)}%`, background: '#8ab5bc', borderRadius: 2 } }))),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 } },
      h('span', null, compactDate(model.start)), h('span', null, compactDate(model.today))))
}

export default function DevelopmentView(props = {}) {
  if (props.entropi2 !== true) return null
  const model = developmentModel(props, props.now)
  const heading = h('h2', null, 'Din udvikling')
  if (model.state !== 'ready') return h('section', { 'data-development': true, style: card, 'aria-label': 'Din udvikling' },
    heading, h('p', { role: model.state === 'error' ? 'alert' : 'status' }, model.message))
  const blockNames = [...new Set(model.weeks.flatMap(w => w.blocks))].sort()
  const blockColor = name => palette[blockNames.indexOf(name) % palette.length]
  return h('section', { 'data-development': true, 'data-analysis-history': true, 'aria-label': 'Din udvikling', style: card },
    heading,
    text(`26 uger · ${date(model.start)}–${date(model.today)}. Denne uge er ufuldstændig.`),
    text('Se udviklingen i dit beregnede maksimum (e1RM). Det er et skøn ud fra dine sæt, ikke en testet rekord.'),
    model.lifts.length === 0 && text('Ingen registrerede hovedløft i de 26 viste uger.'),
    ...model.lifts.map(lift => {
      const max = Math.max(1, ...lift.points.map(p => p.value ?? 0))
      const latest = lift.points.filter(p => p.value !== null).at(-1)
      return h('section', { key: lift.lift, 'aria-label': `${lift.lift}, udvikling` },
        h('h3', null, lift.lift),
        latest && text(`Senest ${number(latest.value)} kg e1RM · ${date(latest.day)}.`),
        h('p', { 'data-history-summary': true, style: { lineHeight: 1.6 } }, lift.message),
        lift.stale && text('Det seneste sammenlignelige sæt er mere end 14 dage gammelt.'),
        h('figure', { 'aria-label': `${lift.lift}: e1RM over 26 uger`, style: { margin: '12px 0' } },
          h('figcaption', null, 'Bedste e1RM pr. uge · kg · skala pr. løft'),
          h('div', { role: 'img', 'aria-label': `${lift.lift}: ${lift.observed} uger med data. Uger uden data har ingen søjle.`,
            style: { display: 'grid', gridTemplateColumns: 'repeat(26, minmax(0, 1fr))', gap: 2, height: 72, alignItems: 'end', marginTop: 8 } },
            ...lift.points.map(point => h('span', { key: point.start, 'aria-hidden': 'true',
              ...(point.value === null ? {} : { 'data-history-bar': true }),
              title: `${date(point.start)}: ${point.value === null ? 'Ingen data' : `${number(point.value)} kg e1RM`}`,
              style: { height: point.value === null ? 0 : `${point.value / max * 100}%`, background: '#d8b16b', borderRadius: 2 } }))),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 } },
            h('span', null, compactDate(model.start)), h('span', null, compactDate(model.today)))),
        h('details', null, h('summary', { style: summaryStyle }, `${lift.lift}: tal og datagrundlag`),
          lift.evidence && text(lift.evidence),
          h('ol', { style: { paddingLeft: 20, fontSize: 14, lineHeight: 1.6 } },
            ...lift.points.map(p => h('li', { key: p.start, 'data-history-value': true }, `${date(p.start)}: ${p.value === null ? 'Ingen sammenlignelige data' : `${number(p.value)} kg e1RM`}`)))))
    }),
    h('h3', null, 'Blokke på tidslinjen'),
    text('Bloknavne fra registrerede sæt, uge for uge. De viser observationer; præcise blokgrænser og en samlet blokslutvurdering kræver hele blokplanen.'),
    h('div', { role: 'img', 'aria-label': 'Observerede blokke over 26 uger. Se bloknavne pr. uge nedenfor.',
      style: { display: 'grid', gridTemplateColumns: 'repeat(26, minmax(0, 1fr))', gap: 2, height: 16 } },
      ...model.weeks.map(w => h('span', { key: w.start, title: `${date(w.start)}: ${w.blocks.join(' / ') || 'Blok ukendt'}`,
        style: { background: w.blocks.length ? blockColor(w.blocks[0]) : '#414139', borderRadius: 2 } }))),
    blockNames.length > 0 && h('ul', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', paddingLeft: 20, fontSize: 14 } },
      ...blockNames.map(name => h('li', { key: name, style: { color: blockColor(name) } }, name))),
    h('details', null, h('summary', { style: summaryStyle }, 'Se bloknavne pr. uge'),
      h('ol', { style: { paddingLeft: 20, fontSize: 14, lineHeight: 1.6 } },
        ...model.weeks.map(w => h('li', { key: w.start }, `${date(w.start)}: ${w.blocks.length ? w.blocks.join(' / ') : 'Blok ukendt'}`)))),
    h('h3', null, 'Dine indsigter'),
    model.insights.length ? h('ul', { style: { paddingLeft: 20 } }, ...model.insights.map((insight, i) => h('li', { key: i },
      text(insight.text), h('details', null, h('summary', { style: summaryStyle }, 'Datagrundlag'), text(insight.evidence)))))
      : text('For lidt data til personlige indsigter. Log vægt og gentagelser efter dine sæt; manglende uger udfyldes ikke.'),
    h('h3', null, 'Volumen og intensitet over tid'),
    text('Registreret volumen er kg × gentagelser. Intensitet viser andelen af målte sæt på mindst 80 % af en kendt, uafhængig e1RM-reference. Uger uden data er ukendte, ikke nul træning.'),
    loadChart(model, 'Volumen pr. uge · kg × gentagelser', w => w.sets ? w.tonnage : null, 'kg × gentagelser'),
    model.weeks.some(w => w.classified > 0) && loadChart(model, 'Intensitet pr. uge · andel sæt ≥80 %', w => w.highShare, '%'),
    h('details', { 'data-development-load': true },
      h('summary', { style: summaryStyle }, 'Se volumen og intensitet for de 26 uger'),
      h('table', { style: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 } },
        h('caption', null, 'Registreringer pr. kalenderuge'),
        h('thead', null, h('tr', null, ...['Uge fra', 'Volumen', 'Sæt ≥80 %'].map(label => h('th', { key: label, scope: 'col', style: { textAlign: 'left', padding: 4 } }, label)))),
        h('tbody', null, ...model.weeks.map(w => h('tr', { key: w.start },
          h('th', { scope: 'row', style: { textAlign: 'left', padding: 4, fontWeight: 400 } }, date(w.start)),
          h('td', { style: { padding: 4 } }, w.sets === 0 ? 'Ingen data' : w.tonnage === null ? 'Ukendt volumen' : `${number(w.tonnage)} kg × reps · ${w.sets} sæt`),
          h('td', { style: { padding: 4 } }, w.highShare === null ? 'Ingen reference' : `${number(w.highShare)} % af ${w.classified} målte sæt`,
            w.unknown > 0 && ` · ${w.unknown} ukendte`)))))),
    !model.weeks.some(w => w.classified > 0) && text('Intensiteten kan ikke beregnes: historikken indeholder ingen gyldige e1RM-referencer.'),
    h('h3', null, 'Frem mod næste stævne'),
    model.forecast ? h('section', { 'aria-label': 'Prognose til næste stævne' },
      text(`Planlagt stævne: ${date(model.forecast.meetDate)}.`), text(model.forecast.message),
      ...model.forecast.lifts.map(lift => h('p', { key: lift.lift }, lift.status === 'ready'
        ? `${lift.lift}: skøn ${number(lift.estimate)} kg e1RM · modelmargin ${number(lift.lower)}–${number(lift.upper)} kg (${lift.weeks} uger med data, ${date(lift.firstDay)}–${date(lift.lastDay)}).`
        : `${lift.lift}: ${lift.message}`)),
      h('details', null, h('summary', { style: summaryStyle }, 'Sådan læses prognosen'),
        text('Den eksisterende prognosemodel bruger mindst 8 uger med tunge sæt over mindst 56 dage inden for 12 uger. Nyeste sæt højst 14 dage gammelt; stævnet højst 8 uger fra seneste sæt. Modelmarginen er ikke et statistisk konfidensinterval. Tal med coachen om skønnet.')))
      : text(model.meetMessage),
    h('details', null, h('summary', { style: summaryStyle }, 'Sådan læses din udvikling'),
      text('Kun de præcise hovedløft indgår i styrkegraferne. Lettere sæt, varianter, deload og taper indgår ikke. Samme rep-område som det seneste tunge sæt bruges i hele den enkelte kurve. Uger uden data forbindes ikke.'),
      text('Volumen omfatter også lettere sæt og deload fra den indlæste historik. Den eksisterende historik omfatter vægtbelastede sæt; det er ikke en fuld optælling af al træning. Afventende, oversprungne, fremtidige og modstridende sæt udelades. Programmet ændres ikke.')))
}
