const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import { existsSync as exactExists } from 'node:fs'
// Kun kendte lokale moduler. Flad worker-kopi eller de samme projektstier.
import { registryHooks, registryRecipe } from '../src/testModuleRegistry.mjs'
import { existsSync, readFileSync } from 'node:fs'
const root = new URL('./', import.meta.url)
const paths = registryRecipe(import.meta.url, 'paths')
for (const name of ['calendarDate.js', 'inputValues.js', 'coachPriority.js', 'automationAlerts.js',
  'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'coachBriefingSeen.js', 'coachBriefingRules.js', 'coachInboxState.js', 'coachNoteSignal.js', 'exerciseSetView.js', 'exerciseProgress.js', 'exerciseNames.js']) paths[name] = 'src/' + name
const urls = new Map(Object.entries(paths).map(([name, path]) => [name,
  new URL(existsSync(new URL(name, root)) ? name : '../' + path, root).href]))
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier === 'react' && ['MobilitetFokus.jsx','CoachMobility.jsx','MobilitetsBibliotek.jsx','mobilityHelped.mjs','mobilityHomework.mjs'].some(name => context.parentURL === urls.get(name))) return { url: urls.get('mobilityDom.mjs'), shortCircuit: true }
      const name = specifier.split('/').at(-1)
      if (specifier.startsWith('.') && urls.has(name)) return { url: urls.get(name), shortCircuit: true }
      if ([...urls.values()].includes(context.parentURL)) throw new Error(`Ukendt hermetisk import: ${specifier}`)
      return next(specifier, context)
    },
    load(url, context, next) {
      if ([...urls.values()].includes(url)) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      return next(url, context)
    },
  })
}
