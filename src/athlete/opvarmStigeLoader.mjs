import { registryHooks } from '../testModuleRegistry.mjs'
const registerHooks = hooks => registryHooks(import.meta.url)(hooks)
import { readFileSync } from 'node:fs'
import { jsx } from './opvarmStigeJsx.mjs'
const root = new URL('../', import.meta.url)
const runtime = new URL('./opvarmStigeDom.mjs', import.meta.url).href
const paths = [
  'opvarmStige.mjs', 'exerciseSetView.js', 'exerciseNames.js', 'rel1030.mjs',
  'athlete/WarmupLadderView.mjs', 'athlete/mobilityCatalog.mjs', 'athlete/ProgramTab.jsx',
  'athlete/opvarmStigeBaseline.txt',
]
const urls = new Set(paths.map(path => new URL(path, root).href))
// Only unrelated ProgramTab presentation/calculation dependencies are doubled.
const stubs = {
  './programNaesteUge.mjs': 'export const upcomingProgramWeek=()=>false, programDayPreview=()=>null',
  './IntensityExplanation.jsx': 'export default ()=>null',
  './programBlockOverview.mjs': 'export const blockWeeks=()=>[],renderProgramBlockOverview=()=>null',
  './RestDays.jsx': 'export default ()=>null',
  './restDays.mjs': 'export const isRestSession=()=>false',
  '../rpeEvidence.mjs': 'export const chooseRpeInput=()=>null, visibleRpeNote=()=>null',
  '../inputValues.js': 'export const parseInputNumber=v=>Number(v)',
  '../restTimer.js': 'export const remainingSeconds=()=>0',
  '../repsPrescription.js': 'export const parseRepsPrescription=()=>({})',
  '../fixedRepsEntry.js': 'export const fixedRepsEntry=()=>null',
  './CountdownRing.jsx': 'export default ()=>null',
  '../saetSmerte.js': 'export const SMERTE_LINJE=""',
}
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (!urls.has(context.parentURL)) return next(specifier, context)
      if (specifier === 'react' || specifier === '../athleteShared.js' || specifier === runtime) return { url: runtime, shortCircuit: true }
      const program = /\/(?:ProgramTab.jsx|opvarmStigeBaseline.txt)$/.test(context.parentURL)
      if (program && Object.hasOwn(stubs, specifier)) return { url: 'opvarm-stub:' + encodeURIComponent(specifier), shortCircuit: true }
      if (specifier.startsWith('.') && urls.has(new URL(specifier, context.parentURL).href)) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true }
      throw Error('Closed opvarmStige import: ' + specifier)
    },
    load(url, context, next) {
      if (url.startsWith('opvarm-stub:')) return { format: 'module', source: stubs[decodeURIComponent(url.slice(12))], shortCircuit: true }
      if (urls.has(url)) {
        const source = readFileSync(new URL(url), 'utf8')
        return { format: 'module', source: /(?:\.jsx|Baseline\.txt)$/.test(url) ? `import { h as __h } from '${runtime}';\n${jsx(source)}` : source, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
