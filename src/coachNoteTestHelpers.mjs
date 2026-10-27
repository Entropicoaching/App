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
  return readFileSync(existsSync(integrated) ? integrated : join(here, basename(path)), 'utf8')
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
  const id = String(++nextInstance)
  const prefix = `coach-note-test://${id}/`
  const fakes = {
    'src/supabase.js': { supabase: backend, withRetry: fn => fn() },
    react: { useEffect: () => {} },
    ...(enabled === undefined ? {} : {
      'src/coachNoteSignal.js': { ...noteSignal, COACH_NOTE_SIGNAL_ENABLED: enabled },
    }),
  }
  instances.set(id, { h, fakes })
  const allowed = new Set([
    'e2eTestFlags.mjs', 'coachPriority.js', 'automationAlerts.js', 'coachBriefingRules.js',
    'exerciseSetView.js', 'exerciseNames.js', 'exerciseProgress.js', 'inputValues.js',
    'kostNumbers.mjs', 'calendarDate.js', 'ugenoegle.js', 'smerteRegion.js',
    'coachInboxState.js', 'coachNoteSignal.js', 'laesninger.js', 'saetSmerte.js',
    'coachFremgang.js', 'coachKonstanter.js', 'afvigelse.js', 'videoCoachVersion.js',
    'personalRecords.js', 'danskDato.js', 'useCoachPrioritet.js', 'coachVideoHjaelp.js',
    'videoCoachSubmission.js', 'videoCoachPersonalFeedback.js', 'videoCoachLabels.js',
    'indbakkeHandlinger.js', 'messageTime.js', 'coachBriefingSeen.js',
    'IndbakkeView.jsx', 'dashboardShared.js', 'coachActions.mjs',
  ])
  const urlFor = path => {
    if (!Object.hasOwn(fakes, path) && (!path.startsWith('src/') || !allowed.has(posix.basename(path)))) {
      throw new Error(`Unapproved synthetic dependency ${path}`)
    }
    return prefix + path
  }
  registerHooks({
    resolve(specifier, context, next) {
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
