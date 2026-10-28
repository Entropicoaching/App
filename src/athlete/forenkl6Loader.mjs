import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './forenkl6Jsx.mjs'
const root = new URL('./', import.meta.url)
const components = new Set(['ProgramTab.jsx', 'forenkl6Baseline.jsx', 'CountdownRing.jsx', 'IntensityExplanation.jsx'])
const paths = {
  'intensityExplanation.mjs': './intensityExplanation.mjs',
  'programBlockOverview.mjs': './programBlockOverview.mjs',
  'inputValues.js': '../inputValues.js', 'restTimer.js': '../restTimer.js',
  'repsPrescription.js': '../repsPrescription.js', 'fixedRepsEntry.js': '../fixedRepsEntry.js',
  'exerciseSetView.js': '../exerciseSetView.js', 'exerciseNames.js': '../exerciseNames.js',
  'athleteShared.js': '../athleteShared.js', 'saetSmerte.js': '../saetSmerte.js',
  'calendarDate.js': '../calendarDate.js', 'kostNumbers.mjs': './kostNumbers.mjs',
  'coachFremgang.js': '../coachFremgang.js', 'exerciseProgress.js': '../exerciseProgress.js',
  'coachBriefingRules.js': '../coachBriefingRules.js', 'smerteRegion.js': './smerteRegion.js',
  'ugenoegle.js': '../volume/ugenoegle.js', 'ugeHjaelp.js': './ugeHjaelp.js',
}
const urls = new Map([...components].map(n => [n, new URL(n, root).href]))
for (const [name, native] of Object.entries(paths)) {
  const flat = new URL(name, root)
  urls.set(name, (existsSync(flat) ? flat : new URL(native, root)).href)
}
const approved = new Set(urls.values())
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const linked = ['dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
      if (linked && context.parentURL?.startsWith(new URL('../', root).href)) return { url: new URL(['fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].includes(linked) ? linked : '../' + linked, root).href, shortCircuit: true }
      if (approved.has(context.parentURL)) {
        if (specifier === 'react' || specifier === '../supabase.js') return { url: new URL('forenkl6Dom.mjs', root).href, shortCircuit: true }
        if (specifier === './forenkl6Dom.mjs') return next(specifier, context)
        const base = specifier.split('/').at(-1)
        const name = base.includes('.') ? base : components.has(base + '.jsx') ? base + '.jsx' : base + '.js'
        if (urls.has(name)) return { url: urls.get(name), shortCircuit: true }
        throw Error(`Unapproved synthetic dependency: ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if ([...components].some(n => urls.get(n) === url)) return {
        format: 'module', shortCircuit: true,
        source: `import { h as __h } from './forenkl6Dom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`,
      }
      return next(url, context)
    },
  })
}
