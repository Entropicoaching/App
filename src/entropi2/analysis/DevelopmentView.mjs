import { antalOrd } from '../antalOrd.mjs'
import { createElement as h } from 'react'
import { Sparkline } from '../u3/charts.mjs'
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
    h('div', { role: 'img', 'aria-label': `${title}. Tal for registrerede uger står i tabellen nedenfor. Uger uden målinger har ingen søjle.`,
      style: { display: 'grid', gridTemplateColumns: 'repeat(26, minmax(0, 1fr))', gap: 2, height: 56, alignItems: 'end', marginTop: 8 } },
      ...model.weeks.map(w => h('span', { key: w.start, 'aria-hidden': 'true',
        ...(value(w) === null ? {} : { title: `${date(w.start)}: ${number(value(w))} ${unit}` }),
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
  const observedWeeks = model.weeks.filter(w => w.sets > 0)
  const hasVolume = observedWeeks.some(week => week.tonnage !== null)
  const lifts = model.lifts.filter(lift => lift.observed > 0)
  const sharesOutlook = model.forecast?.meetDate === model.outlook.targetDate && model.outlook.lifts.length > 0
  const forecastLifts = sharesOutlook ? [] : model.forecast?.lifts.filter(lift => lift.status === 'ready') ?? []
  const hasIntensity = model.weeks.some(w => w.classified > 0)
  if (!observedWeeks.length) return h('section', { 'data-development': true, style: card, 'aria-label': 'Din udvikling' },
    heading, text('Din udvikling kommer frem, når du logger vægt og gentagelser i programmet.'))
  // U3b: retning pr. hovedløft fra U3 (står stille, falder, kg pr. uge). Kun med U3-flaget.
  const trends = Array.isArray(props.u3Trends) ? props.u3Trends : []
  const trendOf = lift => trends.find(t => t.label === lift.lift) ?? null
  const blockNames = [...new Set(model.weeks.flatMap(w => w.blocks))].sort()
  const blockColor = name => palette[blockNames.indexOf(name) % palette.length]
  return h('section', { 'data-development': true, 'data-analysis-history': true, 'aria-label': 'Din udvikling', style: card },
    heading,
    // U3b: med U3-tendenser er forklaringen én kort linje; kurven siger resten.
    ...(trends.length ? [h('p', { style: { lineHeight: 1.5, fontSize: 14, color: '#c1beb5' } }, 'e1RM er et skøn ud fra dine tunge sæt, 26 uger.')] : [
      text(`26 uger · ${date(model.start)}–${date(model.today)}. Denne uge er ufuldstændig.`),
      lifts.length > 0 && text('Se udviklingen i dit beregnede maksimum (e1RM). Det er et skøn ud fra dine sæt, ikke en testet rekord.')]),
    ...lifts.map(lift => {
      const max = Math.max(1, ...lift.points.map(p => p.value ?? 0))
      const latest = lift.points.filter(p => p.value !== null).at(-1)
      const outlook = model.outlook.lifts.find(item => item.lift === lift.lift)
      return h('section', { key: lift.lift, 'aria-label': `${lift.lift}, udvikling` },
        h('h3', null, lift.lift),
        latest && h('div', { 'data-development-latest': true, style: { margin: '12px 0', minWidth: 0 } },
          h('p', { style: { margin: 0, fontSize: 14, color: '#c1beb5' } }, 'Seneste e1RM · skøn'),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px' } },
            h('p', { style: { margin: '4px 0', lineHeight: 1.2, overflowWrap: 'anywhere' } },
              h('strong', { style: { fontSize: 32, fontWeight: 700, color: '#edeae2' } }, number(latest.value)),
              h('span', { style: { fontSize: 16, color: '#c1beb5' } }, ' kg')),
            trendOf(lift) && h(Sparkline, { values: lift.points.map(p => p.value).slice(lift.points.findIndex(p => p.value !== null)), label: `${lift.lift}: e1RM pr. uge` })),
          trendOf(lift) && h('p', { 'data-u3-trend': lift.lift, style: { margin: '0 0 4px', fontSize: 15, fontWeight: 600,
            color: trendOf(lift).plateau === true || trendOf(lift).drop === true ? '#da9d8e' : '#d8b16b' } }, trendOf(lift).tail),
          h('p', { style: { margin: 0, fontSize: 13, lineHeight: 1.5, color: '#c1beb5' } },
            'Registreret ', h('time', { dateTime: latest.day }, date(latest.day)), '.')),
        lift.delta !== null && h('p', { 'data-history-summary': true,
          style: { fontSize: 16, fontWeight: 600, lineHeight: 1.6, color: '#d8b16b' } }, lift.message),
        outlook && h('p', { 'data-development-outlook': lift.lift, style: { lineHeight: 1.6 } },
          `Fortsætter udviklingen i dine registrerede sæt, er skønnet omkring ${number(outlook.estimate)} kg e1RM om 4 uger (${date(model.outlook.targetDate)}). Det er usikkert og ingen garanti for et resultat.`),
        lift.stale && text('Det seneste sammenlignelige sæt er mere end 14 dage gammelt.'),
        h('details', { 'data-development-chart': lift.lift, 'aria-label': `${lift.lift}: udvikling over 26 uger` },
          h('summary', { style: summaryStyle }, 'Se udviklingen over 26 uger'),
          h('figure', { 'aria-label': `${lift.lift}: e1RM over 26 uger`, style: { margin: '12px 0' } },
            h('figcaption', null, 'Bedste e1RM pr. uge · kg · skala pr. løft'),
            h('div', { role: 'img', 'aria-label': `${lift.lift}: ${lift.observed} ${antalOrd(lift.observed, 'uge', 'uger')} med data. Uger uden data har ingen søjle.`,
              style: { display: 'grid', gridTemplateColumns: 'repeat(26, minmax(0, 1fr))', gap: 2, height: 72, alignItems: 'end', marginTop: 8 } },
              ...lift.points.map(point => h('span', { key: point.start, 'aria-hidden': 'true',
                ...(point.value === null ? {} : { 'data-history-bar': true }),
                ...(point.value === null ? {} : { title: `${date(point.day)}: ${number(point.value)} kg e1RM` }),
                style: { height: point.value === null ? 0 : `${point.value / max * 100}%`, background: '#d8b16b', borderRadius: 2 } }))),
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 } },
              h('span', null, compactDate(model.start)), h('span', null, compactDate(model.today)))),
          h('h4', null, 'Registrerede tal'),
          h('ol', { style: { paddingLeft: 20, fontSize: 14, lineHeight: 1.6 } },
            ...lift.points.filter(p => p.value !== null).map(p => h('li', { key: p.start, 'data-history-value': true }, `${date(p.day)}: ${number(p.value)} kg e1RM`)))),
        h('details', { 'aria-label': `${lift.lift}: datagrundlag` },
          h('summary', { style: summaryStyle }, 'Datagrundlag'),
          lift.evidence && text(lift.evidence),
          outlook && text(`Skønnet om 4 uger bygger på ${outlook.weeks} ${antalOrd(outlook.weeks, 'uge', 'uger')} med tunge sæt, ${date(outlook.firstDay)}–${date(outlook.lastDay)}, inden for de seneste 12 uger. Modelmargin: ${number(outlook.lower)}–${number(outlook.upper)} kg e1RM; ikke et statistisk konfidensinterval.`),
          outlook && text('Fremskrivningen kræver mindst 8 uger med data over mindst 56 dage og et seneste tungt sæt højst 14 dage gammelt. Ustabile eller ekstreme forløb giver intet skøn. Tal med coachen om retningen.')))
    }),
    blockNames.length > 0 && h('section', { 'aria-label': 'Observerede blokke' },
      h('h3', null, 'Blokke på tidslinjen'),
      text('Bloknavne fra registrerede sæt. De viser observationer; præcise blokgrænser kræver hele blokplanen.'),
      h('div', { role: 'img', 'aria-label': 'Observerede blokke over 26 uger. Uger uden bloknavn har ingen markering.',
        style: { display: 'grid', gridTemplateColumns: 'repeat(26, minmax(0, 1fr))', gap: 2, height: 16 } },
        ...model.weeks.map(w => h('span', { key: w.start,
          ...(w.blocks.length ? { title: `${date(w.start)}: ${w.blocks.join(' / ')}` } : { 'aria-hidden': true }),
          style: { background: w.blocks.length ? blockColor(w.blocks[0]) : 'transparent', borderRadius: 2 } }))),
      h('ul', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', paddingLeft: 20, fontSize: 14 } },
        ...blockNames.map(name => h('li', { key: name, style: { color: blockColor(name) } }, name))),
      h('details', null, h('summary', { style: summaryStyle }, 'Se bloknavne pr. uge'),
        h('ol', { style: { paddingLeft: 20, fontSize: 14, lineHeight: 1.6 } },
          ...model.weeks.filter(w => w.blocks.length > 0).map(w => h('li', { key: w.start }, `${date(w.start)}: ${w.blocks.join(' / ')}`))))),
    model.insights.length > 0 && h('section', { 'aria-label': 'Dine indsigter' },
      h('h3', null, 'Dine indsigter'),
      h('ul', { style: { paddingLeft: 20 } }, ...model.insights.map((insight, i) => h('li', { key: i },
        text(insight.text), h('details', null, h('summary', { style: summaryStyle }, 'Datagrundlag'), text(insight.evidence)))))),
    h('h3', null, hasIntensity ? 'Volumen og intensitet over tid' : 'Volumen over tid'),
    text('Registreret volumen er kg × gentagelser. Uger uden data har ingen søjle og er ikke nul træning.'),
    hasIntensity && text('Intensitet viser andelen af målte sæt på mindst 80 % af en kendt, uafhængig e1RM-reference.'),
    hasVolume && loadChart(model, 'Volumen pr. uge · kg × gentagelser', w => w.sets ? w.tonnage : null, 'kg × gentagelser'),
    hasIntensity && loadChart(model, 'Intensitet pr. uge · andel sæt ≥80 %', w => w.highShare, '%'),
    h('details', { 'data-development-load': true },
      h('summary', { style: summaryStyle }, hasIntensity ? 'Se registreret volumen og intensitet' : 'Se registreret volumen'),
      h('table', { style: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 } },
        h('caption', null, 'Registreringer pr. kalenderuge'),
        h('thead', null, h('tr', null, ...['Uge fra', 'Volumen', ...(hasIntensity ? ['Sæt ≥80 %'] : [])].map(label => h('th', { key: label, scope: 'col', style: { textAlign: 'left', padding: 4 } }, label)))),
        h('tbody', null, ...observedWeeks.map(w => h('tr', { key: w.start },
          h('th', { scope: 'row', style: { textAlign: 'left', padding: 4, fontWeight: 400 } }, date(w.start)),
          h('td', { style: { padding: 4 } }, w.tonnage === null ? 'Volumen kan ikke beregnes' : `${number(w.tonnage)} kg × reps · ${w.sets} sæt`),
          hasIntensity && h('td', { style: { padding: 4 } }, w.highShare === null ? '—' : `${number(w.highShare)} % af ${w.classified} ${antalOrd(w.classified, 'målt sæt', 'målte sæt')}`,
            w.unknown > 0 && ` · ${w.unknown} ${antalOrd(w.unknown, 'ukendt', 'ukendte')}`)))))),
    model.forecast && h('section', { 'aria-label': 'Prognose til næste stævne' },
      h('h3', null, 'Frem mod næste stævne'),
      text(`Planlagt stævne: ${date(model.forecast.meetDate)}.`),
      sharesOutlook && text('Skøn og datagrundlag for denne dato står ved løftene ovenfor.'),
      ...forecastLifts.map(lift => h('p', { key: lift.lift },
        `${lift.lift}: skøn ${number(lift.estimate)} kg e1RM · modelmargin ${number(lift.lower)}–${number(lift.upper)} kg (${lift.weeks} ${antalOrd(lift.weeks, 'uge', 'uger')} med data, ${date(lift.firstDay)}–${date(lift.lastDay)}).`)),
      !sharesOutlook && h('details', null, h('summary', { style: summaryStyle }, 'Sådan læses prognosen'),
        text('Prognosen kræver mindst 8 uger med tunge sæt over mindst 56 dage inden for 12 uger. Nyeste sæt højst 14 dage gammelt; stævnet højst 8 uger fra seneste sæt. Kun løft med tilstrækkeligt grundlag vises. Modelmarginen er ikke et statistisk konfidensinterval. Tal med coachen om skønnet.'))),
    model.meetMessage && model.meetMessage.includes('ugyldig') && text(model.meetMessage),
    h('details', null, h('summary', { style: summaryStyle }, 'Sådan læses din udvikling'),
      text('En ændring i styrke kræver sammenlignelige tunge sæt i mindst 4 uger over mindst 21 dage. Kun de præcise hovedløft indgår i styrkegraferne. Lettere sæt, varianter, deload og taper indgår ikke. Samme rep-område som det seneste tunge sæt bruges i hele den enkelte kurve. Uger uden data forbindes ikke.'),
      text('Volumen omfatter også lettere sæt og deload fra den indlæste historik. Den eksisterende historik omfatter vægtbelastede sæt; det er ikke en fuld optælling af al træning. Afventende, oversprungne, fremtidige og modstridende sæt udelades. Programmet ændres ikke.')))
}
