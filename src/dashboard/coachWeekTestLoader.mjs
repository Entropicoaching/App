import { registerHooks } from 'node:module'
const root = new URL('./', import.meta.url)
import { existsSync } from 'node:fs'
const locations = { 'calendarDate.js':'../calendarDate.js', 'kostNumbers.mjs':'../athlete/kostNumbers.mjs' }
const url = name => {
 const flat = new URL(name,root)
 return (existsSync(flat) ? flat : new URL(locations[name] || name,root)).href
}
// Exact parent/specifier pairs from the pinned public handlers.
const stubs = {
  "laesninger.js": {
    "../blokFremgang.mjs": [
      "readBlockLogs"
    ],
    "./coachFourWeeks.mjs": [
      "readFourWeekSource"
    ],
    "../coachNoteSignal.js": [
      "COACH_NOTE_SIGNAL_ENABLED"
    ],
    "../dataEnough.mjs": [
      "dataAllowed",
      "dataEnoughEnabled"
    ],
    "../dataEvidence.mjs": [
      "rpeSignalEvidence",
      "rpeSignalDescription"
    ],
    "./coachMorningSource.mjs": [
      "readMorningSource"
    ],
    "../videoEvidence.mjs": [
      "attachVideoReferences"
    ],
    "../coachInboxState.js": [
      "summarizeRefreshResults",
      "filterDraftVideoReviews",
      "filterOpenTrainingSignals",
      "summarizeCoachMessages"
    ],
    "../supabase.js": [
      "supabase",
      "withRetry"
    ],
    "../automationAlerts.js": [
      "filterOpenAutomationAlerts"
    ],
    "../saetSmerte.js": [
      "saetSmerteSignaler",
      "medSaetSmerte"
    ],
    "./coachKonstanter.js": [
      "ATHLETE_LOGS_LIMIT"
    ],
    "../videoCoachVersion.js": [
      "VIDEOCOACH_BASELINE_VERSION"
    ],
    "../personalRecords.js": [
      "normaliserRekorder",
      "bedsteRekorder",
      "tungeRekorder"
    ],
    "../danskDato.js": [
      "danskDag"
    ]
  },
  "navigation.js": {
    "../weekDates": [
      "nextWeekStartDate"
    ],
    "../coachPriority": [
      "coachPriorityTaskContext"
    ]
  }
}
const real = {
  'calendarDate.js': { './athlete/kostNumbers.mjs':'kostNumbers.mjs' },
  'laesninger.js': { './coachWeekOverview.mjs':'coachWeekOverview.mjs', './afvigelse.js':'afvigelse.js', './coachActions.mjs':'coachActions.mjs' },
  'coachWeekOverview.mjs': { '../calendarDate.js':'calendarDate.js' },
}
export function resolve(specifier, context, next) {
  const parent = Object.keys({...stubs,...real}).find(name => url(name) === context.parentURL)
  if (parent) {
    const target = real[parent]?.[specifier]
    if (target) return {url:url(target),shortCircuit:true}
    const names = stubs[parent]?.[specifier]
    if (!names) throw Error('Unpinned dependency: '+parent+' -> '+specifier)
    const source = names.map(name => {
      if (name === 'supabase') return 'export const supabase = { from: (...args) => globalThis.coachWeekFake.from(...args) }'
      if (name === 'dataEnoughEnabled') return 'export const dataEnoughEnabled = () => false'
      return `export const ${name} = () => { throw Error('Unexpected dependency: ${name}') }`
    }).join('\n')
    return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true}
  }
  return next(specifier, context)
}
registerHooks({resolve})
