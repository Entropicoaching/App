import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
const synthetic = new URL('./synthetic.mjs', import.meta.url).href
const exportsByPath = {
  '../coachInboxState': ['summarizeRefreshResults', 'filterDraftVideoReviews', 'filterOpenTrainingSignals', 'summarizeCoachMessages'],
  '../automationAlerts': ['filterOpenAutomationAlerts'],
  '../saetSmerte': ['saetSmerteSignaler', 'medSaetSmerte'],
  './coachKonstanter': ['ATHLETE_LOGS_LIMIT'],
  '../videoCoachVersion': ['VIDEOCOACH_BASELINE_VERSION'],
  '../personalRecords': ['normaliserRekorder', 'bedsteRekorder', 'tungeRekorder'],
  '../danskDato': ['danskDag'],
}
export function resolve(specifier, context, next) {
  if (specifier === 'react') return { url: synthetic, shortCircuit: true }
  if ((context.parentURL?.endsWith('/laesninger.js') || context.parentURL?.endsWith('/baselineLaesninger.js'))) {
    if (specifier === '../supabase') return { url: synthetic, shortCircuit: true }
    if (specifier === './afvigelse') return { url: new URL('./afvigelse.js', context.parentURL).href, shortCircuit: true }
    if (exportsByPath[specifier]) {
      const source = exportsByPath[specifier].map(name => `export const ${name} = () => { throw Error('Unexpected synthetic helper: ${name}') }`).join('\n')
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true }
    }
  }
  return next(specifier, context)
}
export function load(url, context, next) {
  if (url.endsWith('/CoachActions.jsx')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
  return next(url, context)
}

// Also support the ordinary node --test entry point without external setup.
registerHooks({ resolve, load })
