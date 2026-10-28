import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './uge4Jsx.mjs'

const root = new URL('./', import.meta.url)
const real = new Set(['ugeLogget.mjs', 'nextSet.js', 'UgensStatusKort.jsx', 'EnkelHjemTab.jsx',
  'HjemTab.jsx', 'ugeStatus.js', 'inputValues.js', 'kostNumbers.mjs', 'repsPrescription.js',
  'ugenoegle.js', 'athleteShared.js', 'calendarDate.js', 'ugeHjaelp.js', 'uge4Dom.mjs', 'enkelPrototype.mjs', 'uge4Baseline.jsx',
  'uge4Register.mjs', 'uge4Loader.mjs', 'uge4Jsx.mjs', 'ugeLogget.test.js', 'uge4Counter.test.js', 'nextSet.test.js', 'ugeStatus.test.js'])
// Only the unrelated home cards are replaced. Test the week card and its rules intact.
const stubs = new Map()
for (const file of ['HjemTab.jsx', 'EnkelHjemTab.jsx']) {
  const source = readFileSync(new URL(file, root), 'utf8')
  for (const match of source.matchAll(/import\s+([^\n]+?)\s+from\s+'([^']+)'/g)) {
    const name = match[2].split('/').at(-1)
    if (real.has(name) || match[2] === 'react') continue
    const exports = stubs.get(name) || new Set()
    const clause = match[1].trim()
    if (clause.startsWith('{')) clause.slice(1, -1).split(',').forEach(n => exports.add(n.trim()))
    else exports.add('default')
    stubs.set(name, exports)
  }
}
let installed
export function install() {
  if (installed) return installed
  installed = registerHooks({
    resolve(specifier, context, next) {
      if (!context.parentURL?.startsWith(root.href)) return next(specifier, context)
      if (specifier === 'react') return { url: new URL('uge4Dom.mjs', root).href, shortCircuit: true }
      if (specifier.startsWith('node:')) return next(specifier, context)
      if (!specifier.startsWith('.')) throw Error('Forbidden test dependency: ' + specifier)
      const name = specifier.split('/').at(-1)
      if (/^supabase(?:\.js)?$/.test(name)) return { url: 'uge4:backend', shortCircuit: true }
      const approved = real.has(name) ? name : real.has(name + '.js') ? name + '.js' : null
      if (approved) {
        const flat = new URL(approved, root)
        const native = new URL(specifier + (approved === name ? '' : '.js'), context.parentURL)
        return { url: (existsSync(flat) ? flat : native).href, shortCircuit: true }
      }
      if (stubs.has(name)) return { url: 'uge4:stub:' + name, shortCircuit: true }
      throw Error('Unapproved test dependency: ' + specifier)
    },
    load(url, context, next) {
      if (url === 'uge4:backend') return { format: 'module', shortCircuit: true,
        source: 'export const supabase = new Proxy({}, {get(){throw Error("Backend forbidden")}})' }
      if (url.startsWith('uge4:stub:')) return { format: 'module', shortCircuit: true,
        source: [...stubs.get(url.slice(10))].map(n => n === 'default'
          ? 'export default function(){return null}' : `export function ${n}(){return null}`).join('\n') }
      if (url.endsWith('.jsx') && url.startsWith(root.href)) return { format: 'module', shortCircuit: true,
        source: `import { createElement as __h } from './uge4Dom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}` }
      return next(url, context)
    },
  })
  return installed
}
