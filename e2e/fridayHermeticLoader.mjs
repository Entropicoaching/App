// Kun kendte lokale moduler. Flad worker-kopi eller de samme projektstier.
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
const root = new URL('./', import.meta.url)
const paths = {
  'e2eTestFlags.mjs': 'src/e2eTestFlags.mjs',
  'MobilitetFokus.jsx': 'src/athlete/MobilitetFokus.jsx',
  'mobilityFocus.mjs': 'src/athlete/mobilityFocus.mjs',
  'mobilityDom.mjs': 'src/athlete/mobilityDom.mjs',
  'analyseSamlet.mjs': 'src/dashboard/analyseSamlet.mjs',
  'coachPlanCopy.mjs': 'src/dashboard/coachPlanCopy.mjs',
  'kostNumbers.mjs': 'src/athlete/kostNumbers.mjs',
  'smerteRegion.js': 'src/athlete/smerteRegion.js',
  'ugenoegle.js': 'src/volume/ugenoegle.js',
}
for (const name of ['calendarDate.js', 'inputValues.js', 'coachPriority.js', 'automationAlerts.js',
  'coachBriefingRules.js', 'coachInboxState.js', 'coachNoteSignal.js', 'exerciseSetView.js', 'exerciseProgress.js', 'exerciseNames.js']) paths[name] = 'src/' + name
const urls = new Map(Object.entries(paths).map(([name, path]) => [name,
  new URL(existsSync(new URL(name, root)) ? name : '../' + path, root).href]))
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react' && context.parentURL === urls.get('MobilitetFokus.jsx')) return { url: urls.get('mobilityDom.mjs'), shortCircuit: true }
      const name = specifier.split('/').at(-1)
      if (specifier.startsWith('.') && urls.has(name)) return { url: urls.get(name), shortCircuit: true }
      if ([...urls.values()].includes(context.parentURL) && !specifier.startsWith('node:')) throw new Error(`Ukendt hermetisk import: ${specifier}`)
      return next(specifier, context)
    },
    load(url, context, next) {
      if ([...urls.values()].includes(url)) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      return next(url, context)
    },
  })
}
