import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { basename, posix } from 'node:path'
import { jsx } from './coachRydJsx.mjs'

const root = new URL('./', import.meta.url)
export function pinned(path) {
  return readFileSync(new URL('coachRydBase' + basename(path).replace('.jsx','.txt'), root), 'utf8')
}
export const Fragment = Symbol.for('synthetic.fragment')
export function h(type, props, ...children) {
  children = children.flat(Infinity).filter(x => x != null && x !== false && x !== true)
  if (typeof type === 'function') return type({ ...props, children })
  return { type, props: props || {}, children }
}
export const nodes = tree => tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flatMap(nodes)] : []
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
export function normalized(tree) {
  if (Array.isArray(tree)) return tree.flatMap(x => {
    const n = normalized(x)
    return Array.isArray(n) ? n : [n]
  })
  if (!tree || typeof tree !== 'object') return tree
  if (tree.type == null || tree.type === Fragment) return normalized(tree.children)
  const props = Object.fromEntries(Object.entries(tree.props).filter(([k]) => k !== 'children').map(([k,v]) => [k, typeof v === 'function' ? 'handler' : v]))
  return { type: tree.type, props, children: normalized(tree.children) }
}
const styles = new Proxy({}, { get: (_, key) => ['badge','btn'].includes(key) ? () => ({}) : {} })
const shared = {
  s: styles, initials: () => 'SA', currentWeekNo: () => null, formatLastSeen: () => null,
  styrkeLinje: () => null, styrkeSmerteRegel: () => null, readinessSignal: score => ({ text: String(score), color: 'green' }),
  VIDEOCOACH_STATUS: Object.fromEntries(['draft','coach_approved','shared','invalid'].map(x => [x, { label: x, color: 'green' }])),
  VIDEOCOACH_METRICS: [], videoCoachMetric: () => null, videoCoachBaseline: () => null,
  videoCoachMetricText: () => '', videoCoachBaselineText: () => '',
  parsePlannedRpe: () => null, buildLiftSeries: () => ({ hasData: false, plannedData: [], actualData: [] }),
}
const real = new Set(['mobilityHelped.mjs', 'coachMorning.mjs', 'coachMorningSource.mjs', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'e2eTestFlags.mjs', 'videoQueueFilter.mjs', 'inputValues.js', 'exerciseSetView.js', 'exerciseProgress.js', 'exerciseNames.js', 'ugenoegle.js', 'smerteRegion.js', 'coachWeekOverview.mjs', 'coachTemplateMessages.mjs', 'analyseSammenlign.mjs', 'coachRyd.mjs','coachPriority.js','coachInboxState.js','coachNoteSignal.js','automationAlerts.js','coachBriefingRules.js',
  'videoCoachLabels.js','videoCoachPersonalFeedback.js','videoCoachFeedbackQuality.js','videoCoachFeedbackEvidence.js','videoCoachBaselineProgress.js','calendarDate.js','kostNumbers.mjs','coachActions.mjs','analyseSamlet.mjs','videoReviewLayout.mjs'])
const components = new Set(['AnalyseSammenlign.jsx', 'CoachTemplateMessage.jsx', 'VideoQueueFilter.jsx', 'ForsideView.jsx','IndbakkeView.jsx','ProfilHoved.jsx','HubTab.jsx','AnalyseTab.jsx','VideoReviewModal.jsx','Sidebar.jsx','MobilNav.jsx','CoachActions.jsx','AnalyseSamletPrototype.jsx'])
const registry = new Map()
globalThis[Symbol.for('coachRyd.tests')] = registry
let id = 0
export async function app(legacy = false, previous = false, r2Before = false) {
  const key = String(++id), prefix = 'coachryd-test://' + key + '/'
  const stub = () => null
  const fakes = {
    react: { createElement: h, Fragment, useState: initial => [typeof initial === 'function' ? initial() : initial, stub], useMemo: fn => fn(), useEffect: stub, useRef: value => ({ current: value }) },
    'VideoReviewTemplates.mjs': { default: stub, DEFAULT_VIDEO_REVIEW_TEMPLATES: false },
    'dashboardShared.js': shared,
    'supabase.js': { signOutHard: () => { throw Error('Signout forbidden') }, supabase: new Proxy({}, { get() { throw Error('Backend access forbidden') } }) },
    'coachFremgang.js': { styrkeLinje: shared.styrkeLinje, styrkeSmerteRegel: shared.styrkeSmerteRegel },
    'hubSektioner.js': { HUB_SECTIONS: ['program','log','beskeder','kost','analyse'].map(key => ({key,label:key,desc:key})) },
    'coachKonstanter.js': { statusLabels: { active: 'Aktiv' }, holidayInfo: () => null, ferieBadgeLabel: () => '' },
    'afvigelse.js': { beregnUgensAfvigelse: () => ({}), sorterEfterAfvigelse: x => x, ugensStemme: () => null },
    'roligeAtleter.js': { roligeAtleter: () => [], roligLinje: () => '' },
    'coachBriefingSeen.js': { coachBriefingPointKey: item => item.key },
    'coachVideoHjaelp.js': { videoCoachPathPreview: () => null, videoCoachMeasurementSummary: () => null, coachVideoPriorityDetail: () => '', videoCoachMeasurementText: () => '' },
    'danskDato.js': { dageSiden: () => 0, danskDag: () => '' },
    'smerteRegion.js': { omfangTekst: () => '' },
    'dashboardCharts.js': { BarChart: stub, LineChart: stub, ScatterPlot: stub },
    'primaerKurve.js': { primaerKurve: () => ({}), primaerOverskrift: () => '' },
    'AnalysePakkeReview.js': { default: () => h('aside', { 'data-synthetic': 'package' }, 'Lokal analysepakke') },
    'AnalyseLokaltVaerktoej.js': { default: () => h('aside', {}, 'Syntetisk værktøj') },
    'AthleteSilentFailNote.js': { default: stub },
  }
  registry.set(key, { h, jsxH: (type, props, ignored, ...children) => h(type,props,...children), fakes })
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true }
      if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
      let name = specifier === 'react' ? specifier : basename(specifier)
      if (['hubSektioner.jsx','dashboardCharts.jsx','AnalysePakkeReview.jsx','AnalyseLokaltVaerktoej.jsx','AthleteSilentFailNote.jsx'].includes(name)) name = name.replace(/\.jsx$/, '.js')
      if (name !== 'react' && !posix.extname(name)) name += '.js'
      if (name.endsWith('.js') && components.has(name.slice(0,-3)+'.jsx')) name=name.slice(0,-3)+'.jsx'
      if (!(name in fakes) && !real.has(name) && !components.has(name)) throw Error('Unapproved dependency: ' + name)
      return { url: prefix + name, shortCircuit: true }
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url,context)
      const name = url.slice(prefix.length), state = `globalThis[Symbol.for('coachRyd.tests')].get(${JSON.stringify(key)})`
      let source
      if (name in fakes) {
        source = Object.keys(fakes[name]).map(k => k === 'default' ? `export default ${state}.fakes[${JSON.stringify(name)}].default;` : `export const ${k} = ${state}.fakes[${JSON.stringify(name)}][${JSON.stringify(k)}];`).join('\n')
      } else if (components.has(name)) {
        const target = new URL(existsSync(new URL(name,root)) ? name : 'dashboard/' + name,root)
        source = r2Before && ['ForsideView.jsx','VideoReviewModal.jsx','ProfilHoved.jsx'].includes(name) ? readFileSync(new URL('r2Before' + name.replace('.jsx','.txt'),root),'utf8') : previous && ['IndbakkeView.jsx','VideoReviewModal.jsx','Sidebar.jsx','MobilNav.jsx'].includes(name) ? readFileSync(new URL('coachRydBefore' + name.replace('.jsx','.txt'), root),'utf8') : legacy && !['CoachActions.jsx','AnalyseSamletPrototype.jsx','AnalyseSammenlign.jsx','CoachTemplateMessage.jsx','VideoQueueFilter.jsx'].includes(name) ? pinned('src/dashboard/' + name) : readFileSync(target,'utf8')
        source = `const __h = ${state}.jsxH;\n` + jsx(source)
      } else {
        source = r2Before && name === 'coachRyd.mjs' ? readFileSync(new URL('r2BeforecoachRyd.txt',root),'utf8') : previous && name === 'coachRyd.mjs' ? readFileSync(new URL('coachRydBeforeHelper.txt',root),'utf8') : readFileSync(new URL(existsSync(new URL(name,root)) ? name : (name === 'mobilityHelped.mjs' ? '' : ['kostNumbers.mjs','smerteRegion.js'].includes(name) ? 'athlete/' : name === 'ugenoegle.js' ? 'volume/' : 'dashboard/') + name,root),'utf8')
      }
      return { format:'module',source,shortCircuit:true }
    },
  })
  return async name => (await import(prefix + name)).default
}
