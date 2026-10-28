import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { app, h } from './coachRyd2Harness.mjs'
import { jsx } from './coachRyd2Jsx.mjs'

await app()
export const helper = await import('coachryd-test://1/coachRyd.mjs')
const inbox = await import('coachryd-test://1/coachInboxState.js')
const week = await import('coachryd-test://1/coachWeekOverview.mjs')
const morning = await import('coachryd-test://1/coachMorning.mjs')
const template = await import('coachryd-test://1/coachTemplateMessages.mjs')
const calendar = await import('coachryd-test://1/calendarDate.js')
const noop = () => {}
const calls = []
export const handlers = Object.fromEntries(['openProfile','openPlanReview','snoozeAthlete','handleCoachBriefingSeen'].map(name => [name, (...args) => calls.push([name,...args])]))
const empty = () => ({})
let stateIndex = 0, currentView, overrideView
const fakes = {
'./nytIAppen.mjs': {default:noop,nytCoachNavigation:()=>null},
'./dashboard/coachNotes.mjs': {coachNotesFlag:()=>false,createCoachNoteSaver:noop},
'./dashboard/fridayChecklist.mjs': {FridayChecklist:noop,FridayChecklistEntry:noop},
'./rel1030.mjs': {rel1030Enabled:()=>false},
'./dashboard/coachMeetSoon.mjs': {coachMeetSoonFlag:()=>false},
'./dashboard/coachFollowUp.mjs': {coachFollowUpFlag:()=>false},
'./dashboard/profileWeekSummary.mjs': {ProfileWeekSummary:noop,profileWeekFlag:()=>false},
'./dashboard/coachSaveNext.mjs': {COACH_SAVE_NEXT_ENABLED:false,createInboxSaveNext:noop,inboxReplyMatches:()=>false},

  react: { useState(initial) {
    const index = stateIndex++
    let value = typeof initial === 'function' ? initial() : initial
    if (index === 4) value = false
    if (index === 6) { currentView = value; value = overrideView ?? value }
    return [value,noop]
  }, useEffect: noop, useRef: current => ({current}) },
  './coachRyd.mjs': helper,
  './coachInboxState.js': inbox,
  './calendarDate.js': calendar,
  './dashboard/coachWeekOverview.mjs': week,
  './dashboard/coachMorning.mjs': morning,
  './dashboard/coachTemplateMessages.mjs': template,
  './dashboard/VideoReviewTemplates.mjs': { DEFAULT_VIDEO_REVIEW_TEMPLATES:false },
  './dashboard/coachFourWeeks.mjs': { COACH_FOUR_WEEKS_ENABLED:false, reduceFourWeekRead:noop },
  './supabase.js': { supabase:new Proxy({}, {get() {throw Error('Backend forbidden')}}) },
  './periodizationAssistant.js': { withBlockPurposes: x => x },
  './dashboardShared.js': { s:new Proxy({}, {get:()=>({})}), currentWeekNo:noop },
  './dashboard/laesninger.js': { lavLaesninger:empty },
  './dashboard/navigation.js': { lavNavigation:()=>handlers },
  './dashboard/indbakkeHandlinger.js': { lavIndbakkeHandlinger:()=>handlers },
  './dashboard/videoReviewHandlinger.js': { lavVideoReviewHandlinger:empty },
  './dashboard/atletHandlinger.js': { lavAtletHandlinger:empty },
  './dashboard/aiRapport.js': { lavAiRapport:empty },
  './dashboard/programHandlinger.js': { lavProgramHandlinger:()=>handlers },
  './dashboard/weekDeletion.js': { createWeekDeletionQueue:empty },
  './dashboard/programCopy.js': { DEFAULT_PROGRAM_COPY:false },
  './dashboard/profilTal.js': { lavProfilTal:empty },
  './dashboard/useVideoCoachBro.js': { useVideoCoachBro:noop },
  './dashboard/useDashboardEffekter.js': { useDashboardEffekter:noop },
  './dashboard/useCoachPrioritet.js': { useCoachPrioritet:()=>({coachPriorityItems:[],coachPriorityCount:0}) },
}
// Exact import spellings only. Unknown paths never receive an automatic stub.
for (const name of ['CoachFourWeeks','WeekDeletionNotice','BibliotekView','KalenderView','ForsideView','HubTab','OpvarmningTab','OversigtTab','KostTab','LogTab','StaevneTab','NoterTab','BeskederTab','VideoReviewModal','StaevneResultatModal','NyAtletModal','Overlays','Sidebar','MobilNav','ProfilHoved','WeekdayPicker','ExFormRow','BlockSequenceRows']) {
  fakes[`./dashboard/${name}.jsx`] = {default: props => h(name,props)}
}
fakes['./LazyBoundary.jsx'] = {default:props => h('LazyBoundary',props)}
const prefix = 'rebasedash://final/'
globalThis[Symbol.for('rebase.dashboard')] = {fakes,h}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(prefix)) {
      if (!['Dashboard.jsx',...Object.keys(fakes)].includes(specifier.slice(prefix.length))) throw Error('Unapproved dashboard dependency')
      return {url:specifier,shortCircuit:true}
    }
    if (!context.parentURL?.startsWith(prefix)) return next(specifier,context)
    if (!(specifier in fakes)) throw Error('Unapproved dashboard import: '+specifier)
    return {url:prefix+specifier,shortCircuit:true}
  },
  load(url,context,next) {
    if (!url.startsWith(prefix)) return next(url,context)
    const name=url.slice(prefix.length), state="globalThis[Symbol.for('rebase.dashboard')]"
    let source
    if (name==='Dashboard.jsx') source=`const __h=(type,props,ignored,...children)=>${state}.h(type,props,...children);\n`+jsx(readFileSync(new URL('./Dashboard.jsx',import.meta.url),'utf8'))
    else {
      if (!(name in fakes)) throw Error('Unapproved dashboard load')
      source=Object.keys(fakes[name]).map(key=>key==='default' ? `export default ${state}.fakes[${JSON.stringify(name)}].default;` : `export const ${key}=${state}.fakes[${JSON.stringify(name)}][${JSON.stringify(key)}];`).join('\n')
    }
    return {format:'module',source,shortCircuit:true}
  },
})
const Dashboard=(await import(prefix+'Dashboard.jsx')).default
export function draw(search='',width=1024,view) {
  const previousWindow=globalThis.window, previousStorage=globalThis.localStorage
  globalThis.window={location:{search},innerWidth:width}
  globalThis.localStorage={getItem:()=>null}
  stateIndex=0;overrideView=view;calls.length=0
  try { const tree=Dashboard({session:{user:{id:'synthetic-coach'}}});return {tree,entry:currentView,calls} }
  finally {
    if(previousWindow===undefined) delete globalThis.window; else globalThis.window=previousWindow
    if(previousStorage===undefined) delete globalThis.localStorage; else globalThis.localStorage=previousStorage
  }
}
