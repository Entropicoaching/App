import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './mob3Jsx.mjs'
const root = new URL('./', import.meta.url)
const actual = new Set(['staevneHome.mjs', 'nextTrainingHome.mjs', 'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'vcForenkl4.mjs', 'mobilityBeforeSession.mjs', 'mobilityCatalog.mjs', 'mobilityLibrary.mjs',
  'mobilityHelped.mjs', 'mobilityFocus.mjs', 'MobilitetFokus.jsx', 'MobilitetsBibliotek.jsx', 'MobiliseringTab.jsx',
  'exerciseNames.js', 'warmup.js', 'nextSet.js', 'HjemTab.jsx', 'EnkelHjemTab.jsx', 'DagensPasCard.jsx',
  'appLog2.mjs', 'vaerdTekst.mjs', 'inputValues.js', 'exerciseSetView.js', 'logAccessibility.mjs',
  'nextSetPreview.js', 'repsPrescription.js', 'fixedRepsEntry.js', 'setLogDefaults.js',
  'smerteStop.js', 'setTapGuard.js', 'restBetweenSets.js', 'pauseLinje.js', 'saetSmerte.js', 'dagensPasLayout.mjs',
  'kostNumbers.mjs', 'coachFremgang.js', 'coachBriefingRules.js', 'smerteRegion.js', 'exerciseProgress.js',
  'calendarDate.js', 'ugenoegle.js'])
const peripheral = new Set(['athleteShared', 'ugeHjaelp', 'UgensStatusKort', 'WeekCalendar', 'DinUgeKort',
  'dinUge', 'RestPauseFooter', 'ForsideGrafer', 'readinessInsight', 'checkinReminder', 'restPause',
  'weightTrend.mjs', 'athleteShortcuts.mjs', 'PasOverblik.jsx', 'CountdownRing'])
export function moduleURL(name) {
  return ['./' + name, '../' + name, '../volume/' + name].map(path => new URL(path, root)).find(url => existsSync(url))
}
const urls = new Map([...actual].map(name => [moduleURL(name)?.href, name]))
const nameOf = url => urls.get(url)
let configuredLineEndings
export function setLineEndings(value) { configuredLineEndings = value }
export function install({ lineEndings = configuredLineEndings } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      if (actual.has(nameOf(context.parentURL))) {
        if (specifier === 'react' || specifier === 'react-dom' || specifier === './mob3Dom.mjs') return { url: new URL('mob3Dom.mjs', root).href, shortCircuit: true }
        const basename = specifier.split('/').at(-1)
        const file = [basename, basename + '.js', basename + '.jsx', basename + '.mjs'].find(name => actual.has(name))
        if (file) return { url: moduleURL(file).href, shortCircuit: true }
        if ((peripheral.has(basename) || peripheral.has(basename.replace(/\.(?:jsx|js)$/, '')))) return { url: new URL('mob3Stubs.mjs', root).href, shortCircuit: true }
        throw Error(`Forbidden synthetic import: ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      const name = nameOf(url)
      if (!actual.has(name)) return next(url, context)
      let source = readFileSync(new URL(url), 'utf8')
      if (lineEndings) source = source.replace(/\r?\n/g, lineEndings)
      if (name.endsWith('.jsx')) {
        try { source = `import { h as __h } from './mob3Dom.mjs';\n${jsx(source)}` }
        catch (error) { throw Error(`${name}: ${error.message}`, { cause: error }) }
      }
      return { format: 'module', source, shortCircuit: true }
    },
  })
}
