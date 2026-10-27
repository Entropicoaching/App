import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
const root = new URL('./', import.meta.url)
const paths = {
  'kost2Loader.mjs': 'src/athlete/kost2Loader.mjs',
  'kost2Dom.mjs': 'src/athlete/kost2Dom.mjs',
  'kost2Paths.mjs': 'src/athlete/kost2Paths.mjs',
  'mobilityFocus.mjs': 'src/athlete/mobilityFocus.mjs',
  'coachWeekOverview.mjs': 'src/dashboard/coachWeekOverview.mjs',
  'calendarDate.js': 'src/calendarDate.js',
  'kostNumbers.mjs': 'src/athlete/kostNumbers.mjs',
}
const urls = new Map(Object.entries(paths).map(([name, path]) => [name,
  new URL(existsSync(new URL(name, root)) ? name : path.replace(/^src\//, ''), root).href]))
export const hooks = registerHooks({
  resolve(specifier, context, next) {
    const name = specifier.split('/').at(-1)
    if (specifier.startsWith('.') && urls.has(name)) return { url: urls.get(name), shortCircuit: true }
    if (['mobilityFocus.mjs','coachWeekOverview.mjs','calendarDate.js','kostNumbers.mjs'].some(n => context.parentURL === new URL(n, root).href) && !specifier.startsWith('node:'))
      throw new Error(`Unapproved synthetic dependency: ${specifier}`)
    return next(specifier, context)
  },
  load(url, context, next) {
    if ([...urls.values()].includes(url)) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
    return next(url, context)
  },
})
