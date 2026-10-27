import { existsSync as exactExists } from 'node:fs'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
const synthetic = new URL('./synthetic.mjs', import.meta.url).href
const exportsByPath = {
  '../coachInboxState.js': ['summarizeRefreshResults', 'filterDraftVideoReviews', 'filterOpenTrainingSignals', 'summarizeCoachMessages'],
  '../automationAlerts.js': ['filterOpenAutomationAlerts'],
  '../saetSmerte.js': ['saetSmerteSignaler', 'medSaetSmerte'],
  './coachKonstanter.js': ['ATHLETE_LOGS_LIMIT'],
  '../videoCoachVersion.js': ['VIDEOCOACH_BASELINE_VERSION'],
  '../personalRecords.js': ['normaliserRekorder', 'bedsteRekorder', 'tungeRekorder'],
  '../danskDato.js': ['danskDag'],
}
export function resolve(specifier, context, next) {
  if (specifier === '../coachNoteSignal.js' && !existsSync(new URL('../coachNoteSignal.js', import.meta.url))) return { url: new URL('./coachNoteSignal.js', import.meta.url).href, shortCircuit: true }
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
  if (specifier === 'react') return { url: synthetic, shortCircuit: true }
  if ((context.parentURL?.endsWith('/laesninger.js') || context.parentURL?.endsWith('/baselineLaesninger.js'))) {
    if (specifier === '../supabase.js') return { url: synthetic, shortCircuit: true }
    if (specifier === './afvigelse.js') return { url: new URL('./afvigelse.js', context.parentURL).href, shortCircuit: true }
    if (exportsByPath[specifier]) {
      const source = exportsByPath[specifier].map(name => `export const ${name} = () => { throw Error('Unexpected synthetic helper: ${name}') }`).join('\n')
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true }
    }
  }
  return next(specifier, context)
}
export function load(url, context, next) {
  if (url.endsWith('/CoachActions.jsx') || url.endsWith('/CoachTemplateMessage.jsx')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
  return next(url, context)
}

// Also support the ordinary node --test entry point without external setup.
registerHooks({ resolve, load })
