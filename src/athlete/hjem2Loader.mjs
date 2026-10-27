import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { jsx } from './hjem2Jsx.mjs'

const root = new URL('./', import.meta.url)
const real = new Map([
  ['mobilityBeforeSession.mjs', './mobilityBeforeSession.mjs'], ['mobilityCatalog.mjs', './mobilityCatalog.mjs'],
  ['mobilityLibrary.mjs', './mobilityLibrary.mjs'],
  ['nextTrainingHome.mjs', './nextTrainingHome.mjs'], ['nextSet.js', '../nextSet.js'],
  ['calendarDate.js', '../calendarDate.js'], ['kostNumbers.mjs', './kostNumbers.mjs'],
  ['exerciseSetView.js', '../exerciseSetView.js'], ['exerciseNames.js', '../exerciseNames.js'],
  ['HjemTab.jsx', './HjemTab.jsx'], ['EnkelHjemTab.jsx', './EnkelHjemTab.jsx'],
])
const urls = new Map([...real].map(([name, path]) => [name,
  (existsSync(new URL(name, root)) ? new URL(name, root) : new URL(path, root)).href]))
const stubs = new Set(['athleteShared', 'ugeHjaelp', 'checkinReminder', 'readinessInsight',
  'pauseLinje', 'restBetweenSets', 'restPause', 'warmup', 'ForsideGrafer', 'dinUge',
  'athleteShortcuts.mjs', 'weightTrend.mjs'])
const components = new Set(['UgensStatusKort', 'WeekCalendar', 'DagensPasCard', 'DinUgeKort', 'RestPauseFooter'])

export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      const linked = ['dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].find(n => specifier === '../' + n || specifier === './' + n)
      if (linked && context.parentURL?.startsWith(new URL('../', root).href)) return { url: new URL(['fremgangLinjer.mjs', 'fremgangPersonalRecords.mjs'].includes(linked) ? linked : '../' + linked, root).href, shortCircuit: true }
      if (specifier === new URL('./hjem2Dom.mjs', root).href) return next(specifier, context)
      if ([...urls.values()].includes(context.parentURL)) {
        const name = specifier.split('/').at(-1)
        const file = urls.has(name) ? name : urls.has(name + '.jsx') ? name + '.jsx' : name + '.js'
        if (urls.has(file)) return { url: urls.get(file), shortCircuit: true }
        if (specifier === 'react' || (stubs.has(name) || stubs.has(name.replace(/\.(?:jsx|js)$/, '')))) return { url: new URL('./hjem2Dom.mjs', root).href, shortCircuit: true }
        if ((components.has(name) || components.has(name.replace(/\.(?:jsx|js)$/, '')))) return { url: 'hjem2-stub:' + name.replace(/\.(?:jsx|js)$/, ''), shortCircuit: true }
        throw new Error('Unapproved synthetic import: ' + specifier)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.startsWith('hjem2-stub:')) return { format: 'module', source: `export default props => ({ type: ${JSON.stringify(url.slice(11))}, props, children: [] })`, shortCircuit: true }
      if ([urls.get('HjemTab.jsx'), urls.get('EnkelHjemTab.jsx')].includes(url)) {
        return { format: 'module', source: `import { h as __h } from ${JSON.stringify(new URL('./hjem2Dom.mjs', root).href)};\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      }
      return next(url, context)
    },
  })
}
