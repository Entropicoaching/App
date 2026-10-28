import { assertPureGraph, assertNoteDependencies } from './coachNoteDependencyGuard.mjs'
import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, basename, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsx } from './coachNoteJsx.mjs'
import * as noteSignal from './coachNoteSignal.js'

const here = dirname(fileURLToPath(import.meta.url))
const instances = new Map()
let nextInstance = 0
// Each app gets its own module URLs and fakes, including its own flag value.
// Symbol.for lets synthetic module source retrieve only this helper's registry.
const registry = Symbol.for('APP-COACH4.synthetic-apps')
globalThis[registry] = instances
export function source(path) {
  const integrated = join(here, path.replace(/^src\//, ''))
  return readFileSync(existsSync(join(here, 'dashboard')) ? integrated : join(here, basename(path)), 'utf8')
}
export function h(type, props, ignored, ...children) {
  const flat = children.flat(Infinity).filter(child => child != null && child !== false)
  return typeof type === 'function' ? type({ ...props, children: flat }) : { type, props, children: flat }
}
export function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...(tree.children || []).flatMap(nodes)]
}
export function text(tree) {
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree)
    : (tree?.children || []).map(text).join(' ')
}
export async function app({ enabled, backend } = {}) {
  assertNoteDependencies(source)
  const id = String(++nextInstance)
  const prefix = `coach-note-test://${id}/`
  const fakes = {
    // Reply UI is outside this note harness; keep the existing OFF contract.
    'src/videoMarkerReplies.mjs': { markerRepliesEnabled: () => false, markerReplyPreview: () => null },
    'src/supabase.js': { supabase: backend, withRetry: fn => fn() },
    react: { useEffect: () => {} },
    ...(enabled === undefined ? {} : {
      'src/coachNoteSignal.js': { ...noteSignal, COACH_NOTE_SIGNAL_ENABLED: enabled },
    }),
  }
  instances.set(id, { h, fakes })
  const allowed = new Set([
    "src/dashboard/videoQueueWait.mjs",
    "src/dataEnough.mjs",
    "src/dataEvidence.mjs",
    "src/rpeEvidence.mjs",
    "src/videoEvidence.mjs",
    "src/dashboard/coachWeekOverview.mjs",
    "src/athlete/kostNumbers.mjs",
    "src/athlete/smerteRegion.js",
    "src/automationAlerts.js",
    "src/calendarDate.js",
    "src/coachBriefingRules.js",
    "src/coachBriefingSeen.js",
    "src/coachFremgang.js",
    "src/coachInboxState.js",
    "src/coachNoteSignal.js",
    "src/coachPriority.js",
    "src/danskDato.js",
    "src/dashboard/IndbakkeView.jsx",
    "src/dashboard/afvigelse.js",
    "src/dashboard/coachActions.mjs",
    "src/dashboard/coachKonstanter.js",
    "src/dashboard/coachVideoHjaelp.js",
    "src/dashboard/indbakkeHandlinger.js",
    "src/dashboard/laesninger.js",
    "src/dashboard/useCoachPrioritet.js",
    "src/dashboardShared.js",
    "src/e2eTestFlags.mjs",
    "src/exerciseNames.js",
    "src/exerciseProgress.js",
    "src/exerciseSetView.js",
    "src/inputValues.js",
    "src/messageTime.js",
    "src/personalRecords.js",
    "src/saetSmerte.js",
    "src/videoCoachLabels.js",
    "src/videoCoachPersonalFeedback.js",
    "src/videoCoachSubmission.js",
    "src/videoCoachVersion.js",
    "src/volume/ugenoegle.js"
])
  const urlFor = path => {
    if (!Object.hasOwn(fakes, path) && !allowed.has(path)) {
      assertPureGraph(path, source)
    }
    return prefix + path
  }
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier.startsWith(prefix)) return { url: urlFor(specifier.slice(prefix.length)), shortCircuit: true }
      if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
      const parent = context.parentURL.slice(prefix.length)
      let path = specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(parent), specifier)) : specifier
      if (specifier.startsWith('.') && !posix.extname(path)) path += '.js'
      return { url: urlFor(path), shortCircuit: true }
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url, context)
      const path = url.slice(prefix.length)
      const state = `globalThis[Symbol.for('APP-COACH4.synthetic-apps')].get(${JSON.stringify(id)})`
      const code = Object.hasOwn(fakes, path)
        ? Object.keys(fakes[path]).map(key => `export const ${key} = ${state}.fakes[${JSON.stringify(path)}].${key};`).join('\n')
        : `const __h = ${state}.h;\n${path.endsWith('.jsx') ? jsx(source(path)) : source(path)}`
      return { format: 'module', source: code, shortCircuit: true }
    },
  })
  return path => import(urlFor(path))
}
