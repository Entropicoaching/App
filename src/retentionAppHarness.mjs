import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './retentionJsx.mjs'
export const nodes = n => n && typeof n === 'object' ? [n, ...(n.children || []).flatMap(nodes)] : []
export const text = n => n && typeof n === 'object' ? n.children.map(text).join(' ') : String(n ?? '')
let serial = 0
const registry = Symbol.for('retention.synthetic')
globalThis[registry] = new Map()
const stubs = {
  'dataEvidence.mjs': 'export const weekEvidence=()=>({}), datedRegression=()=>null, rpeTrendEvidence=()=>({}), volumeWeeks=()=>[], matchedDays=()=>({}), planEvidence=()=>({}), liftEvidence=()=>({}), normalizedRatings=()=>[];',
  'dataEnough.mjs': 'export const explicitRpe=()=>null, dataEnoughEnabled=()=>false, dataAllowed=()=>false, dataMessage=()=>"", lowStreak=()=>false;',
  'coachRyd.mjs': 'export const CoachFold=()=>null;',
  'videoCoachBaselineProgress.js': 'export const buildVideoCoachBaselineProfiles=()=>[], countReadyVideoCoachBaselineProfiles=()=>0;',
  'videoCoachFeedbackQuality.js': 'export const videoCoachFeedbackQuality=()=>({});',
  'videoCoachLabels.js': 'export const VIDEOCOACH_LIFT_LABELS={}, videoCoachVariationLabel=()=>"";',
  'exerciseNames.js': 'export const byggKategoriOpslag=()=>({}), kategoriFor=()=>"";',
  'exerciseSetView.js': 'export const exerciseSetView=()=>({});',
  'dashboardShared.js': 'export const s={}, VIDEOCOACH_STATUS={draft:{}}, VIDEOCOACH_METRICS=[], videoCoachMetric=()=>null, videoCoachBaseline=()=>null, videoCoachMetricText=()=>"", videoCoachBaselineText=()=>"", parsePlannedRpe=()=>null, buildLiftSeries=()=>({hasData:false,plannedData:[],data:[]});',
  'dashboardCharts.jsx': 'export const BarChart=()=>null, LineChart=()=>null, ScatterPlot=()=>null;',
  'primaerKurve.js': 'export const primaerKurve=()=>({data:[]}), primaerOverskrift=()=>"";',
  'danskDato.js': 'export const danskDag=()=>"";',
  'analyseSammenlign.mjs': 'export const analyseSammenlignEnabled=()=>false;',
  'analyseSamlet.mjs': 'export const analyseSamletEnabled=()=>false;',
  'AnalyseLokaltVaerktoej.jsx': 'export default ()=>null;',
  'AnalyseSammenlign.jsx': 'export default ()=>null;',
  'AnalyseSamletPrototype.jsx': 'export default ()=>null;',
  'AthleteSilentFailNote.jsx': 'export default ()=>null;',
}
export async function app({ before = false } = {}) {
  const id = String(++serial), prefix = `retention-${id}://app/`
  const state = { buckets: new Map(), active: null }
  state.useState = initial => {
    const b = state.active, i = b.cursor++
    if (!(i in b.values)) b.values[i] = initial
    return [b.values[i], v => { b.values[i] = v }]
  }
  state.h = (type, props, ignored, ...children) => {
    const flat = children.flat(Infinity).filter(v => v != null && v !== false)
    if (typeof type !== 'function') return { type, props, children: flat }
    const key = type.name + ':' + (props?.key ?? '')
    const old = state.active, b = state.buckets.get(key) || { cursor: 0, values: [] }
    state.buckets.set(key, b); b.cursor = 0; state.active = b
    try { return type({ ...props, children: flat }) } finally { state.active = old }
  }
  globalThis[registry].set(id, state)
  const real = new Set(['AnalyseTab.jsx','VideoRetentionLocalPreview.mjs','VideoRetentionPreview.mjs','videoRetention.mjs'])
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true }
      if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
      const name = specifier.split('/').pop()
      if (name !== 'react' && !real.has(name) && !Object.hasOwn(stubs, name)) throw Error('Forbidden dependency: ' + specifier)
      return { url: prefix + name, shortCircuit: true }
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url, context)
      const name = url.slice(prefix.length), access = `globalThis[Symbol.for('retention.synthetic')].get('${id}')`
      let source
      if (name === 'react') source = `export const useState=${access}.useState; export const createElement=(t,p,...c)=>${access}.h(t,p,null,...c);`
      else if (Object.hasOwn(stubs, name)) source = stubs[name]
      else {
        const relative = before && name === 'AnalyseTab.jsx' ? './retentionBeforeAnalyseTab.txt' : './' + name
        const local = new URL(relative, import.meta.url)
        source = readFileSync(name === 'AnalyseTab.jsx' && !before && !existsSync(local) ? new URL('./dashboard/AnalyseTab.jsx', import.meta.url) : local, 'utf8')
        if (name.endsWith('.jsx')) source = `const __h=${access}.h;\n` + jsx(source)
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
  const View = (await import(prefix + 'AnalyseTab.jsx')).default
  return { render: props => state.h(View, props, null) }
}
