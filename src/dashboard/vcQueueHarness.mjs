import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'
import { jsx } from './vcQueueJsx.mjs'

const registry = Symbol.for('VC-KOE4.synthetic')
globalThis[registry] ??= new Map()
let serial = 0
export const nodes = tree => tree && typeof tree === 'object'
  ? [tree, ...(tree.children || []).flatMap(nodes)] : []
export const text = tree => typeof tree === 'object'
  ? (tree?.children || []).map(text).join(' ').replace(/\s+/g, ' ').trim() : String(tree ?? '')

export async function app(enabled) {
  const id = String(++serial)
  const prefix = `vc-queue-${id}://app/`
  const state = { buckets: new Map(), active: null }
  state.useState = initial => {
    const bucket = state.active
    const index = bucket.cursor++
    if (!(index in bucket.values)) bucket.values[index] = initial
    return [bucket.values[index], value => { bucket.values[index] = value }]
  }
  state.h = (type, props, ignored, ...children) => {
    const flat = children.flat(Infinity).filter(value => value != null && value !== false)
    if (typeof type !== 'function') return { type, props, children: flat }
    const previous = state.active
    const bucket = state.buckets.get(type) || { cursor: 0, values: [] }
    state.buckets.set(type, bucket)
    bucket.cursor = 0
    state.active = bucket
    try { return type({ ...props, children: flat }) } finally { state.active = previous }
  }
  globalThis[registry].set(id, state)
  const allowed = new Set(['IndbakkeView.jsx', 'VideoQueueFilter.jsx', 'videoQueueFilter.mjs',
    'coachPriority.js', 'coachInboxState.js', 'coachNoteSignal.js', 'e2eTestFlags.mjs',
    'automationAlerts.js', 'coachBriefingRules.js', 'exerciseSetView.js', 'exerciseNames.js',
    'exerciseProgress.js', 'inputValues.js', 'smerteRegion.js', 'kostNumbers.mjs', 'calendarDate.js', 'ugenoegle.js'])
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true }
      if (!context.parentURL?.startsWith(prefix)) return next(specifier, context)
      let name = basename(specifier)
      if (!name.includes('.')) name += '.js'
      if (!allowed.has(name) && !['react.js', 'dashboardShared.js'].includes(name)) throw Error(`Forbidden dependency: ${specifier}`)
      return { url: prefix + name, shortCircuit: true }
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url, context)
      const name = url.slice(prefix.length)
      const access = `globalThis[Symbol.for('VC-KOE4.synthetic')].get('${id}')`
      let source
      if (name === 'react.js') source = `export const useState = ${access}.useState;`
      else if (name === 'dashboardShared.js') source = `export const s = {}; export const initials = name => name.slice(0, 2);`
      else {
        const local = new URL(name, import.meta.url)
        const relative = name === 'kostNumbers.mjs' ? '../athlete/kostNumbers.mjs'
          : name === 'ugenoegle.js' ? '../volume/ugenoegle.js'
            : name === 'smerteRegion.js' ? '../athlete/smerteRegion.js' : '../' + name
        const parent = new URL(relative, import.meta.url)
        source = readFileSync(existsSync(local) ? local : parent, 'utf8')
        if (name === 'videoQueueFilter.mjs' && enabled !== undefined) source = source.replace('VIDEO_QUEUE_FILTER_ENABLED = false', `VIDEO_QUEUE_FILTER_ENABLED = ${JSON.stringify(enabled)}`)
        if (name.endsWith('.jsx')) source = `const __h = ${access}.h;\n` + jsx(source)
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
  const View = (await import(prefix + 'IndbakkeView.jsx')).default
  return { render: props => state.h(View, props, null), load: name => import(prefix + name) }
}
