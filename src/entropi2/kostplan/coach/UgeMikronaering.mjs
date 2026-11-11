import { NOEGLESTOFFER } from '../ugeMikronaering.mjs'

// U10d: én foldet linje under ugen fra Claude, kun hos coachen. Folden har én kort linje pr.
// stof. Under 70 % står et stille mærke uden farve; atleten ser intet herfra.
const FORSLAG = { ironMg: 'fx oksekød', vitaminDUg: 'fx fed fisk', calciumMg: 'fx skyr eller mælk' }
const tal = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: value < 100 ? 1 : 0 }).format(value)

const kort = s => s.snit === null ? `${s.label} ukendt` : s.procent === null ? `${s.label} ${tal(s.snit)} ${s.unit}` : `${s.label} ${s.procent} %`

function linje(s) {
  if (s.snit === null) return s.daekning === null ? `${s.label}: ukendt` : `${s.label} ukendt: data for ${Math.floor(s.daekning * 100)} % af energien`
  const ref = s.anbefalet === null ? 'intet anbefalet tal uden køn og alder 18 til 50 år'
    : `${s.procent} % af ${tal(s.anbefalet)} ${s.unit}${s.type === 'AI' ? ' (AI)' : ''}`
  return `${s.label} ${tal(s.snit)} ${s.unit} om dagen · ${ref}${s.lav ? ` · lavt, byt en ret, ${FORSLAG[s.nutrient]}` : ''}`
}

export function ugeMikronaeringView(h, mikro) {
  if (!mikro) return null
  const summary = mikro.status === 'klar'
    ? `Mikronæring, 7-dages snit: ${NOEGLESTOFFER.map(n => kort(mikro.stoffer.find(s => s.nutrient === n))).join(' · ')}`
    : 'Mikronæring: ukendt, ugen mangler en læselig dag'
  return h('details', { 'data-uge-mikro': mikro.status, style: { marginTop: 12, borderTop: '1px solid rgba(127,127,127,.3)' } },
    h('summary', { style: { minHeight: 44, padding: '10px 0', cursor: 'pointer' } }, summary),
    mikro.status === 'klar' && h('ul', { style: { paddingLeft: 18, margin: '0 0 8px' } },
      ...mikro.stoffer.map(s => h('li', { key: s.nutrient, 'data-lav': s.lav || undefined }, linje(s)))),
    h('p', { style: { margin: '0 0 8px', fontSize: 14 } }, 'Tal fra planen, uden tilskud, ikke en blodprøve. NNR 2023.'))
}
