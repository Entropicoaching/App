import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './homeRo2Jsx.mjs'
const root = new URL('./', import.meta.url)
const runtime = new URL('homeRo2Dom.mjs', root).href
const viewRuntime = new URL('homeRo2ViewRuntime.mjs', root).href
const view = new URL('AthleteView.jsx', root).href
const files = ['AthleteView.jsx', 'athlete/HjemTab.jsx', 'athlete/EnkelHjemTab.jsx',
  'nytIAppen.mjs', 'nytIAppenText.mjs', 'rel1030.mjs', 'rel1101.mjs',
  'athlete/hjemoevKompakt.mjs', 'mobilityHomework.mjs', 'mobilityAdherence.mjs',
  'mobilityHelped.mjs', 'athlete/mobilityCatalog.mjs', 'athlete/enkelPrototype.mjs',
  'athlete/kostValg.mjs', 'athlete/readinessShortcut.mjs', 'athlete/mobilityFocus.mjs']
const allowed = new Set(files.map(n => new URL(n, root).href))
const source = readFileSync(new URL(view), 'utf8')
const orderSource = source.slice(source.indexOf('function homeRo2Order('), source.indexOf('function Ro2HjemTab('))
export const stateNames = [...source.matchAll(/const \[([A-Za-z][\w]*),[^\]]+\] = useState\(/g)].map(x => x[1])
const special = {
  lavLaesninger: '()=>({openReadiness:()=>null})',
  lavSaetSkrivning: '()=>({logDagensPasSet:()=>{throw Error("Writes belong to the actual imported handler tests")}})',
  s: '{}', today: "()=>'2026-11-01'", WEEKDAYS_LONG: "['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Loerdag','Soendag']",
  findDagensPas: '()=>null', nextTrainingHome: '()=>null',
  weekStartDate: '()=>null', fmtWeekRange: '()=>null',
  bestExerciseRecords: '()=>[]', exerciseViewRows: '()=>[]', weightTrendText: '()=>null',
  renderStaevneHome: '()=>null', renderNextTrainingHome: '()=>null',
  renderVideoCoachChoices: '()=>null', renderAthleteShortcuts: '()=>null',
  renderMobilityShortcut: '()=>null',
  dataMessage: '()=>null', readinessComparisonText: '()=>null',
  readinessTrainingNote: '()=>null', lastCheckinDrivenChange: '()=>null',
  checkinNoteTimingText: '()=>null',
  WeeklyTonnageChart: '()=>null', E1RMChart: '()=>null', ReadinessSparkline: '()=>null',
}
// Generate an inert closed boundary from imports in the three pinned renderers.
// No unlisted URL can be resolved from any imported public module.
const stubs = new Map()
for (const parent of [view, new URL('athlete/HjemTab.jsx', root).href, new URL('athlete/EnkelHjemTab.jsx', root).href]) {
  const text = readFileSync(new URL(parent), 'utf8')
  for (const [, bindings, spec] of text.matchAll(/^import ([\s\S]*?) from '([^']+)'/gm)) {
    if (spec === 'react' || allowed.has(new URL(spec, parent).href)) continue
    const names = bindings.match(/\{([^}]+)\}/)?.[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean) || []
    let code = 'export default function SyntheticBoundary(){return null};'
    if (spec === './LazyBoundary.jsx') code = `import Enkel from ${JSON.stringify(new URL('athlete/EnkelHjemTab.jsx', root).href)}; import {createElement} from ${JSON.stringify(runtime)}; ${orderSource} export default function SyntheticLazy(p){return p.label==='Hjem'?homeRo2Order(Enkel(p.componentProps),p.componentProps.homeRo2 && !p.componentProps.onHoliday):null};`
    for (const name of names) {
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw Error('Invalid stub name')
      code += `export const ${name}=${special[name] || (/^[A-Z]/.test(name) ? '()=>null' : '()=>({})')};`
    }
    stubs.set(parent + '\n' + spec, code)
  }
}
export function install() {
  return registerHooks({
    resolve(spec, context, next) {
      if (!allowed.has(context.parentURL)) return next(spec, context)
      if (spec === 'react') return { url: context.parentURL === view ? viewRuntime : runtime, shortCircuit: true }
      if (spec === runtime) return { url: runtime, shortCircuit: true }
      const target = new URL(spec, context.parentURL).href
      if (allowed.has(target)) return { url: target, shortCircuit: true }
      const key = context.parentURL + '\n' + spec
      if (stubs.has(key)) return { url: 'home-ro2-stub:' + encodeURIComponent(key), shortCircuit: true }
      throw Error('Forbidden synthetic dependency: ' + spec)
    },
    load(url, context, next) {
      if (url.startsWith('home-ro2-stub:')) return { format: 'module', source: stubs.get(decodeURIComponent(url.slice(14))), shortCircuit: true }
      if (!allowed.has(url)) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (url.endsWith('.jsx')) source = `import { createElement as __create } from ${JSON.stringify(runtime)}; const __h=(t,p,_,...c)=>__create(t,p,...c);\n` + jsx(source)
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
