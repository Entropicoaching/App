import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { basename, posix } from 'node:path'
import { jsx } from './coachRyd2Jsx.mjs'

const root = new URL('./', import.meta.url)
const modulePaths = {
  "videoQueueWait.mjs": "dashboard/videoQueueWait.mjs",
  "rel1030.mjs": "rel1030.mjs",
  "coachMeetSoon.mjs": "dashboard/coachMeetSoon.mjs",
  "coachMeetSource.mjs": "dashboard/coachMeetSource.mjs",
  "coachFollowUp.mjs": "dashboard/coachFollowUp.mjs",
  "coachMenuMore.mjs": "dashboard/coachMenuMore.mjs",
  "coachCalendarEvents.mjs": "dashboard/coachCalendarEvents.mjs",
  "coachMobility.mjs": "athlete/coachMobility.mjs",
  "mobilityCatalog.mjs": "athlete/mobilityCatalog.mjs",
  "mobilityFocus.mjs": "athlete/mobilityFocus.mjs",
  "mobilityHomework.mjs": "mobilityHomework.mjs",
  "CoachCalendarEvents.jsx": "dashboard/CoachCalendarEvents.jsx",
  "CoachMobility.jsx": "athlete/CoachMobility.jsx",

  "inputValues.js": "inputValues.js",
  "e2eTestFlags.mjs": "e2eTestFlags.mjs",
  "mobilityHelped.mjs": "mobilityHelped.mjs",
  "coachRyd.mjs": "coachRyd.mjs",
  "calendarDate.js": "calendarDate.js",
  "planOverview.js": "planOverview.js",
  "kostNumbers.mjs": "athlete/kostNumbers.mjs",
  "calendarWeekDate.mjs": "dashboard/calendarWeekDate.mjs",
  "coachPriority.js": "coachPriority.js",
  "automationAlerts.js": "automationAlerts.js",
  "coachBriefingRules.js": "coachBriefingRules.js",
  "coachInboxState.js": "coachInboxState.js",
  "coachNoteSignal.js": "coachNoteSignal.js",
  "dataEnough.mjs": "dataEnough.mjs",
  "rpeEvidence.mjs": "rpeEvidence.mjs",
  "coachBriefingSeen.js": "coachBriefingSeen.js",
  "coachMorning.mjs": "dashboard/coachMorning.mjs",
  "coachMorningSource.mjs": "dashboard/coachMorningSource.mjs",
  "dataEvidence.mjs": "dataEvidence.mjs",
  "exerciseProgress.js": "exerciseProgress.js",
  "exerciseSetView.js": "exerciseSetView.js",
  "exerciseNames.js": "exerciseNames.js",
  "smerteRegion.js": "athlete/smerteRegion.js",
  "ugenoegle.js": "volume/ugenoegle.js",
  "coachWeekOverview.mjs": "dashboard/coachWeekOverview.mjs",
  "coachActions.mjs": "dashboard/coachActions.mjs",
  "coachTemplateMessages.mjs": "dashboard/coachTemplateMessages.mjs",
  "videoQueueFilter.mjs": "dashboard/videoQueueFilter.mjs",
  "HubTab.jsx": "dashboard/HubTab.jsx",
  "ProfilHoved.jsx": "dashboard/ProfilHoved.jsx",
  "IndbakkeView.jsx": "dashboard/IndbakkeView.jsx",
  "ForsideView.jsx": "dashboard/ForsideView.jsx",
  "KalenderView.jsx": "dashboard/KalenderView.jsx",
  "Sidebar.jsx": "dashboard/Sidebar.jsx",
  "MobilNav.jsx": "dashboard/MobilNav.jsx",
  "hubSektioner.jsx": "dashboard/hubSektioner.jsx",
  "CoachActions.jsx": "dashboard/CoachActions.jsx",
  "CoachTemplateMessage.jsx": "dashboard/CoachTemplateMessage.jsx",
  "VideoQueueFilter.jsx": "dashboard/VideoQueueFilter.jsx"
}
const actual = name => new URL(existsSync(new URL(name,root)) ? name : modulePaths[name],root)
export function pinned(path) {
  return readFileSync(new URL('coachRyd2Base' + basename(path).replace('.jsx','.txt'), root), 'utf8')
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
  computePhases: () => [], blockColor: () => '#fff', s: styles, initials: () => 'SA', currentWeekNo: () => null, formatLastSeen: () => null,
  styrkeLinje: () => null, styrkeSmerteRegel: () => null, readinessSignal: score => ({ text: String(score), color: 'green' }),
  VIDEOCOACH_STATUS: Object.fromEntries(['draft','coach_approved','shared','invalid'].map(x => [x, { label: x, color: 'green' }])),
  VIDEOCOACH_METRICS: [], videoCoachMetric: () => null, videoCoachBaseline: () => null,
  videoCoachMetricText: () => '', videoCoachBaselineText: () => '',
  parsePlannedRpe: () => null, buildLiftSeries: () => ({ hasData: false, plannedData: [], actualData: [] }),
}
const real = new Set(['videoQueueWait.mjs','rel1030.mjs','coachMeetSoon.mjs','coachMeetSource.mjs','coachFollowUp.mjs','coachMenuMore.mjs','coachCalendarEvents.mjs','coachMobility.mjs','mobilityCatalog.mjs','mobilityFocus.mjs','mobilityHomework.mjs','inputValues.js','e2eTestFlags.mjs','mobilityHelped.mjs','coachRyd.mjs','calendarDate.js','planOverview.js','kostNumbers.mjs','calendarWeekDate.mjs','coachPriority.js','automationAlerts.js','coachBriefingRules.js','coachInboxState.js','coachNoteSignal.js','dataEnough.mjs','rpeEvidence.mjs','coachBriefingSeen.js','coachMorning.mjs','coachMorningSource.mjs','dataEvidence.mjs','exerciseProgress.js','exerciseSetView.js','exerciseNames.js','smerteRegion.js','ugenoegle.js','coachWeekOverview.mjs','coachActions.mjs','coachTemplateMessages.mjs','videoQueueFilter.mjs'])
const components = new Set(['CoachCalendarEvents.jsx','CoachMobility.jsx','HubTab.jsx','ProfilHoved.jsx','IndbakkeView.jsx','ForsideView.jsx','KalenderView.jsx','Sidebar.jsx','MobilNav.jsx','hubSektioner.jsx','CoachActions.jsx','CoachTemplateMessage.jsx','VideoQueueFilter.jsx'])
const registry = new Map()
globalThis[Symbol.for('coachRyd.tests')] = registry
let id = 0
export async function app(legacy = false) {
  const key = String(++id), prefix = 'coachryd-test://' + key + '/'
  const stub = () => null
  const fakes = {
    'videoMarkerReplies.mjs': { markerRepliesEnabled: () => false, markerReplyPreview: () => null,
      mountMarkerReplyForm: () => () => {}, repliesForMarker: () => [] },
    'VideoMarkerReplyReview.jsx': { default: stub },
    // This harness exercises existing features with marker replies OFF.
    react: { createElement: h, Fragment, useState: initial => [typeof initial === 'function' ? initial() : initial, stub], useMemo: fn => fn(), useEffect: stub, useRef: value => ({ current: value }) },
    'dashboardShared.js': shared,
    'supabase.js': { signOutHard: () => { throw Error('Signout forbidden') }, supabase: new Proxy({}, { get() { throw Error('Backend access forbidden') } }) },
    'coachFremgang.js': { styrkeLinje: shared.styrkeLinje, styrkeSmerteRegel: shared.styrkeSmerteRegel },
    
    'coachKonstanter.js': { statusLabels: { active: 'Aktiv' }, holidayInfo: () => null, ferieBadgeLabel: () => '' },
    'afvigelse.js': { beregnUgensAfvigelse: () => ({}), sorterEfterAfvigelse: x => x, ugensStemme: () => null },
    'roligeAtleter.js': { roligeAtleter: () => [], roligLinje: () => '' },
    
    'coachVideoHjaelp.js': { videoCoachPathPreview: () => null, videoCoachMeasurementSummary: () => null, coachVideoPriorityDetail: () => '', videoCoachMeasurementText: () => '' },
    'danskDato.js': { dageSiden: () => 0, danskDag: () => '' },
  }
  registry.set(key, { h, jsxH: (type, props, ignored, ...children) => h(type,props,...children), fakes })
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) {
        const name = specifier.slice(prefix.length)
        if (!(name in fakes) && !real.has(name) && !components.has(name)) throw Error('Unapproved dependency: ' + name)
        return { url: specifier, shortCircuit: true }
      }
      if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
      if (specifier !== 'react' && (!/^(\.\.?\/)/.test(specifier) || /[?#\\]/.test(specifier))) throw Error('Unapproved import: ' + specifier)
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
        source = legacy && ['HubTab.jsx','ProfilHoved.jsx','IndbakkeView.jsx','ForsideView.jsx','KalenderView.jsx'].includes(name) ? pinned(name) : readFileSync(actual(name),'utf8')
        source = `const __h = ${state}.jsxH;\n` + jsx(source)
      } else {
        source = legacy && ['HubTab.jsx','ProfilHoved.jsx','IndbakkeView.jsx','ForsideView.jsx','KalenderView.jsx','Sidebar.jsx','MobilNav.jsx'].includes(name) ? pinned(name) : readFileSync(actual(name),'utf8')
      }
      return { format:'module',source,shortCircuit:true }
    },
  })
  return async name => (await import(prefix + name)).default
}
