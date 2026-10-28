import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './followUpJsx.mjs'
const base = new URL('./', import.meta.url)
// Explicit pinned parent/specifier pairs. Never infer exports from runtime source.
const dependencies = [
  ["../Dashboard.jsx", "./nytIAppen.mjs", {"stub": "export default function Stub(){return null}\nexport const nytCoachNavigation = () => () => {};"}],
  ["../Dashboard.jsx", "./dashboard/coachNotes.mjs", { "file": "./coachNotes.mjs" }],
  ["../Dashboard.jsx", "./dashboard/fridayChecklist.mjs", {"stub": "export function FridayChecklist(){return null}\nexport function FridayChecklistEntry(){return null}"}],
  ["../Dashboard.jsx", "./rel1030.mjs", {"stub": "export const DEFAULT_REL1030 = false; export const rel1030Enabled = () => false;"}],
  [
    "./ForsideView.jsx",
    "./coachFollowUp.mjs",
    {
      "file": "./coachFollowUp.mjs"
    }
  ],
  [
    "./ForsideView.jsx",
    "./coachMorning.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const CoachMorning = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "../coachInboxState.js",
    {
      "stub": "export default function Stub(){return null}\nexport const coachInboxLine = () => \"status\";"
    }
  ],
  [
    "./ForsideView.jsx",
    "../dataEvidence.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const positiveStatusEvidence = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "../dataEnough.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const dataEnoughEnabled = () => false;\nexport const dataMessage = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "react",
    {
      "file": "./followUpDom.mjs"
    }
  ],
  [
    "./ForsideView.jsx",
    "./coachWeekOverview.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const renderWeekOverview = () => null;\nexport const selectOverviewWeek = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "../coachRyd.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const CoachFold = props => props.children;"
    }
  ],
  [
    "./ForsideView.jsx",
    "../dashboardShared.js",
    {
      "stub": "export default function Stub(){return null}\nexport const currentWeekNo = () => 1;\nexport const s = {badge: () => ({})};\nexport const initials = name => name.slice(0, 2);"
    }
  ],
  [
    "./ForsideView.jsx",
    "./afvigelse.js",
    {
      "file": "./afvigelse.js"
    }
  ],
  [
    "./ForsideView.jsx",
    "../roligeAtleter.js",
    {
      "stub": "export default function Stub(){return null}\nexport const roligeAtleter = () => ({});\nexport const roligLinje = () => null;"
    }
  ],
  [
    "./ForsideView.jsx",
    "../coachBriefingSeen.js",
    {
      "stub": "export default function Stub(){return null}\nexport const coachBriefingPointKey = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "../supabase.js",
    {
      "stub": "export default function Stub(){return null}\nexport const supabase = {from: () => {throw Error(\"Backend forbidden\")}};"
    }
  ],
  [
    "./ForsideView.jsx",
    "./coachKonstanter.js",
    {
      "stub": "export default function Stub(){return null}\nexport const holidayInfo = () => null;\nexport const ferieBadgeLabel = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "./coachVideoHjaelp.js",
    {
      "stub": "export default function Stub(){return null}\nexport const videoCoachMeasurementSummary = () => null;\nexport const coachVideoPriorityDetail = () => ({});\nexport const videoCoachMeasurementText = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "../danskDato.js",
    {
      "stub": "export default function Stub(){return null}\nexport const dageSiden = () => ({});"
    }
  ],
  [
    "./ForsideView.jsx",
    "./CoachActions.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "./ForsideView.jsx",
    "./coachActions.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const COACH_ACTIONS_ENABLED = false;\nexport const coachActionsEnabled = () => false;"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/VideoReviewTemplates.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const DEFAULT_VIDEO_REVIEW_TEMPLATES = false;"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/coachFollowUp.mjs",
    {
      "file": "./coachFollowUp.mjs"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/coachMorning.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const coachMorningFlag = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/CoachFourWeeks.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/coachFourWeeks.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const COACH_FOUR_WEEKS_ENABLED = false;\nexport const reduceFourWeekRead = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/coachWeekOverview.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const coachWeekFlag = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/coachTemplateMessages.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const COACH_TEMPLATE_MESSAGES_ENABLED = false;\nexport const createCoachTemplateSender = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./supabase.js",
    {
      "stub": "export default function Stub(){return null}\nexport const supabase = {from: () => {throw Error(\"Backend forbidden\")}};"
    }
  ],
  [
    "../Dashboard.jsx",
    "./coachRyd.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const coachRydEnabled = () => ({});\nexport const WorkInboxLink = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./calendarDate.js",
    {
      "stub": "export default function Stub(){return null}\nexport const calendarDay = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "react",
    {
      "file": "./followUpDom.mjs"
    }
  ],
  [
    "../Dashboard.jsx",
    "./LazyBoundary.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./coachInboxState.js",
    {
      "stub": "export default function Stub(){return null}\nexport const coachInboxEntryIntent = () => ({view: \"list\"});\nexport const createSingleFlightRunner = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./periodizationAssistant.js",
    {
      "stub": "export default function Stub(){return null}\nexport const withBlockPurposes = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboardShared.js",
    {
      "stub": "export default function Stub(){return null}\nexport const s = {badge: () => ({})};\nexport const currentWeekNo = () => 1;"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/laesninger.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavLaesninger = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/navigation.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavNavigation = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/indbakkeHandlinger.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavIndbakkeHandlinger = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/videoReviewHandlinger.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavVideoReviewHandlinger = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/atletHandlinger.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavAtletHandlinger = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/aiRapport.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavAiRapport = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/programHandlinger.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavProgramHandlinger = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/weekDeletion.js",
    {
      "stub": "export default function Stub(){return null}\nexport const createWeekDeletionQueue = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/programCopy.js",
    {
      "stub": "export default function Stub(){return null}\nexport const DEFAULT_PROGRAM_COPY = false;"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/WeekDeletionNotice.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/useVideoCoachBro.js",
    {
      "stub": "export default function Stub(){return null}\nexport const useVideoCoachBro = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/BibliotekView.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/KalenderView.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/ForsideView.jsx",
    {
      "file": "./ForsideView.jsx"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/HubTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/OpvarmningTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/OversigtTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/KostTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/LogTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/StaevneTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/NoterTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/BeskederTab.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/coachSaveNext.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const COACH_SAVE_NEXT_ENABLED = false;\nexport const createInboxSaveNext = () => ({});\nexport const inboxReplyMatches = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/VideoReviewModal.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/StaevneResultatModal.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/NyAtletModal.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/Overlays.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/Sidebar.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/MobilNav.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/ProfilHoved.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/WeekdayPicker.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/ExFormRow.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/BlockSequenceRows.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/profilTal.js",
    {
      "stub": "export default function Stub(){return null}\nexport const lavProfilTal = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/useDashboardEffekter.js",
    {
      "stub": "export default function Stub(){return null}\nexport const useDashboardEffekter = () => ({});"
    }
  ],
  [
    "../Dashboard.jsx",
    "./dashboard/useCoachPrioritet.js",
    {
      "stub": "export default function Stub(){return null}\nexport const useCoachPrioritet = () => ({coachPriorityItems: [], coachPriorityCount: 0});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./coachMorning.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const CoachMorning = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../coachInboxState.js",
    {
      "stub": "export default function Stub(){return null}\nexport const coachInboxLine = () => \"status\";"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../dataEvidence.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const positiveStatusEvidence = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../dataEnough.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const dataEnoughEnabled = () => false;\nexport const dataMessage = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "react",
    {
      "file": "./followUpDom.mjs"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./coachWeekOverview.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const renderWeekOverview = () => null;\nexport const selectOverviewWeek = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../coachRyd.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const CoachFold = props => props.children;"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../dashboardShared.js",
    {
      "stub": "export default function Stub(){return null}\nexport const currentWeekNo = () => 1;\nexport const s = {badge: () => ({})};\nexport const initials = name => name.slice(0, 2);"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./afvigelse.js",
    {
      "file": "./afvigelse.js"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../roligeAtleter.js",
    {
      "stub": "export default function Stub(){return null}\nexport const roligeAtleter = () => ({});\nexport const roligLinje = () => null;"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../coachBriefingSeen.js",
    {
      "stub": "export default function Stub(){return null}\nexport const coachBriefingPointKey = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../supabase.js",
    {
      "stub": "export default function Stub(){return null}\nexport const supabase = {from: () => {throw Error(\"Backend forbidden\")}};"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./coachKonstanter.js",
    {
      "stub": "export default function Stub(){return null}\nexport const holidayInfo = () => null;\nexport const ferieBadgeLabel = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./coachVideoHjaelp.js",
    {
      "stub": "export default function Stub(){return null}\nexport const videoCoachMeasurementSummary = () => null;\nexport const coachVideoPriorityDetail = () => ({});\nexport const videoCoachMeasurementText = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "../danskDato.js",
    {
      "stub": "export default function Stub(){return null}\nexport const dageSiden = () => ({});"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./CoachActions.jsx",
    {
      "stub": "export default function Stub(){return null}\n"
    }
  ],
  [
    "./followUpBaseline.jsx",
    "./coachActions.mjs",
    {
      "stub": "export default function Stub(){return null}\nexport const COACH_ACTIONS_ENABLED = false;\nexport const coachActionsEnabled = () => false;"
    }
  ],
  [
    "./coachFollowUp.mjs",
    "react",
    {
      "file": "./followUpDom.mjs"
    }
  ]
]
const real = new Set(["./coachNotes.mjs", "./ForsideView.jsx", "../Dashboard.jsx", "./followUpBaseline.jsx", "./coachFollowUp.mjs", "./afvigelse.js"].map(path => new URL(path, base).href))
const dom = new URL('./followUpDom.mjs', base).href
const pairs = new Map(dependencies.map(([parent, specifier, target]) => [
  new URL(parent, base).href + '\n' + specifier,
  target.file ? new URL(target.file, base).href : 'data:text/javascript,' + encodeURIComponent(target.stub),
]))
const protectedNames = new Set([...real].map(url => new URL(url).pathname.split('/').at(-1)))
function unapproved(value) {
  const error = new Error('Unapproved hermetic dependency: ' + value)
  error.code = 'ERR_MODULE_NOT_FOUND'
  throw error
}
export function install() {
 return registerHooks({
  resolve(specifier, context, next) {
   const parent = context.parentURL
   if (parent === new URL('./followUpReview.test.js',base).href && specifier === './Dashboard.jsx')
    return {url:new URL('../Dashboard.jsx',base).href,shortCircuit:true}
   if (real.has(parent)) {
    if (specifier === dom && parent.endsWith('.jsx')) return {url:dom,shortCircuit:true}
    const target = pairs.get(parent + '\n' + specifier)
    if (!target) return unapproved(specifier)
    return {url:target,shortCircuit:true}
   }
   const result = next(specifier,context)
   if (result.url.startsWith('file:') && protectedNames.has(new URL(result.url).pathname.split('/').at(-1)) && !real.has(result.url)) return unapproved(result.url)
   return result
  },
  load(url, context, next) {
   if (real.has(url)) {
    const source = readFileSync(new URL(url),'utf8')
    return {format:'module',source:url.endsWith('.jsx') ? `import { __h } from '${dom}';\n${jsx(source)}` : source,shortCircuit:true}
   }
   if (url.startsWith('file:') && protectedNames.has(new URL(url).pathname.split('/').at(-1))) return unapproved(url)
   return next(url,context)
  },
 })
}
